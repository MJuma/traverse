import { useState, useEffect } from 'react';

export interface ElapsedTimerProps {
    startTime: number;
}

export function ElapsedTimer({ startTime }: ElapsedTimerProps) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(id);
    }, []);
    const seconds = ((now - startTime) / 1000).toFixed(1);
    return <span>{seconds}s</span>;
}
