/**
 * Priority-aware concurrency limiter.
 * High-priority requests are dequeued before normal-priority ones.
 */

export type Priority = 'high' | 'normal';

export class ConcurrencyLimiter {
    private active = 0;
    private readonly highQueue: Array<() => void> = [];
    private readonly normalQueue: Array<() => void> = [];

    constructor(private readonly maxConcurrent: number) {}

    acquire(priority: Priority = 'normal'): Promise<void> {
        if (this.active < this.maxConcurrent) {
            this.active++;
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const queue = priority === 'high' ? this.highQueue : this.normalQueue;
            queue.push(() => {
                this.active++;
                resolve();
            });
        });
    }

    release(): void {
        this.active--;
        const next = this.highQueue.shift() ?? this.normalQueue.shift();
        if (next) {
            next();
        }
    }

    /** Current number of active slots (for testing/diagnostics). */
    get activeCount(): number {
        return this.active;
    }

    /** Current number of queued waiters (for testing/diagnostics). */
    get queueLength(): number {
        return this.highQueue.length + this.normalQueue.length;
    }
}
