// Runtime environment helpers.
//
// The portable "Offline Edition" (a single self-contained index.html, built via
// `npm run build:portable`) is opened directly from disk with the `file://`
// protocol — e.g. from a USB stick at a no-network venue. A few browser APIs
// behave differently there, so detect it once and degrade gracefully.

export function isPortable() {
  return typeof window !== 'undefined' && window.location?.protocol === 'file:'
}

// BroadcastChannel powers multi-display mode (admin device triggers a draw on a
// separate projector tab). Under `file://` every document has an opaque `null`
// origin that never matches another, so cross-tab messaging silently fails —
// and the API may be absent in some embedded contexts. Return `null` there so
// callers can fall back to single-screen operation.
export function createTriggerChannel() {
  if (isPortable() || typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel('drawing_trigger')
}
