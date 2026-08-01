<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { ANIMATION_TIMING, decelTailMs } from '../stores/participants.js'

// One self-contained slot-machine pane for the simultaneous multi-winner
// reveal. The store's runSpinAnimation drives a single shared pointer, so it
// can't animate several panes at once — this component reuses the same timing
// curve (ANIMATION_TIMING.classic + decel tail) with local state instead.
// Visual cycling is random; the pre-picked winner is shown when the pane
// settles, mirroring the store loop's honest-reveal behavior.
const props = defineProps({
  names: { type: Array, required: true }, // display names to cycle through
  winnerName: { type: String, required: true },
  active: { type: Boolean, default: false }, // flips true to start the spin
  // Total spin length. Infinity = 'manual': cycle until stopRequested flips.
  durationMs: { type: Number, default: 4500 },
  stopRequested: { type: Boolean, default: false },
})
const emit = defineEmits(['done'])

const current = ref('')
const running = ref(false)
let timer = 0
let stopFlagged = false

function start() {
  const timing = ANIMATION_TIMING.classic
  running.value = true
  stopFlagged = false
  const manual = !Number.isFinite(props.durationMs)
  const fastMs = Math.max(timing.baseDelay, props.durationMs - decelTailMs(timing))
  const fastTicks = manual ? Infinity : Math.max(1, Math.round(fastMs / timing.baseDelay))
  let i = 0
  let delay = timing.baseDelay
  let decelerating = false

  const tick = () => {
    const pool = props.names
    current.value = pool.length ? pool[Math.floor(Math.random() * pool.length)] : ''
    i += 1
    if (!decelerating && (manual ? stopFlagged : i >= fastTicks)) {
      decelerating = true
    }
    if (decelerating) {
      delay += timing.step
    }
    if (delay < timing.maxDelay) {
      timer = setTimeout(tick, delay)
    } else {
      current.value = props.winnerName
      running.value = false
      emit('done')
    }
  }

  timer = setTimeout(tick, delay)
}

watch(
  () => props.active,
  (on) => {
    if (on) start()
    else clearTimeout(timer)
  },
  { immediate: true },
)
watch(
  () => props.stopRequested,
  (v) => {
    if (v) stopFlagged = true
  },
)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <v-card round class="winner-card slot-pane" elevation="8">
    <v-card-text>
      <div class="slot-name" :class="{ spinning: running }">
        {{ current || '…' }}
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.slot-pane {
  background: var(--app-winner-card-bg, rgb(var(--v-theme-surface)));
  color: var(--app-winner-card-text, rgb(var(--v-theme-primary)));
  min-width: clamp(12rem, 24vw, 22rem);
}
.slot-name {
  font-size: clamp(1.25rem, 4.5vmin, 3rem);
  line-height: 1.15;
  text-align: center;
  overflow-wrap: anywhere;
  color: var(--app-winner-card-text, rgb(var(--v-theme-primary)));
}
</style>
