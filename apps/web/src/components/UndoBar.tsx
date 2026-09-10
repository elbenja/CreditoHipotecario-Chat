import { useEffect } from 'react';

export function UndoBar({
  visible,
  onUndo,
  onExpire,
  label = 'Escenario borrado',
}: {
  visible: boolean;
  onUndo: () => void;
  onExpire: () => void;
  label?: string;
}) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onExpire, 5000);
    return () => clearTimeout(t);
  }, [visible, onExpire]);

  if (!visible) return null;

  return (
    // Centred with auto margins, not a transform: `ch-line` animates transform
    // and would overwrite a `-translate-x-1/2`.
    <div
      className="ch-line absolute inset-x-0 bottom-4 z-10 mx-auto flex w-fit items-center gap-3 rounded-full border border-ch-border bg-ch-card px-4 py-[10px] shadow-lg"
    >
      <span className="text-[12px] text-slate-300">{label}</span>
      <button
        type="button"
        onClick={onUndo}
        className="text-[12px] font-semibold text-slate-50 underline underline-offset-2 transition-opacity duration-120 ease-ch hover:opacity-90"
      >
        Deshacer
      </button>
    </div>
  );
}
