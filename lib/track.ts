import type { EventName } from './events';
/** Client side: fire-and-forget, survives page unload, sends nothing but the event name. */
export function track(name: EventName) {
  try {
    if (navigator.sendBeacon?.('/api/event', name)) return;
    fetch('/api/event', { method: 'POST', body: name, keepalive: true }).catch(() => {});
  } catch { /* ignore */ }
}
