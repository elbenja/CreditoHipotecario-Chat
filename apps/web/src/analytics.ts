/**
 * Event-only GoatCounter. No count.js: it always appends `location.search`
 * and screen width, and would count page views unless told not to. We hit
 * the /count endpoint ourselves with a fixed path and title and nothing else
 * — no prompts, figures, ids, URLs or referrers.
 *
 * Unset endpoint, an ad blocker or a network failure: nothing happens.
 */
const ENDPOINT = import.meta.env?.VITE_GOATCOUNTER_URL ?? '';

const EVENTS = {
  'chat-opened': 'Chat opened',
  'chat-first-question': 'Chat first question',
} as const;

export type AnalyticsEvent = keyof typeof EVENTS;

export function track(event: AnalyticsEvent) {
  if (!ENDPOINT) return;
  try {
    const params = new URLSearchParams({
      p: event,
      t: EVENTS[event],
      e: 'true',
      // Stops the browser serving a cached response instead of counting.
      rnd: Math.random().toString(36).slice(2, 7),
    });
    void fetch(`${ENDPOINT}?${params}`, {
      method: 'GET',
      mode: 'no-cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never break the app.
  }
}
