import { Icon } from './Icon';

export function TopNav({ context }: { context?: string }) {
  return (
    <header className="flex h-nav flex-none items-center gap-[9px] border-b border-ch-border px-6">
      <img src="/assets/logo-mark.svg" alt="" className="h-[22px] w-[22px]" />
      <span className="font-jakarta text-[13.5px] font-bold tracking-[-.02em] text-white">
        créditohipotecar.io
      </span>

      <div className="flex-1" />

      {context && (
        <span className="flex items-center gap-[6px] rounded-full border border-ch-border px-3 py-[6px] text-[11.5px] text-slate-400">
          <Icon name="home-01" size={13} />
          {context}
        </span>
      )}

      {/*
        Every figure in this POC is model-produced. Stated once, globally.
        Deliberately NOT in #F4BC44 — that accent is capped at four
        placements on Screen 2 and a fifth would dilute all of them.
      */}
      <span className="rounded-full border border-ch-border px-3 py-[6px] text-[11.5px] text-slate-400">
        números indicativos · POC
      </span>
    </header>
  );
}
