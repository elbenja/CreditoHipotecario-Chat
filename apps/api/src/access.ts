import { createHmac, timingSafeEqual } from 'node:crypto';

// The prototype sits behind one shared password (PASSWORD_DITO). Unlocking
// hands the browser a token derived from that password, so the server keeps
// no session state, and changing the password logs everyone out.
export function accessToken(password: string): string {
  return createHmac('sha256', password).update('dito-access-v1').digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Same leniency as the design: surrounding spaces and case don't matter. */
export function checkPassword(given: unknown, password: string): boolean {
  if (typeof given !== 'string') return false;
  return safeEqual(given.trim().toLowerCase(), password.trim().toLowerCase());
}

export function checkBearer(header: string | undefined, password: string): boolean {
  const token = /^Bearer (.+)$/.exec(header ?? '')?.[1];
  return token !== undefined && safeEqual(token, accessToken(password));
}
