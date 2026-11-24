import { useEffect, useState } from 'react';
import { lockAccess } from '../api/access';
import { Icon } from './Icon';
import { useIsDemo } from '../hooks/useDemo';
import { LANG_NAMES, LANGS, setLang, useLang, useT } from '../i18n';

export function TopNav({
  context,
  onReset,
  navExpanded = true,
  onToggleNav,
}: {
  context?: string;
  onReset?: () => void;
  navExpanded?: boolean;
  onToggleNav?: () => void;
}) {
  const n = useT().nav;
  const [mobileTitle, mobileSubtitle] = context?.split(' · ') ?? [];
  const navLabel = navExpanded ? n.collapse : n.expand;

  return (
    <header className="mobile-safe-top flex min-h-[60px] flex-none items-center gap-[9px] border-b border-ch-border px-5 md:h-nav md:gap-7 md:px-6">
      {/* Phone: the brand and the conversation live here. Desktop: in the side nav. */}
      <img src="/assets/logo-mark.svg" alt="" className="h-[18px] w-[18px] md:hidden" />
      {context ? (
        <div className="min-w-0 flex-1 md:hidden">
          <div className="truncate text-[13px] font-semibold text-white">{mobileTitle}</div>
          <div className="text-[11px] font-medium text-slate-400">{mobileSubtitle}</div>
        </div>
      ) : (
        <span className="font-jakarta text-[13px] font-bold tracking-[-.02em] text-white md:hidden">
          créditohipotecar.io
        </span>
      )}

      {onToggleNav && (
        <button
          type="button"
          onClick={onToggleNav}
          aria-label={navLabel}
          title={navLabel}
          aria-expanded={navExpanded}
          className="-ml-[7px] hidden h-8 w-8 flex-none place-items-center rounded-lg text-slate-300 transition-colors duration-180 ease-ch hover:bg-ch-panel active:translate-y-px md:grid"
        >
          <PanelIcon closing={navExpanded} />
        </button>
      )}

      <div className="flex-1" />

      {/*
        Destructive, so it stays out of the thumb's path in the transcript —
        but one tap, not two: the undo bar is the safety net, not a dialog.
        Only with a conversation on screen; there is nothing to forget before.
        On desktop the side nav's "Nuevo" does this.
      */}
      {context && onReset && (
        <button
          type="button"
          onClick={onReset}
          aria-label={n.newQuery}
          className="flex items-center gap-[6px] rounded-full border border-ch-border px-3 py-[6px] text-[11.5px] font-medium text-slate-400 transition-colors duration-180 ease-ch hover:border-ch-border-hover hover:text-slate-200 md:hidden"
        >
          <Icon name="plus-sign" size={13} />
        </button>
      )}

      {/* Shown as in the design; neither has a destination yet. */}
      <button
        type="button"
        aria-disabled="true"
        title={n.soon}
        className="hidden cursor-default items-center gap-[7px] text-[14px] font-medium text-slate-200 md:flex"
      >
        <Icon name="search-01" size={16} />
        {n.search}
      </button>
      <button
        type="button"
        aria-disabled="true"
        title={n.soon}
        className="hidden cursor-default items-center gap-[7px] text-[14px] font-medium text-slate-200 md:flex"
      >
        <Icon name="globe-02" size={16} />
        {n.help}
      </button>

      <AccountMenu />
    </header>
  );
}

/**
 * Hugeicons' panel-left-open / -close, drawn inline: the CDN icon font does
 * not ship them. The chevron points the way the nav will move.
 */
function PanelIcon({ closing }: { closing: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11c0-3.771 0-5.657-1.172-6.828C18.657 3 16.771 3 13 3h-2C7.229 3 5.343 3 4.172 4.172 3 5.343 3 7.229 3 11v2c0 3.771 0 5.657 1.172 6.828C5.343 21 7.229 21 11 21h2c3.771 0 5.657 0 6.828-1.172C21 18.657 21 16.771 21 13v-2Z" />
        <path d="M9 3v18" />
        <path
          d={
            closing
              ? 'M16 9l-1.108.879C13.631 10.879 13 11.379 13 12s.631 1.121 1.892 2.121L16 15'
              : 'M14 9l1.108.879C16.369 10.879 17 11.379 17 12s-.631 1.121-1.892 2.121L14 15'
          }
        />
      </g>
    </svg>
  );
}

function AccountMenu() {
  const copy = useT();
  const n = copy.nav;
  const demo = useIsDemo();
  const lang = useLang();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const soon = n.soon;
  const row =
    'flex h-[38px] w-full items-center gap-[10px] whitespace-nowrap rounded-lg px-[10px] text-[13.5px] font-medium text-slate-200 transition-colors duration-180 ease-ch';

  return (
    <div className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={n.account}
        title={n.account}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-[6px] rounded-full p-[3px] transition-colors duration-180 ease-ch md:pr-[6px] md:hover:bg-ch-panel ${
          open ? 'md:bg-ch-panel' : ''
        }`}
      >
        <span className="grid h-7 w-7 place-items-center rounded-md bg-ch-border-hover text-[11px] font-bold text-white md:h-8 md:w-8 md:rounded-full md:text-[12px]">
          JC
        </span>
        <Icon
          name="arrow-down-01"
          size={15}
          className={`hidden text-slate-300 transition-transform duration-240 ease-ch md:inline-block ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[1]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            aria-label={n.account}
            className="ch-drop absolute right-0 top-[calc(100%+8px)] z-[2] min-w-[212px] rounded-xl border border-ch-border-hover bg-ch-panel p-[6px] shadow-[0_20px_60px_rgba(0,0,0,.55)]"
          >
            {(
              [
                ['user', n.myAccount],
                ['credit-card', n.plan],
                ['settings-01', n.settings],
              ] as const
            ).map(([icon, name]) => (
              <button key={name} type="button" role="menuitem" aria-disabled="true" title={soon} className={`${row} cursor-default`}>
                <Icon name={icon} size={17} className="text-slate-400" />
                {name}
              </button>
            ))}
            <div className="mx-1 my-[6px] h-px bg-ch-border-hover" />
            {/* Applies at once and is remembered in this browser. Each name is
                written in its own language, so either reader can find theirs. */}
            <div role="group" aria-label={n.language}>
              <div className="flex items-center gap-[10px] px-[10px] pb-1 pt-[6px] text-[11px] font-semibold uppercase tracking-[.1em] text-slate-500">
                <Icon name="globe-02" size={14} />
                {n.language}
              </div>
              {LANGS.map((code) => (
                <button
                  key={code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={lang === code}
                  lang={code}
                  onClick={() => setLang(code)}
                  className={`${row} pl-[37px] hover:bg-ch-card`}
                >
                  <span className="flex-1 text-left">{LANG_NAMES[code]}</span>
                  {lang === code && <Icon name="tick-02" size={16} className="text-ch-accent" />}
                </button>
              ))}
            </div>
            <div className="mx-1 my-[6px] h-px bg-ch-border-hover" />
            {/* The only real session here is the prototype password: forget it.
                In the demo the same step is the way back to the gate. */}
            <button type="button" role="menuitem" onClick={lockAccess} className={`${row} hover:bg-ch-card`}>
              <Icon name="logout-03" size={17} className="text-slate-400" />
              {demo ? copy.demo.enterPassword : n.signOut}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
