/**
 * Cache key utility. Used by kusto.ts to generate deterministic
 * cache keys for StateService.
 */

/**
 * Compute a cache key from a query string.
 * Uses djb2 hash + string length to reduce collision risk.
 */
export function computeCacheKey(text: string, prefix: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return `${prefix}${hash}_${text.length}`;
}
