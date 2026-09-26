// Page switcher for the Claude Design exports under /disenos/ — a fixed
// dropdown, like the file picker in Claude Design. Lives outside <x-dc>,
// so the dc runtime (which replaces <x-dc>) leaves it alone.
(() => {
  const PAGES = [
    ['/disenos/datos-fijados/', 'Chat IA + Datos fijados'],
    ['/disenos/errores-y-mobile/', 'Chat IA - Errores y Mobile'],
    ['/disenos/micro-interacciones/', 'Chat IA - Micro-interacciones chat'],
  ];
  const here = location.pathname.replace(/index\.html$/, '').replace(/\/?$/, '/');

  const css = document.createElement('style');
  css.textContent = `
    #ds-nav{position:fixed;top:10px;right:12px;z-index:9999;display:flex;align-items:center;gap:8px;
      padding:5px 6px 5px 10px;border-radius:9999px;background:#0b0f1a;border:1px solid #1e293b;
      box-shadow:0 6px 20px rgba(0,0,0,.18);font:500 12.5px 'Inter',system-ui,sans-serif}
    #ds-nav img{width:15px;height:15px;display:block}
    #ds-nav select{appearance:none;-webkit-appearance:none;background:#1e293b url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 10px center;
      color:#f1f5f9;border:1px solid #334155;border-radius:9999px;padding:5px 28px 5px 12px;font:inherit;cursor:pointer;
      transition:border-color 180ms cubic-bezier(.2,.7,.2,1)}
    #ds-nav select:hover{border-color:#64748b}
    #ds-nav select:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(244,188,68,.35)}`;
  document.head.appendChild(css);

  const nav = document.createElement('nav');
  nav.id = 'ds-nav';
  nav.setAttribute('aria-label', 'Páginas de diseño');
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Página');
  for (const [href, label] of PAGES) {
    if (href === here) document.title = label + ' · Diseños';
    const opt = new Option(label, href, false, href === here);
    select.add(opt);
  }
  select.addEventListener('change', () => { location.href = select.value; });
  const logo = document.createElement('img');
  logo.src = '/disenos/assets/logo-mark.svg';
  logo.alt = '';
  nav.append(logo, select);
  document.body.appendChild(nav);
})();
