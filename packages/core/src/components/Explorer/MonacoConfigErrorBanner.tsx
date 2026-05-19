import type { MonacoWorkerConfigurationError } from '../ExplorerWorkspace/monacoWorkers';

interface MonacoConfigErrorBannerProps {
    error: MonacoWorkerConfigurationError;
    className?: string;
}

const WRAPPER_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '300px',
    padding: '32px',
    boxSizing: 'border-box',
    fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    color: '#d4d4d4',
    background: '#1f1f1f',
};

const CARD_STYLE: React.CSSProperties = {
    maxWidth: '720px',
    width: '100%',
    background: '#2b2b2b',
    border: '1px solid #3f3f46',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
};

const HEADING_STYLE: React.CSSProperties = {
    margin: '0 0 12px 0',
    fontSize: '18px',
    fontWeight: 600,
    color: '#e8912d',
};

const HINT_STYLE: React.CSSProperties = {
    margin: '0 0 16px 0',
    fontSize: '14px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    color: '#cccccc',
};

const PRE_STYLE: React.CSSProperties = {
    background: '#0d0d0d',
    border: '1px solid #3f3f46',
    borderRadius: '4px',
    padding: '12px 16px',
    fontSize: '13px',
    fontFamily:
        '"SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    color: '#9cdcfe',
    overflowX: 'auto',
    margin: 0,
};

/**
 * Rendered in place of the Explorer when Monaco workers have not been
 * configured. The message is verbatim from the assertion helper so the
 * fix instructions stay in lockstep with the actual check.
 *
 * Pure presentational component — no imports from FluentUI to keep it
 * usable even when the host hasn't wrapped us in `<FluentProvider>`.
 */
export function MonacoConfigErrorBanner({ error, className }: MonacoConfigErrorBannerProps): React.ReactElement {
    // Split the hint into the conversational prose and the code snippet.
    // The convention is: anything before the first blank line is prose,
    // anything after is code that should render in a <pre> block.
    const blankLineIdx = error.hint.indexOf('\n\n');
    const prose = blankLineIdx >= 0 ? error.hint.slice(0, blankLineIdx) : error.hint;
    const code = blankLineIdx >= 0 ? error.hint.slice(blankLineIdx + 2) : '';

    return (
        <div className={className} style={WRAPPER_STYLE} role="alert" aria-live="polite">
            <div style={CARD_STYLE}>
                <h2 style={HEADING_STYLE}>⚠ {error.summary}</h2>
                <p style={HINT_STYLE}>{prose}</p>
                {code ? <pre style={PRE_STYLE}><code>{code}</code></pre> : null}
            </div>
        </div>
    );
}
