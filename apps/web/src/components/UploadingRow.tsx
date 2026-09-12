import type { Status } from '../state/chatReducer';
import { Icon } from './Icon';

/** `248 KB` below a megabyte, `2.5 MB` above. */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Card 09 while the browser reads the file, card 03 once the server takes
 * over. Two honest phases rather than a fake percentage: reading page 1 is a
 * single async step with no progress to report, so the bar runs to ~90% and
 * lands on 100% the moment the server answers.
 */
export function UploadingRow({
  attachment,
  status,
  steps,
}: {
  attachment: { name: string; size: number };
  status: Status;
  steps: { label: string; done: boolean }[];
}) {
  const reading = status === 'thinking';
  const current = steps.find((s) => !s.done)?.label;
  // size 0 is readListing's cue: nothing was read in the browser, so there is
  // no size, no local bar and no "page read" line — only the server's step.
  const link = attachment.size === 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="ch-rise flex items-start gap-3 rounded-xl border border-ch-border bg-ch-panel px-[13px] py-3"
    >
      <div className="relative grid h-[42px] w-[34px] flex-none place-items-center overflow-hidden rounded-[6px] border border-ch-border-hover bg-ch-card text-slate-400">
        <Icon name="file-02" size={16} />
        {reading && (
          <span
            aria-hidden="true"
            className="ch-scan absolute inset-x-0 top-[2px] h-[2px] bg-ch-accent shadow-[0_0_8px_rgba(244,188,68,.7)]"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-[10px]">
          <span className="truncate text-[12.5px] font-medium text-slate-100">{attachment.name}</span>
          {!link && (
            <span className="tnum flex-none text-[11px] font-medium text-slate-400">
              {formatSize(attachment.size)}
            </span>
          )}
        </div>
        {!link && (
          <div className="mt-[9px] h-1 overflow-hidden rounded-full bg-ch-card">
            <div
              className={`h-full rounded-full bg-ch-accent transition-[width] duration-240 ease-ch ${
                reading ? 'ch-bar' : 'w-full'
              }`}
            />
          </div>
        )}
        {reading && !link ? (
          <div className="mt-[7px] text-[11px] font-medium text-slate-400">Leyendo tu cronograma…</div>
        ) : (
          <div className="mt-[9px] flex flex-col gap-2">
            {!link && (
              <div className="ch-enter flex items-center gap-[9px] text-[12px] text-slate-400">
                <Icon name="tick-double-01" size={15} className="text-ch-pos" />
                Primera página leída
              </div>
            )}
            {current && (
              <div
                className="ch-enter flex items-center gap-[9px] text-[12px] text-slate-100"
                style={{ animationDelay: '120ms' }}
              >
                <span
                  className="h-[15px] w-[15px] flex-none rounded-full border-2 border-ch-border border-t-ch-accent"
                  style={{ animation: 'ch-spin .8s linear infinite' }}
                />
                {current}…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
