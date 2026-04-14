import { check } from '@tauri-apps/plugin-updater';
import type { Update } from '@tauri-apps/plugin-updater';

export type { Update };

export async function checkForUpdate(): Promise<Update | null> {
    try {
        return await check();
    } catch (err) {
        console.error('Update check failed:', err);
        return null;
    }
}

export async function installUpdate(update: Update): Promise<void> {
    await update.downloadAndInstall();
}
