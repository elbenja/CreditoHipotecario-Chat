import type { Scenario } from '@chat/shared';
import { Icon } from './Icon';

export function SavedScenarios({
  scenarios,
  onDelete,
}: {
  scenarios: Scenario[];
  onDelete: (id: string) => void;
}) {
  return (
    <section className="mb-3 mt-4 px-3">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
          Escenarios guardados
        </span>
        <div className="h-px flex-1 bg-ch-border" />
        {scenarios.length > 0 && (
          <span className="text-[11px] font-medium text-slate-400">
            {scenarios.length} {scenarios.length === 1 ? 'guardado' : 'guardados'}
          </span>
        )}
      </div>

      {scenarios.length === 0 ? (
        <p className="rounded-[10px] border border-ch-border p-[14px] text-[11.5px] leading-[1.5] text-slate-500">
          Guarda acá los escenarios que no quieras perder. Se van con la propiedad cuando la
          guardes.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {scenarios.map((s) => (
            <div
              key={s.id}
              data-saved-scenario={s.id}
              /* Filled #1e293b, not the in-chat card's #0f172a outline. That
                 contrast is what signals "committed". */
              className="flex items-center gap-2 rounded-[10px] border border-white/[.06] bg-ch-card px-[13px] py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px] font-semibold uppercase tracking-[.08em] text-slate-500">
                  {s.cause}
                </div>
                <div className="tnum mt-1 font-jakarta text-[17px] font-bold tracking-[-.02em] text-white">
                  {s.value}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                aria-label={`Borrar escenario ${s.cause}`}
                className="grid h-6 w-6 flex-none place-items-center rounded-md text-slate-500 transition-colors duration-120 ease-ch hover:bg-ch-panel hover:text-ch-neg"
              >
                <Icon name="delete-02" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
