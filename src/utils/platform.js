// Runtime environment helpers.
//
// The portable "Offline Edition" (a single self-contained index.html, built via
// `npm run build:portable`) is opened directly from disk with the `file://`
// protocol — e.g. from a USB stick at a no-network venue. A few browser APIs
// behave differently there, so detect it once and adapt.

export function isPortable() {
  return typeof window !== 'undefined' && window.location?.protocol === 'file:'
}

const TRIGGER_KEY = 'drawing_trigger'

// A cross-tab trigger channel for multi-display mode (the admin tab tells the
// projector tab to start a draw). Two transports, one interface:
//
// - Normal web/PWA: BroadcastChannel — purpose-built for same-origin cross-tab
//   messaging.
// - Portable file://: BroadcastChannel can't be used because every file:// page
//   has a distinct opaque origin, so a channel in one tab never reaches another.
//   The classic localStorage + `storage` event pattern *does* propagate between
//   file:// tabs of the same document, so fall back to that. A unique nonce per
//   message guarantees the value always changes (and thus always fires the
//   event, even for two identical triggers in a row).
//
// Returned shape: { postMessage(data), onMessage(handler), close() }.
export function createTriggerChannel() {
  if (typeof window === 'undefined') return null

  if (!isPortable() && typeof BroadcastChannel !== 'undefined') {
    const bc = new BroadcastChannel(TRIGGER_KEY)
    return {
      postMessage: (data) => bc.postMessage(data),
      onMessage: (handler) => {
        bc.onmessage = (event) => handler(event.data)
      },
      close: () => bc.close(),
    }
  }

  // localStorage-event fallback (portable / no BroadcastChannel).
  let listener = null
  const onStorage = (event) => {
    if (event.key !== TRIGGER_KEY || event.newValue == null) return
    try {
      listener?.(JSON.parse(event.newValue).data)
    } catch {
      listener?.(event.newValue)
    }
  }
  window.addEventListener('storage', onStorage)
  return {
    postMessage: (data) => {
      // Nonce ensures the stored string differs every time so the `storage`
      // event always fires in the other tab(s).
      localStorage.setItem(TRIGGER_KEY, JSON.stringify({ data, nonce: Date.now() + Math.random() }))
    },
    onMessage: (handler) => {
      listener = handler
    },
    close: () => window.removeEventListener('storage', onStorage),
  }
}
