import { describe, it, expect } from 'vitest';
import { computeCacheKey } from './cache';

describe('computeCacheKey', () => {
    it('returns a deterministic key for the same input', () => {
        const key1 = computeCacheKey('hello', 'pfx_');
        const key2 = computeCacheKey('hello', 'pfx_');
        expect(key1).toBe(key2);
    });

    it('produces different keys for different texts', () => {
        const key1 = computeCacheKey('hello', 'pfx_');
        const key2 = computeCacheKey('world', 'pfx_');
        expect(key1).not.toBe(key2);
    });

    it('prepends the prefix', () => {
        const key = computeCacheKey('test', 'myprefix_');
        expect(key.startsWith('myprefix_')).toBe(true);
    });

    it('includes the text length in the key', () => {
        const key = computeCacheKey('abc', 'p_');
        expect(key).toContain('_3');
    });

    it('handles empty string', () => {
        const key = computeCacheKey('', 'pfx_');
        expect(key).toBe('pfx_0_0');
    });
});
