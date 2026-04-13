import type { ReactNode } from 'react';

export interface TabButtonProps {
    className: string;
    onClick: () => void;
    children: ReactNode;
}

export function TabButton({ className, onClick, children }: TabButtonProps) {
    return <button type="button" className={className} onClick={onClick}>{children}</button>;
}
