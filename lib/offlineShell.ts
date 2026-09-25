/** Explicitly pin loaded JS/CSS and the entry page in the app's service-worker cache. */
export async function saveOfflineShell(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('caches' in window)) return false;
  try {
    const ready = await Promise.race([navigator.serviceWorker.ready, new Promise<null>(r => setTimeout(() => r(null), 8000))]);
    if (!ready?.active) return false;
    // Inline-loaded chunks aren't in script tags; PerformanceResourceTiming includes them.
    const paths = [...new Set(['/', ...[...document.querySelectorAll('script[src],link[rel="stylesheet"][href],link[rel="modulepreload"][href]')].map(x => (x as HTMLScriptElement).src || (x as HTMLLinkElement).href),
      ...performance.getEntriesByType('resource').map(x => x.name)].filter(Boolean))].filter(x => {
        const u = new URL(x, location.origin); return u.origin === location.origin && (u.pathname === '/' || u.pathname.startsWith('/_next/static/'));
      });
    const channel = new MessageChannel();
    return await Promise.race([new Promise<boolean>(resolve => { channel.port1.onmessage = e => resolve(e.data?.ok === true); ready.active!.postMessage({ type: 'SAVE_OFFLINE_SHELL', paths }, [channel.port2]); }), new Promise<boolean>(r => setTimeout(() => r(false), 20000))]);
  } catch { return false; }
}
