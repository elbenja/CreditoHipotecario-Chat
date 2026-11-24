import { useDemoRemaining } from '../hooks/useDemo';
import { useT } from '../i18n';
import type { ChatState } from '../state/chatReducer';
import { DEMO_STEPS, demoStep } from '../state/demoStep';
import { Pill } from './Pill';

/**
 * The demo's guided path, one step at a time, above the composer. It only
 * suggests: the composer stays open for the reader's own questions.
 */
export function DemoGuide({
  state,
  onSend,
  disabled,
}: {
  state: ChatState;
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const d = useT().demo;
  const remaining = useDemoRemaining();
  const n = demoStep(state);
  const step = d.steps[n - 1];
  const prompt = step?.prompt;

  return (
    <div className="ch-rise mb-3 flex flex-col gap-2">
      <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400">
        <span className="flex-1 font-semibold uppercase tracking-[.1em] text-[10px]">
          {step ? d.step(n, DEMO_STEPS) : d.label}
        </span>
        {/* Keyed so each spent question crossfades in, the way the panel's counts do. */}
        {remaining !== null && <span key={remaining} className="ch-count-in tnum">{d.left(remaining)}</span>}
      </div>
      {/* One line on a phone: the step's prompt says what to do, so the
          instruction beside it only shows where there is room. */}
      {prompt ? (
        // Keyed by step: finishing one slides the next in rather than swapping text.
        <div key={n} className="ch-line flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="hidden flex-none text-[12.5px] text-slate-300 md:inline">{step?.instruction}</span>
          <Pill onClick={() => onSend(prompt)} disabled={disabled} className="min-w-0 max-w-full truncate text-[12.5px]">
            {prompt}
          </Pill>
        </div>
      ) : (
        <p key={n} className="ch-line text-[12.5px] leading-[1.5] text-slate-300">{step ? step.instruction : d.done}</p>
      )}
    </div>
  );
}
