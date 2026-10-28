import { useState, type FormEvent } from 'react';
import { grantAccess, requestUnlock } from '../api/access';
import { Icon } from '../components/Icon';

// Claude Design: "Prototype Access.dc.html". The success line holds for 900ms
// before the app opens, as in the design.
const OPEN_DELAY_MS = 900;

// Only what the prototype does today: one conversation per property, no
// accounts, so nothing here promises saved history or the user's own data.
const FEATURES = [
  { icon: 'bubble-chat', text: 'Describe the apartment in your own words, or paste a listing link' },
  { icon: 'pin', text: 'Price, rate and down payment pinned as you talk, and editable' },
  { icon: 'money-bag-02', text: 'Monthly payment, rent and yield, worked out for you' },
];

export function AccessGate() {
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [state, setState] = useState<'idle' | 'checking' | 'wrong' | 'network' | 'ok'>('idle');

  async function unlock(e: FormEvent) {
    e.preventDefault();
    if (state === 'checking' || state === 'ok') return;
    setState('checking');
    const result = await requestUnlock(pw);
    if (!result.ok) {
      setState(result.reason);
      return;
    }
    setState('ok');
    setTimeout(() => grantAccess(result.token), OPEN_DELAY_MS);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#020617] font-inter text-[#f8fafc]">
      <header className="flex items-center justify-center px-5 pb-2 pt-8">
        <div className="flex items-center gap-[10px]">
          <img src="/assets/logo-mark.svg" alt="" className="h-8 w-8" />
          <span className="font-jakarta text-[20px] font-extrabold tracking-[-0.03em]">créditohipotecar.io</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-wrap items-center justify-center gap-16 px-5 pb-16 pt-10">
        <section className="flex max-w-[460px] flex-[1_1_380px] flex-col gap-6 rounded-2xl border border-[#1e293b] bg-[#0f172a] p-[clamp(24px,5vw,40px)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(244,188,68,0.15)] text-ch-accent">
            <Icon name="square-lock-02" size={24} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="m-0 font-jakarta text-[32px] font-bold leading-tight tracking-[-0.025em] text-[#f8fafc]">
              Private prototype
            </h1>
            <p className="m-0 text-[15px] leading-normal text-slate-400 [text-wrap:pretty]">
              Enter the password you were given to open the prototype.
            </p>
          </div>

          <form onSubmit={unlock} className="flex flex-col gap-[18px]">
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Password
              <span className="relative flex">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw}
                  onChange={(e) => {
                    setPw(e.target.value);
                    if (state === 'wrong' || state === 'network') setState('idle');
                  }}
                  placeholder="••••••••"
                  autoFocus
                  autoComplete="current-password"
                  aria-invalid={state === 'wrong'}
                  className={`h-11 flex-1 rounded-[10px] border bg-[#020617] pl-[14px] pr-11 text-[15px] text-[#f8fafc] outline-none placeholder:text-slate-500 focus:border-ch-accent focus:shadow-[0_0_0_3px_rgba(244,188,68,0.25)] ${state === 'wrong' ? 'border-[#ef4444]' : 'border-[#1e293b]'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center border-0 bg-transparent text-slate-400"
                >
                  <Icon name={showPw ? 'view-off' : 'view'} size={18} />
                </button>
              </span>
            </label>

            {state === 'wrong' && (
              <span role="alert" className="flex items-center gap-[6px] text-[13px] text-[#ef4444]">
                <Icon name="alert-circle" />
                Incorrect password. Please try again.
              </span>
            )}
            {state === 'network' && (
              <span role="alert" className="flex items-center gap-[6px] text-[13px] text-[#f59e0b]">
                <Icon name="alert-02" />
                Couldn't reach the server. Please try again.
              </span>
            )}
            {state === 'ok' && (
              <span role="status" className="flex items-center gap-[6px] text-[13px] text-[#22c55e]">
                <Icon name="checkmark-circle-02" />
                Access granted. Opening prototype…
              </span>
            )}

            <button
              type="submit"
              disabled={state === 'checking'}
              className="flex h-[46px] items-center justify-center gap-2 rounded-lg border-0 bg-[#f8fafc] text-[15px] font-semibold text-[#020617] hover:opacity-90 active:translate-y-px active:opacity-85 disabled:opacity-60"
            >
              Unlock
              <Icon name="arrow-right-01" />
            </button>
          </form>

          <p className="m-0 border-t border-[#1e293b] pt-5 text-[13px] leading-normal text-slate-400">
            Don't have a password? Ask the person who shared this link with you.
          </p>
        </section>

        <aside className="flex max-w-[460px] flex-[1_1_380px] flex-col gap-7">
          <div className="flex flex-col gap-[14px]">
            <span className="flex h-[30px] items-center gap-2 self-start rounded-full border border-[#1e293b] bg-[#0f172a] px-3 text-[13px] font-medium text-slate-300">
              <span className="h-[6px] w-[6px] rounded-full bg-ch-accent" />
              Prototype · AI Chat
            </span>
            <h2 className="m-0 font-jakarta text-[clamp(32px,4.2vw,44px)] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#f8fafc] [text-wrap:pretty]">
              Ask anything about your <span className="text-ch-accent">mortgage</span>.
            </h2>
            <p className="m-0 text-base leading-[1.55] text-slate-400 [text-wrap:pretty]">
              An AI assistant for buying property in Peru. It answers in plain language and runs the numbers on the
              apartment you're evaluating.
            </p>
          </div>
          <ul className="m-0 flex list-none flex-col gap-[14px] p-0 text-[15px] text-slate-300">
            {FEATURES.map((f) => (
              <li key={f.icon} className="flex items-center gap-3">
                <Icon name={f.icon} size={20} className="text-slate-400" />
                {f.text}
              </li>
            ))}
          </ul>
        </aside>
      </main>

      <footer className="flex justify-center border-t border-[#1e293b] px-[clamp(20px,4vw,40px)] py-5 text-[13px] text-slate-500">
        Confidential — for review purposes only
      </footer>
    </div>
  );
}
