import { useT } from '../i18n';

export function EmptyPanel() {
  const p = useT().panel;
  return (
    <aside className="hidden w-panel flex-none flex-col border-l border-ch-border px-[22px] py-6 md:flex">
      <div className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
        {p.title}
      </div>
      <p className="mt-2 text-[12.5px] text-slate-400">{p.emptyHint}</p>

      <div className="mt-5 flex flex-col gap-2">
        {p.emptySlots.map((label) => (
          <div
            key={label}
            className="flex h-[58px] items-center rounded-[10px] border border-ch-border px-[14px] text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="flex-1" />

      <button
        type="button"
        disabled
        className="h-[46px] rounded-full bg-ch-card text-[13.5px] font-semibold text-slate-600"
      >
        {p.saveProperty}
      </button>
    </aside>
  );
}
