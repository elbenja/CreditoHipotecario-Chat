export function Thinking() {
  return (
    <div data-testid="thinking" className="flex w-fit items-center gap-[6px] rounded-full bg-ch-panel px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-[6px] w-[6px] rounded-full bg-slate-400"
          style={{ animation: `ch-dot 1.3s ${i * 160}ms infinite cubic-bezier(.2,.7,.2,1)` }}
        />
      ))}
    </div>
  );
}
