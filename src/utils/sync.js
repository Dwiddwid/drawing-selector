// Cross-tab state sync + draw trigger for multi-display mode.
//
// All messages travel over the single trigger channel from platform.js (which
// already handles the web BroadcastChannel vs. portable file:// localStorage
// transports). Messages are typed objects:
//
//   { v: 1, type: 'trigger' }                                  — start a draw
//   { v: 1, type: 'manual-trigger', targetId }                 — start a draw
//     that lands on a specific participant
//   { v: 1, type: 'stop' }                                     — stop an
//     in-progress 'manual'-timed draw (admin presses Stop)
//   { v: 1, type: 'sync', scope: 'participants' | 'settings' } — "re-read this
//     store from localStorage"
//
// Sync messages carry no payload: localStorage is the source of truth and the
// message is just a poke to reload. Anything that isn't a typed object (e.g.
// the legacy 'Go!' string from a pre-update tab) is normalized to a trigger.
//
// Neither transport echoes a message back to the tab that posted it, so
// senders never react to their own writes — no loop guard needed.
import { createTriggerChannel } from './platform.js'

let channel = null
let listening = false
const handlers = new Set()

function getChannel() {
  if (!channel) channel = createTriggerChannel()
  return channel
}

export function normalizeChannelMessage(data) {
  if (data && typeof data === 'object' && typeof data.type === 'string') return data
  return { v: 0, type: 'trigger' }
}

export function postTrigger() {
  getChannel()?.postMessage({ v: 1, type: 'trigger' })
}

export function postManualTrigger(targetId) {
  getChannel()?.postMessage({ v: 1, type: 'manual-trigger', targetId })
}

// Tell the drawing screen to stop an in-progress 'manual'-timed draw, so it
// decelerates to the winner. Paired with the admin window's Stop button.
export function postStop() {
  getChannel()?.postMessage({ v: 1, type: 'stop' })
}

export function broadcastSync(scope) {
  getChannel()?.postMessage({ v: 1, type: 'sync', scope })
}

// Subscribe to incoming channel messages (already normalized). Multiple
// subscribers share the one channel; returns an unsubscribe function.
export function onChannelMessage(handler) {
  handlers.add(handler)
  const ch = getChannel()
  if (ch && !listening) {
    listening = true
    ch.onMessage((data) => {
      const msg = normalizeChannelMessage(data)
      for (const h of [...handlers]) h(msg)
    })
  }
  return () => handlers.delete(handler)
}

// Tear down the shared channel (used by tests between transport stubs).
export function closeSyncChannel() {
  channel?.close()
  channel = null
  listening = false
  handlers.clear()
}
