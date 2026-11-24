import { Icon } from './Icon';
import { useT } from '../i18n';

const item =
  'flex h-10 items-center gap-[11px] overflow-hidden whitespace-nowrap rounded-lg px-[10px] text-[14px] font-medium transition-colors duration-180 ease-ch';

/**
 * Desktop only: on a phone the top nav carries the brand and the reset.
 * Only Dito exists yet, so the other sections are shown but not offered.
 */
export function SideNav({ expanded, onNew }: { expanded: boolean; onNew?: () => void }) {
  const n = useT().nav;
  const label = `transition-opacity duration-180 ease-ch ${expanded ? 'opacity-100' : 'opacity-0'}`;

  return (
    <nav
      aria-label={n.main}
      className={`hidden flex-none flex-col overflow-hidden border-r border-ch-border-hover bg-ch-panel px-2 py-[18px] transition-[width] duration-240 ease-ch md:flex ${
        expanded ? 'w-[224px]' : 'w-14'
      }`}
    >
      <div className="flex h-7 items-center gap-[9px] px-2">
        <img src="/assets/logo-mark.svg" alt="" className="h-5 w-5 flex-none brightness-0 invert" />
        <span className={`whitespace-nowrap font-jakarta text-[14px] font-bold tracking-[-.02em] text-white ${label}`}>
          CreditoHipotecar.io
        </span>
      </div>

      <ul className="mt-[34px] flex flex-col gap-1">
        <li>
          {/* Nothing to forget on the empty screen, so "Nuevo" waits for a conversation. */}
          <button
            type="button"
            onClick={onNew}
            disabled={!onNew}
            aria-label={n.new}
            className={`${item} w-full text-slate-200 hover:bg-ch-card/50 disabled:cursor-default disabled:hover:bg-transparent`}
          >
            <Icon name="plus-sign" size={17} className="flex-none" />
            <span className={label}>{n.new}</span>
          </button>
        </li>
        <li>
          <Soon icon="building-03" name={n.properties} soon={n.soon} labelClass={label} />
        </li>
        <li>
          <Soon icon="dollar-square" name={n.valuate} soon={n.soon} labelClass={label} />
        </li>
        <li>
          <a href="/" aria-current="page" aria-label="Dito" className={`${item} bg-ch-card text-white`}>
            <Icon name="bubble-chat" size={17} className="flex-none" />
            <span className={label}>Dito</span>
          </a>
        </li>
      </ul>
    </nav>
  );
}

function Soon({ icon, name, soon, labelClass }: { icon: string; name: string; soon: string; labelClass: string }) {
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-label={name}
      title={soon}
      className={`${item} w-full cursor-default text-slate-200`}
    >
      <Icon name={icon} size={17} className="flex-none" />
      <span className={labelClass}>{name}</span>
    </button>
  );
}
