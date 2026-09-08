import type { AnalysisEnvelope } from '@chat/shared';

export function OutOfScopeAnswer({
  envelope,
  onFollowUp,
  disabled = false,
}: {
  envelope: AnalysisEnvelope;
  onFollowUp: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    /* No icon, no box, no apology: one line and two ways out. Refusing well
       matters as much as answering well, and the reframe keeps the
       conversation alive. */
    <div className="ch-line flex items-start gap-[11px]">
      <img src="/assets/logo-mark.svg" alt="" className="mt-[3px] h-4 w-4" />
      <div className="flex-1">
        <p className="text-[13px] leading-[1.6] text-slate-300">{envelope.verdict}</p>
        {envelope.followUps.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {envelope.followUps.map((f) => (
              <button
                key={f}
                type="button"
                disabled={disabled}
                onClick={() => onFollowUp(f)}
                className="rounded-full border border-ch-border-hover px-[13px] py-[7px] text-[12px] font-medium text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
