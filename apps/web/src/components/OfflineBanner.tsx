import { Icon } from './Icon';

export function OfflineBanner() {
  return (
    <div className="ch-line mx-14 mt-3 flex items-center gap-[10px] rounded-[10px] border border-[rgba(245,158,11,.2)] bg-[rgba(49,37,15,.5)] px-4 py-[11px]">
      <Icon name="wifi-disconnected-01" size={16} className="text-[#f59e0b]" />
      <span className="flex-1 text-[12.5px] font-medium text-[#fcd34d]">
        Sin conexión. Reintentando…
      </span>
      <span
        className="h-[14px] w-[14px] rounded-full border-2 border-[rgba(245,158,11,.25)] border-t-[#f59e0b]"
        style={{ animation: 'ch-spin .8s linear infinite' }}
      />
    </div>
  );
}
