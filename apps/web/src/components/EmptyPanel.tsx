const SLOTS = ['Ubicación', 'Precio de compra', 'Área', 'Tasa TEA', 'Cuota inicial'];

export function EmptyPanel() {
  return (
    <aside className="flex w-panel flex-none flex-col border-l border-ch-border px-[22px] py-6">
      <div className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
        Datos de la operación
      </div>
      <p className="mt-2 text-[12.5px] text-slate-400">Se van fijando solos mientras conversas.</p>

      <div className="mt-5 flex flex-col gap-2">
        {SLOTS.map((label) => (
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
        Guardar como propiedad
      </button>
    </aside>
  );
}
