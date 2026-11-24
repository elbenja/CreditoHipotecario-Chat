import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export interface DemoConfig {
  /** Chat turns one demo token may spend. */
  turns: number;
  /** Chat turns all demo tokens together may spend per UTC day. */
  dailyTurns: number;
  /** Demo tokens one client IP may mint per UTC day. */
  sessionsPerIp: number;
  /** Injectable clock so tests can cross midnight. */
  now?: () => number;
}

// A public demo lets a reviewer try the chat without the password, under a
// hard cap because every turn spends the model key. Tokens are signed like
// the access token (stateless to verify), but under a different label, so a
// demo token can never equal the full-access one. Usage lives in memory: a
// restart forgets it, and one instance is assumed.
export function createDemo(password: string, config: DemoConfig) {
  const now = config.now ?? Date.now;
  const key = createHmac('sha256', password).update('dito-demo-v1').digest();
  const sign = (id: string) => createHmac('sha256', key).update(id).digest('hex');

  let day = '';
  let spent = 0;
  const used = new Map<string, number>();
  const minted = new Map<string, number>();

  // Every counter starts over when the UTC day changes.
  function rollover() {
    const today = new Date(now()).toISOString().slice(0, 10);
    if (today === day) return;
    day = today;
    spent = 0;
    used.clear();
    minted.clear();
  }

  return {
    /** A fresh token, or null when the daily budget or this IP's quota is spent. */
    mint(ip: string): { token: string; remaining: number } | null {
      rollover();
      const count = minted.get(ip) ?? 0;
      if (spent >= config.dailyTurns || count >= config.sessionsPerIp) return null;
      minted.set(ip, count + 1);
      const id = randomUUID();
      return { token: `demo.${id}.${sign(id)}`, remaining: config.turns };
    },

    /** The token's id when the bearer header holds a validly signed demo token. */
    verify(header: string | undefined): string | null {
      const match = /^Bearer demo\.([^.]+)\.([^.]+)$/.exec(header ?? '');
      if (!match) return null;
      const id = match[1]!;
      const want = Buffer.from(sign(id));
      const got = Buffer.from(match[2]!);
      return want.length === got.length && timingSafeEqual(want, got) ? id : null;
    },

    /**
     * Count one turn for this token. Returns the turns it has left afterwards,
     * or null when the token or the day's budget is spent. An id the server
     * doesn't remember (it restarted) starts with a full allowance.
     */
    spend(id: string): number | null {
      rollover();
      const count = used.get(id) ?? 0;
      if (count >= config.turns || spent >= config.dailyTurns) return null;
      used.set(id, count + 1);
      spent += 1;
      return config.turns - count - 1;
    },
  };
}

export type Demo = ReturnType<typeof createDemo>;
