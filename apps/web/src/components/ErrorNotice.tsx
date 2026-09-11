import type { ChatError } from '../state/chatReducer';
import { Icon } from './Icon';

export function ErrorNotice({
  error,
  onRetry,
  onEdit,
}: {
  error: ChatError;
  onRetry: () => void;
  onEdit: () => void;
}) {
  const title = error.kind === 'request'
    ? 'Kimi rechazó la solicitud'
    : error.kind === 'limit'
      ? 'Kimi no alcanzó a responder'
      : 'No pude completar el análisis';
  const canRetry = error.kind === 'api' || error.kind === 'offline';

  return (
    <div className="ch-line flex items-start gap-[11px]">
      <img src="/assets/logo-mark.svg" alt="" className="mt-[3px] h-4 w-4 opacity-50" />
      {/* One step lighter than a normal bubble — that contrast is the signal. */}
      <div className="flex-1 rounded-xl border border-ch-border-hover bg-ch-panel px-4 py-[14px]">
        <div className="flex items-center gap-[9px]">
          {/* Amber, never red: red in a money app reads as "you lost money". */}
          <Icon name="alert-02" size={16} className="text-[#f59e0b]" />
          <span className="text-[13.5px] font-semibold text-slate-100">
            {title}
          </span>
        </div>
        <p className="mt-2 text-[12.5px] leading-[1.55] text-slate-400">{error.message}</p>
        <div className="mt-[14px] flex items-center gap-[9px]">
          {canRetry && error.retry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex h-[34px] items-center gap-[7px] rounded-full bg-slate-50 px-[15px] text-[12.5px] font-semibold text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px"
            >
              <Icon name="refresh" size={14} />
              Reintentar
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="flex h-[34px] items-center rounded-full border border-ch-border-hover px-[14px] text-[12.5px] font-medium text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500"
          >
            Editar la pregunta
          </button>
        </div>
      </div>
    </div>
  );
}
