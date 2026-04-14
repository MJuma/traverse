import { describe, it, expect } from 'vitest';
import { ConcurrencyLimiter } from './concurrency';

describe('ConcurrencyLimiter', () => {
    it('acquire resolves immediately when under limit', async () => {
        const limiter = new ConcurrencyLimiter(2);
        await limiter.acquire();
        expect(limiter.activeCount).toBe(1);
        expect(limiter.queueLength).toBe(0);
    });

    it('acquire queues when at limit and resolves after release', async () => {
        const limiter = new ConcurrencyLimiter(1);
        await limiter.acquire();
        expect(limiter.activeCount).toBe(1);

        let secondResolved = false;
        const secondPromise = limiter.acquire().then(() => { secondResolved = true; });
        expect(limiter.queueLength).toBe(1);
        expect(secondResolved).toBe(false);

        limiter.release();
        await secondPromise;
        expect(secondResolved).toBe(true);
        expect(limiter.activeCount).toBe(1);
        expect(limiter.queueLength).toBe(0);
    });

    it('dequeues high priority before normal priority', async () => {
        const limiter = new ConcurrencyLimiter(1);
        await limiter.acquire();

        const order: string[] = [];
        const normalPromise = limiter.acquire('normal').then(() => { order.push('normal'); });
        const highPromise = limiter.acquire('high').then(() => { order.push('high'); });

        expect(limiter.queueLength).toBe(2);

        limiter.release();
        await highPromise;
        expect(order).toEqual(['high']);

        limiter.release();
        await normalPromise;
        expect(order).toEqual(['high', 'normal']);
    });

    it('defaults to normal priority', async () => {
        const limiter = new ConcurrencyLimiter(1);
        await limiter.acquire();

        const order: string[] = [];
        const defaultPromise = limiter.acquire().then(() => { order.push('default'); });
        const highPromise = limiter.acquire('high').then(() => { order.push('high'); });

        limiter.release();
        await highPromise;

        limiter.release();
        await defaultPromise;

        expect(order).toEqual(['high', 'default']);
    });

    it('reports correct activeCount and queueLength', async () => {
        const limiter = new ConcurrencyLimiter(2);
        expect(limiter.activeCount).toBe(0);
        expect(limiter.queueLength).toBe(0);

        await limiter.acquire();
        expect(limiter.activeCount).toBe(1);

        await limiter.acquire();
        expect(limiter.activeCount).toBe(2);

        void limiter.acquire();
        void limiter.acquire('high');
        expect(limiter.queueLength).toBe(2);
    });

    it('drains queue in priority order across multiple releases', async () => {
        const limiter = new ConcurrencyLimiter(1);
        await limiter.acquire();

        const order: string[] = [];
        const p1 = limiter.acquire('normal').then(() => { order.push('n1'); });
        const p2 = limiter.acquire('high').then(() => { order.push('h1'); });
        const p3 = limiter.acquire('normal').then(() => { order.push('n2'); });
        const p4 = limiter.acquire('high').then(() => { order.push('h2'); });

        expect(limiter.queueLength).toBe(4);

        limiter.release();
        await p2;
        expect(order[0]).toBe('h1');

        limiter.release();
        await p4;
        expect(order[1]).toBe('h2');

        limiter.release();
        await p1;
        expect(order[2]).toBe('n1');

        limiter.release();
        await p3;
        expect(order).toEqual(['h1', 'h2', 'n1', 'n2']);
    });

    it('release without pending queue decrements active count', () => {
        const limiter = new ConcurrencyLimiter(2);
        void limiter.acquire();
        void limiter.acquire();
        expect(limiter.activeCount).toBe(2);

        limiter.release();
        expect(limiter.activeCount).toBe(1);
    });

    it('handles many concurrent acquires', async () => {
        const limiter = new ConcurrencyLimiter(3);
        const count = 20;
        const results: number[] = [];
        let counter = 0;

        const tasks = Array.from({ length: count }, async (_, i) => {
            await limiter.acquire(i % 2 === 0 ? 'high' : 'normal');
            counter++;
            results.push(i);
            limiter.release();
        });

        await Promise.all(tasks);
        expect(results).toHaveLength(count);
        expect(counter).toBe(count);
        expect(limiter.activeCount).toBe(0);
        expect(limiter.queueLength).toBe(0);
    });
});
