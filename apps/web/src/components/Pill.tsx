import type { ReactNode } from 'react';

export function Pill({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border border-ch-border-hover px-[15px] py-[9px] text-[13px] font-medium text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500 ${className}`}
    >
      {children}
    </button>
  );
}
