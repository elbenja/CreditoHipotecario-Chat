import { Icon } from './Icon';
import { useT } from '../i18n';

export function OfflineBanner() {
  const copy = useT();
  return (
    <div className="ch-line mx-14 mt-3 flex items-center gap-[10px] rounded-[10px] border border-ch-warn/20 bg-[rgba(49,37,15,.5)] px-4 py-[11px]">
      <Icon name="wifi-disconnected-01" size={16} className="text-ch-warn" />
      <span className="flex-1 text-[12.5px] font-medium text-amber-300">
        {copy.conversation.offlineBanner}
      </span>
      <span
        className="h-[14px] w-[14px] rounded-full border-2 border-ch-warn/25 border-t-ch-warn"
        style={{ animation: 'ch-spin .8s linear infinite' }}
      />
    </div>
  );
}
