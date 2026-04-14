use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::Rng;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

fn random_string(len: usize) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::thread_rng();
    (0..len)
        .map(|_| CHARSET[rng.gen_range(0..CHARSET.len())] as char)
        .collect()
}

fn generate_pkce() -> (String, String) {
    let verifier = random_string(128);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    (verifier, challenge)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthFlowResult {
    code: String,
    code_verifier: String,
    redirect_uri: String,
}

/// Opens the system browser for Azure AD login and waits for the auth code
/// callback on a temporary localhost:3000 server.
#[tauri::command]
pub async fn start_auth_flow(
    app: AppHandle,
    client_id: String,
    tenant_id: String,
    scope: String,
) -> Result<AuthFlowResult, String> {
    let (code_verifier, code_challenge) = generate_pkce();
    let state = random_string(32);

    let listener = TcpListener::bind("127.0.0.1:3000")
        .map_err(|e| format!("Port 3000 is in use. Free it and retry. ({})", e))?;
    let redirect_uri = "http://localhost:3000".to_string();

    let auth_scope = format!("{} offline_access", scope);
    let auth_url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/authorize?\
         client_id={}&response_type=code&redirect_uri={}&scope={}\
         &code_challenge={}&code_challenge_method=S256&state={}&prompt=select_account",
        tenant_id,
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&auth_scope),
        urlencoding::encode(&code_challenge),
        urlencoding::encode(&state),
    );

    app.opener()
        .open_url(&auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    let expected_state = state;
    let code = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let (mut stream, _) = listener
            .accept()
            .map_err(|e| format!("Failed to accept connection: {}", e))?;

        let mut buf = [0u8; 8192];
        let n = stream
            .read(&mut buf)
            .map_err(|e| format!("Failed to read request: {}", e))?;
        let request = String::from_utf8_lossy(&buf[..n]);
        let first_line = request.lines().next().ok_or("Empty request")?;

        let path = first_line
            .split_whitespace()
            .nth(1)
            .ok_or("Invalid HTTP request")?;
        let callback_url = url::Url::parse(&format!("http://localhost{}", path))
            .map_err(|e| e.to_string())?;
        let params: HashMap<String, String> = callback_url
            .query_pairs()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();

        if let Some(error) = params.get("error") {
            let desc = params
                .get("error_description")
                .map(|s| s.as_str())
                .unwrap_or("Unknown error");
            let body = format!(
                "<html><head><meta charset=\"utf-8\"></head>\
                 <body style='font-family:system-ui;display:flex;align-items:center;\
                 justify-content:center;height:100vh;color:#bc5653'>\
                 <h2>Authentication failed: {}</h2></body></html>",
                desc
            );
            let resp = format!(
                "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\n\
                 Content-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            stream.write_all(resp.as_bytes()).ok();
            return Err(format!("{}: {}", error, desc));
        }

        let received_state = params.get("state").ok_or("Missing state parameter")?;
        if received_state != &expected_state {
            return Err("State mismatch - possible CSRF attack".to_string());
        }

        let code = params
            .get("code")
            .ok_or("Missing authorization code")?
            .clone();

        let body = "<html><head><meta charset=\"utf-8\"></head>\
                     <body style='font-family:system-ui;display:flex;align-items:center;\
                     justify-content:center;height:100vh'>\
                     <h2>Authentication complete — you can close this tab.</h2></body></html>";
        let resp = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
             Content-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        );
        stream.write_all(resp.as_bytes()).ok();

        Ok(code)
    })
    .await
    .map_err(|e| format!("Auth listener panicked: {}", e))??;

    Ok(AuthFlowResult {
        code,
        code_verifier,
        redirect_uri,
    })
}
