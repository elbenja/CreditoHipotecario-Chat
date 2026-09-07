import { useEffect } from 'react';

export function UndoBar({
  visible,
  onUndo,
  onExpire,
}: {
  visible: boolean;
  onUndo: () => void;
  onExpire: () => void;
}) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onExpire, 5000);
    return () => clearTimeout(t);
  }, [visible, onExpire]);

  if (!visible) return null;

  return (
    <div className="ch-line absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border border-ch-border bg-ch-card px-4 py-[10px] shadow-lg">
      <span className="text-[12px] text-slate-300">Escenario borrado</span>
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
