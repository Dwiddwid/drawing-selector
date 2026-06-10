import { watch } from 'vue'
import { onChannelMessage } from '../utils/sync.js'
import { useParticipantStore } from '../stores/participants.js'
import { useSettingsStore } from '../stores/settings.js'

// Keep this window's stores in sync with changes made in other tabs (admin ↔
// projector). On a 'sync' message the named store re-reads localStorage, so
// candidate edits, filter changes and theme tweaks show up live — and the
// admin's Winners list updates the moment the projector commits a draw.
//
// Reloads are deferred while a draw animation is running: the wheel flow holds
// a pre-picked index into `candidates`, so replacing the array mid-spin could
// commit the wrong person, and a settings reload could tear down the running
// animation component. Queued scopes apply as soon as the spin ends.
export function useStoreSync() {
  const store = useParticipantStore()
  const settings = useSettingsStore()
  const pending = new Set()

  function apply(scope) {
    if (scope === 'settings') settings.loadFromStorage()
    else store.loadFromStorage()
  }

  const unsubscribe = onChannelMessage((msg) => {
    if (msg.type !== 'sync') return
    if (store.spinning) {
      pending.add(msg.scope)
      return
    }
    apply(msg.scope)
  })

  watch(
    () => store.spinning,
    (spinning) => {
      if (spinning || pending.size === 0) return
      for (const scope of pending) apply(scope)
      pending.clear()
    },
  )

  return unsubscribe
}
