import type { ReactNode } from 'react';

export function Pill({
  children,
  onClick,
  className = '',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border border-ch-border-hover px-[15px] py-[9px] text-[13px] font-medium text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}
