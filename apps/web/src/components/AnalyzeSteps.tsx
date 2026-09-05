import { Icon } from './Icon';

export function AnalyzeSteps({ steps }: { steps: { label: string; done: boolean }[] }) {
  const currentIndex = steps.findIndex((s) => !s.done);

  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <div
          key={step.label}
          className="ch-enter flex items-center gap-[10px] text-[13px] text-slate-400"
          style={{ animationDelay: `${i * 400}ms` }}
        >
          {step.done ? (
            <Icon name="tick-double-01" size={15} className="text-ch-pos" />
          ) : i === currentIndex ? (
            <span
              className="h-[15px] w-[15px] rounded-full border-2 border-ch-border border-t-ch-accent"
              style={{ animation: 'ch-spin .8s linear infinite' }}
            />
          ) : (
            <span className="h-[15px] w-[15px]" />
          )}
          {step.label}
        </div>
      ))}
    </div>
  );
}
