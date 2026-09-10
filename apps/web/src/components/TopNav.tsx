import { Icon } from './Icon';

export function TopNav({ context, onReset }: { context?: string; onReset?: () => void }) {
  const [mobileTitle, mobileSubtitle] = context?.split(' · ') ?? [];

  return (
    <header className="mobile-safe-top flex min-h-[60px] flex-none items-center gap-[9px] border-b border-ch-border px-5 md:h-nav md:px-6">
      <img
        src="/assets/logo-mark.svg"
        alt=""
        className="h-[18px] w-[18px] md:h-[22px] md:w-[22px]"
      />
      {context ? (
        <div className="min-w-0 flex-1 md:hidden">
          <div className="truncate text-[13px] font-semibold text-white">{mobileTitle}</div>
          <div className="text-[11px] font-medium text-slate-400">{mobileSubtitle}</div>
        </div>
      ) : (
        <span className="font-jakarta text-[13px] font-bold tracking-[-.02em] text-white md:text-[13.5px]">
          créditohipotecar.io
        </span>
      )}
      <span className="hidden font-jakarta text-[13.5px] font-bold tracking-[-.02em] text-white md:inline">
        {context && 'créditohipotecar.io'}
      </span>

      <div className="flex-1" />

      {/*
        Destructive, so it stays out of the thumb's path in the transcript —
        but one tap, not two: the undo bar is the safety net, not a dialog.
        Only with a conversation on screen; there is nothing to forget before.
      */}
      {context && onReset && (
        <button
          type="button"
          onClick={onReset}
          aria-label="Nueva consulta"
          className="flex items-center gap-[6px] rounded-full border border-ch-border px-3 py-[6px] text-[11.5px] font-medium text-slate-400 transition-colors duration-180 ease-ch hover:border-ch-border-hover hover:text-slate-200"
        >
          <Icon name="plus-sign" size={13} />
          <span className="hidden md:inline">Nueva consulta</span>
        </button>
      )}

      <span className="grid h-7 w-7 place-items-center rounded-md bg-ch-border-hover text-[11px] font-bold text-white md:hidden">
        JC
      </span>
    </header>
  );
}
