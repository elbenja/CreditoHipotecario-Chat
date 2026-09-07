import { Icon } from './Icon';

export function TruncatedNotice({
  onContinue,
  onShorten,
}: {
  onContinue: () => void;
  onShorten: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      {/* A fading rule, not an ellipsis: the text above is valid, it just stops. */}
      <div className="h-px bg-[linear-gradient(90deg,#334155,transparent)]" />
      <div className="rounded-xl border border-ch-border-hover bg-ch-panel px-[15px] py-[13px]">
        <div className="flex items-center gap-[9px]">
          <Icon name="text-align-left" size={15} className="text-slate-400" />
          <span className="text-[12.5px] font-semibold text-slate-100">La respuesta se cortó</span>
        </div>
        <p className="mt-[7px] text-[12px] leading-[1.5] text-slate-400">
          Llegó al límite de largo. Lo de arriba es válido.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onContinue}
            className="flex h-8 items-center rounded-full bg-slate-50 px-[14px] text-[12px] font-semibold text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px"
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={onShorten}
            className="flex h-8 items-center rounded-full border border-ch-border-hover px-[13px] text-[12px] font-medium text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500"
          >
            Pídelo más corto
          </button>
        </div>
      </div>
    </div>
  );
}
