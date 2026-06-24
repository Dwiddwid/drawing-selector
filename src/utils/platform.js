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

// How often the portable receiver re-reads localStorage as a fallback for a
// missed `storage` event (see below). 300 ms is imperceptible for a "Select
// winner" click but keeps the poll cheap.
const POLL_INTERVAL_MS = 300

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
//   Safari caveat: after the projector window reloads, Safari stops dispatching
//   the `storage` event to the freshly-loaded file:// document (the value still
//   lands in localStorage and is shared between the windows — only the event
//   notification is dropped). So the receiver *also* polls the stored value on a
//   short interval; whichever of the event or the poll first sees a new nonce
//   delivers it, and the nonce guard de-dups the other.
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

  // localStorage-event + polling fallback (portable / no BroadcastChannel).
  let listener = null
  let pollId = null

  // Parse a stored value into { data, nonce }. Every value we write is a
  // JSON-encoded { data, nonce }; the bare-string branch is purely defensive
  // (no shipped build has ever written a non-JSON value here) and treats the
  // string as both its own data and nonce.
  const parse = (raw) => {
    if (raw == null) return null
    try {
      const obj = JSON.parse(raw)
      if (obj && typeof obj === 'object' && 'nonce' in obj) return obj
      return { data: obj, nonce: raw }
    } catch {
      return { data: raw, nonce: raw }
    }
  }

  // Baseline: ignore whatever trigger is already sitting in localStorage when
  // this channel is created, so a reload doesn't replay the last draw's value.
  let lastNonce = parse(localStorage.getItem(TRIGGER_KEY))?.nonce ?? null

  const deliver = (raw) => {
    const msg = parse(raw)
    if (!msg || msg.nonce === lastNonce) return
    lastNonce = msg.nonce
    listener?.(msg.data)
  }

  const onStorage = (event) => {
    if (event.key !== TRIGGER_KEY) return
    deliver(event.newValue)
  }
  window.addEventListener('storage', onStorage)

  return {
    postMessage: (data) => {
      // Nonce ensures the stored string differs every time so the `storage`
      // event always fires in the other tab(s). Recording it as lastNonce first
      // keeps our own poll from looping the message back to our own listener.
      const nonce = Date.now() + Math.random()
      lastNonce = nonce
      localStorage.setItem(TRIGGER_KEY, JSON.stringify({ data, nonce }))
    },
    onMessage: (handler) => {
      listener = handler
      // Only the receiving side registers a handler, so start the poll here.
      if (pollId == null) {
        pollId = setInterval(() => deliver(localStorage.getItem(TRIGGER_KEY)), POLL_INTERVAL_MS)
      }
    },
    close: () => {
      window.removeEventListener('storage', onStorage)
      if (pollId != null) {
        clearInterval(pollId)
        pollId = null
      }
      listener = null
    },
  }
}
