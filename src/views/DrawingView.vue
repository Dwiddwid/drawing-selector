<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useParticipantStore } from '../stores/participants.js'
import { useSettingsStore, clampDrawCount } from '../stores/settings.js'
import { formatWinnerName, visibleWinnerFields } from '../utils/winnerDisplay.js'
import { onChannelMessage } from '../utils/sync.js'
import { resolveDrawDuration } from '../utils/drawTiming.js'
import { celebrate } from '../utils/celebration.js'
import { buildWheelSegments, wheelColorsFromTheme } from '../utils/wheel.js'
import WheelSpinner from '../components/WheelSpinner.vue'
import PriceIsRightWheel from '../components/PriceIsRightWheel.vue'
import SlotReveal from '../components/SlotReveal.vue'
import WinnerRoster from '../components/WinnerRoster.vue'

const store = useParticipantStore()
const settings = useSettingsStore()

// Both 'wheel' and 'wheel-giant' use the canvas-wheel reveal flow.
const isWheel = computed(
  () => settings.animationStyle === 'wheel' || settings.animationStyle === 'wheel-giant',
)
const isGiantWheel = computed(() => settings.animationStyle === 'wheel-giant')
// 'reel' is the Price Is Right wheel viewed on edge — a giant vertical drum of
// names. Same honest pre-pick reveal flow, its own component.
const isPriceWheel = computed(() => settings.animationStyle === 'reel')
// Styles that take over the whole viewport (full-bleed backdrop + overlay layer)
// rather than sitting as a centered element with branding stacked around it.
const isFullViewport = computed(() => isGiantWheel.value || isPriceWheel.value)

// Wheel-spin state. The visual wheel needs to know the winner before the
// pointer can land on them, so for that style we pre-pick from the store,
// render the wheel, and commit only after the rotation eases to a stop.
const wheelActive = ref(false)
const wheelSegments = ref([])
const wheelWinnerSegmentIdx = ref(-1)
const pendingWinnerIdx = ref(-1)

// Multi-winner batch state. Every draw runs through the batch orchestrator —
// a single draw is just a batch of 1. `batchRunning` is the real reentrancy
// guard: between sequential spins `store.spinning` is briefly false, so GO /
// keyboard / channel triggers must gate on this instead.
const batchRunning = ref(false)
const batchTotal = ref(1)
const batchDrawn = ref(0)
const batchShortfall = ref(0) // > 0 when the pool ran out before batchTotal
// How long each revealed winner stays up before the next spin starts.
const BATCH_REVEAL_HOLD_MS = 2500
// In 'manual' timing, one Stop press ends the current free-spin; the remaining
// spins in the batch run at this fixed length (the admin's Start/Stop button is
// a local toggle with no feedback channel, so stop-per-spin would desync it).
const BATCH_FALLBACK_SPIN_MS = 4500

// Simultaneous reveal: several spinners run side by side, one per winner.
// Supported for the classic card and the standard wheel; the giant wheel and
// reel are full-viewport, so they always reveal sequentially. Caps keep the
// panes legible on a projector.
const SIMUL_CAPS = { classic: 8, wheel: 4 }
const simulActive = ref(false)
const simulPanes = ref([]) // [{ id, kind: 'wheel'|'slot', ... }]
const simulPaneSize = ref(320)
const simulNames = ref([]) // display names the slot panes cycle through
let simulDoneCount = 0
let simulResolve = null

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// This draw's resolved animation length (ms), decided once per draw on the
// screen that runs the animation. Infinity = 'manual' (free-spin until stopped).
const drawDurationMs = ref(4200)
// Flips true when the operator presses Stop (admin window) during a 'manual'
// draw — passed to the wheel components and mirrored to the store for classic.
const manualStopRequested = ref(false)

// A draw can only run when the (filtered) pool has at least one entry. The store
// refuses to spin when totalEntries is 0 — e.g. a Draw Filter that excludes
// everyone, or all remaining candidates having 0 entries — so GO! and the
// keyboard trigger gate on this, not on the raw candidate count.
const canDraw = computed(() => store.totalEntries > 0)

// When a draw can't run, say *why*: an empty pool needs a CSV import, whereas a
// non-empty pool with no drawable entries is the result of a Draw Filter (or
// every remaining candidate sitting at 0 entries).
const emptyMessage = computed(() =>
  store.candidates.length === 0
    ? 'No participants loaded — import a CSV first.'
    : 'No candidates match the current draw filter.',
)

// Manual timing is stopped only from the admin window (there is no Stop control
// on this screen by design). Without a separate admin window (multi-display),
// a manual free-spin could never be stopped — so block starting one here.
const manualNeedsAdmin = computed(
  () => settings.drawTiming.mode === 'manual' && !store.useMultiDisplayMode,
)
// Whether the local GO! button / keyboard may start a draw.
const canStart = computed(() => canDraw.value && !manualNeedsAdmin.value)
// Why a local start is blocked (shown beneath GO!). The manual-needs-admin
// reason takes precedence over an empty pool.
const startHint = computed(() => {
  if (manualNeedsAdmin.value) {
    return 'Manual stop timing is controlled from the admin window — enable multi-display mode to start and stop draws.'
  }
  return canDraw.value ? '' : emptyMessage.value
})

const participantLabel = (c) => formatWinnerName(c, settings.winnerDisplay) || '(no name)'

// One classic (slot-machine) spin through the store's shared animation loop.
// Resolves true once the winner is committed; false when the spin can't start
// (empty/exhausted pool).
function spinOnceClassic(durationMs, targetId = null) {
  return new Promise((resolve) => {
    const opts = { durationMs, onDone: () => resolve(true) }
    const ok = targetId
      ? store.selectSpecificCandidate(targetId, settings.animationStyle, opts)
      : store.selectRandomCandidate(settings.animationStyle, opts)
    if (!ok) resolve(false)
  })
}

// One wheel/reel spin via the honest pre-pick flow. Segments are rebuilt from
// the *current* pool every time — each commit reshuffles `candidates`, so a
// batch's later spins must not reuse the previous spin's segments.
let wheelDoneResolver = null
async function spinOnceWheel(durationMs, targetId = null) {
  if (!store.beginVisualSpin()) return false
  const idx = targetId
    ? store.candidates.findIndex((c) => c.id === targetId)
    : store.pickWinnerIndex()
  if (idx < 0) {
    // Pool emptied between the check and the pick — bail cleanly.
    store.commitAt(-1)
    return false
  }
  pendingWinnerIdx.value = idx
  // The giant wheel shows every candidate (names scroll past), so don't cap
  // the segment count; the standard wheel keeps the default cap.
  const opts = isGiantWheel.value
    ? { max: store.candidates.length, label: participantLabel }
    : { label: participantLabel }
  const { segments, winnerSegmentIdx } = buildWheelSegments(store.candidates, idx, opts)
  wheelSegments.value = segments
  wheelWinnerSegmentIdx.value = winnerSegmentIdx
  // Let the component rebuild its wheel bitmap from the new segments before
  // the spin starts, or a batch's later spins animate the stale wheel.
  await nextTick()
  wheelActive.value = true
  await new Promise((resolve) => { wheelDoneResolver = resolve })
  return true
}

function onWheelDone() {
  wheelActive.value = false
  if (pendingWinnerIdx.value >= 0) {
    store.commitAt(pendingWinnerIdx.value)
    pendingWinnerIdx.value = -1
  }
  wheelDoneResolver?.()
  wheelDoneResolver = null
}

// Whether a batch of `n` can reveal all winners at once (side-by-side panes).
function canRunSimultaneous(n, targetId) {
  if (n <= 1 || targetId) return false
  if (settings.multiWinnerReveal !== 'simultaneous') return false
  const cap = SIMUL_CAPS[settings.animationStyle]
  return Boolean(cap) && n <= cap
}

function onPaneDone() {
  simulDoneCount += 1
  if (simulDoneCount >= simulPanes.value.length) {
    simulResolve?.()
    simulResolve = null
  }
}

// Simultaneous reveal: pre-pick all (distinct) winners, run one pane per
// winner, and commit them together when the last pane settles. Slightly
// jittered durations keep the panes from stopping in eerie lockstep.
async function runSimultaneous(n) {
  const ids = store.pickWinnerIds(n)
  if (ids.length === 0) {
    batchShortfall.value = n
    return
  }
  batchShortfall.value = n - ids.length
  if (!store.beginVisualSpin()) return
  const durationMs = resolveDrawDuration(settings.drawTiming)
  drawDurationMs.value = durationMs
  const jitter = (ms) =>
    Number.isFinite(ms) ? Math.round(ms * (0.95 + Math.random() * 0.1)) : ms
  const isWheelStyle = settings.animationStyle === 'wheel'
  if (isWheelStyle) {
    const cols = ids.length <= 2 ? ids.length : Math.ceil(ids.length / 2)
    const available = Math.floor((window.innerWidth - 32) / cols) - 24
    simulPaneSize.value = Math.max(220, Math.min(settings.spinner.size, available))
  }
  // Slot panes cycle through the pre-draw pool's names (all panes share it).
  simulNames.value = store.drawableCandidates.map(participantLabel)
  simulPanes.value = ids.map((id) => {
    if (isWheelStyle) {
      const idx = store.candidates.findIndex((c) => c.id === id)
      const { segments, winnerSegmentIdx } = buildWheelSegments(store.candidates, idx, {
        label: participantLabel,
      })
      return { id, kind: 'wheel', segments, winnerSegmentIdx, durationMs: jitter(durationMs) }
    }
    const winner = store.candidates.find((c) => c.id === id)
    return { id, kind: 'slot', winnerName: participantLabel(winner), durationMs: jitter(durationMs) }
  })
  simulDoneCount = 0
  await nextTick()
  simulActive.value = true
  await new Promise((resolve) => { simulResolve = resolve })
  // Commit by id — each commit reshuffles candidate indices, ids stay stable.
  for (const id of ids) store.commitWinnerById(id)
  store.endVisualSpin()
  simulActive.value = false
  simulPanes.value = []
  batchDrawn.value = ids.length
  celebrateReveal(true)
}

// Batch orchestrator — every draw goes through here (a single draw is a batch
// of 1). Sequential mode runs the spins back to back with a hold between
// reveals; simultaneous mode delegates to runSimultaneous().
async function startDraw(count = 1, targetId = null) {
  if (batchRunning.value || store.spinning || wheelActive.value) return
  // A single-window manual draw has no way to be stopped (Stop is admin-only),
  // so refuse to start one. In multi-display this is false (the admin drives it).
  if (manualNeedsAdmin.value) return
  // Reload filters from localStorage so a separate projector window always
  // honors the admin's current Draw Filter selection. In single-window mode
  // the store is already up-to-date, so this is a cheap no-op in that case.
  store.loadFilters()
  const n = targetId ? 1 : clampDrawCount(count)
  batchRunning.value = true
  batchTotal.value = n
  batchDrawn.value = 0
  batchShortfall.value = 0
  manualStopRequested.value = false
  store.beginDrawBatch()
  try {
    if (canRunSimultaneous(n, targetId)) {
      await runSimultaneous(n)
      return
    }
    for (let i = 0; i < n; i += 1) {
      manualStopRequested.value = false
      // Decide this spin's length once, here on the screen that runs the
      // animation, so random durations and manual stop are resolved in
      // exactly one place. Only the batch's first spin free-runs in 'manual'
      // mode; the rest run a sane fixed length (see BATCH_FALLBACK_SPIN_MS).
      let durationMs = resolveDrawDuration(settings.drawTiming)
      if (i > 0 && !Number.isFinite(durationMs)) durationMs = BATCH_FALLBACK_SPIN_MS
      drawDurationMs.value = durationMs
      const spun = (isWheel.value || isPriceWheel.value)
        ? await spinOnceWheel(durationMs, targetId)
        : await spinOnceClassic(durationMs, targetId)
      if (!spun) {
        batchShortfall.value = n - i
        break
      }
      batchDrawn.value = i + 1
      celebrateReveal(i + 1 === n)
      if (i + 1 < n) await sleep(BATCH_REVEAL_HOLD_MS)
    }
  } finally {
    store.endDrawBatch()
    batchRunning.value = false
  }
}

// Cross-tab trigger for multi-display mode (sync messages are handled globally
// by useStoreSync in App.vue). Works on the web (BroadcastChannel) and in the
// portable file:// Offline Edition (localStorage-event fallback). Still falls
// back to this screen's own GO! button.
const unsubscribe = onChannelMessage((msg) => {
  if (msg.type === 'trigger') startDraw(clampDrawCount(msg.count))
  if (msg.type === 'manual-trigger') startDraw(1, msg.targetId)
  if (msg.type === 'stop') {
    // End a 'manual' draw: the wheel components watch this prop to settle; the
    // classic loop reads the store flag. Both ignore it when not free-spinning.
    manualStopRequested.value = true
    store.requestManualStop()
  }
})
onBeforeUnmount(() => unsubscribe())

// Keyboard / presentation-remote trigger: Space, Enter, and the keys most
// clickers send (ArrowRight / PageDown) start a draw on the projector. Disabled
// in multi-display mode (the admin window drives the draw there) and while a
// draw is already running or the pool is un-drawable.
const DRAW_KEYS = new Set([' ', 'Spacebar', 'Enter', 'ArrowRight', 'PageDown'])
function onKeydown(e) {
  if (!DRAW_KEYS.has(e.key)) return
  // Let a focused control handle its own activation (e.g. Space/Enter on the
  // GO! button) so we don't double-trigger the draw.
  const tag = e.target?.tagName
  if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (store.useMultiDisplayMode || store.spinning || wheelActive.value || batchRunning.value || !canStart.value) return
  e.preventDefault()
  startDraw(settings.drawCount)
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// Branding (logo + event title) is hidden while a draw is running so it never
// overlays the spinning wheel; it returns alongside the winner card. During a
// batch it stays hidden through the inter-spin holds too.
const introVisible = computed(
  () => !store.spinning && !wheelActive.value && !batchRunning.value,
)
const titleEnabled = computed(
  () => settings.theme.showEventTitle && Boolean(settings.theme.eventTitle),
)

// Wheel appearance from the spinner settings. Colors and pointer apply to both
// wheel styles; size/position/offsets only make sense for the standard wheel
// (the giant wheel is full-viewport by design).
const wheelColors = computed(() => {
  const s = settings.spinner
  if (s.colorMode === 'custom' && s.customColors.length) return s.customColors
  if (s.colorMode === 'theme') return wheelColorsFromTheme(settings.theme)
  return undefined // component default palette
})
const wheelStageStyle = computed(() => {
  const s = settings.spinner
  const style = {}
  if ((s.offsetX || 0) !== 0 || (s.offsetY || 0) !== 0) {
    style.transform = `translate(${s.offsetX || 0}px, ${s.offsetY || 0}px)`
  }
  if (s.position === 'left') style.alignSelf = 'flex-start'
  else if (s.position === 'right') style.alignSelf = 'flex-end'
  return style
})

const winnerName = computed(() =>
  store.selected ? formatWinnerName(store.selected, settings.winnerDisplay) : '',
)
const spinName = computed(() =>
  store.currentCandidate ? formatWinnerName(store.currentCandidate, settings.winnerDisplay) : '',
)
const detailRows = computed(() =>
  store.selected ? visibleWinnerFields(store.selected, settings.winnerDisplay) : [],
)

// End-of-batch roster: shown instead of the single winner card once a
// multi-winner draw has fully settled.
const rosterNames = computed(() =>
  store.lastDrawWinners.map((w) => formatWinnerName(w, settings.winnerDisplay) || '(no name)'),
)
const showRoster = computed(
  () =>
    rosterNames.value.length > 1 &&
    !batchRunning.value &&
    !store.spinning &&
    !wheelActive.value,
)
const shortfallNote = computed(() =>
  batchShortfall.value > 0
    ? `Pool ran out — drew ${store.lastDrawWinners.length} of ${batchTotal.value} winners.`
    : '',
)
// "Winner 2 of 5" while a sequential multi-winner batch is running.
const batchProgressText = computed(() =>
  batchRunning.value && batchTotal.value > 1 && !simulActive.value
    ? `Winner ${Math.min(batchDrawn.value + 1, batchTotal.value)} of ${batchTotal.value}`
    : '',
)

// Text equivalent of the (canvas-based, otherwise silent) reveal for assistive
// tech, surfaced through a polite aria-live region.
const drawStatus = computed(() => {
  if (store.spinning || wheelActive.value) return 'Drawing…'
  if (showRoster.value) return `Winners: ${rosterNames.value.join(', ')}`
  if (store.selected) return `Winner: ${winnerName.value}`
  return ''
})

// Fire confetti + chime exactly once per reveal (when `selected` transitions
// from null to a participant). Confetti is suppressed for viewers who've asked
// for reduced motion; the chime still plays (an audio cue, not motion).
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
// Fired explicitly by the batch orchestrator on each reveal (every draw path
// goes through startDraw). Intermediate reveals in a sequential batch get a
// smaller burst; the final reveal gets the full celebration.
function celebrateReveal(isFinal) {
  const confettiOn = settings.celebration.confetti && !prefersReducedMotion()
  celebrate({
    confetti: confettiOn ? { particleCount: isFinal ? 160 : 80 } : false,
    sound: settings.celebration.sound,
  })
}
</script>

<template>
  <v-main>
    <v-container fluid fill-height class="text-center d-flex flex-column align-center justify-center fill-height">
      <div class="sr-only" role="status">{{ drawStatus }}</div>
      <img
        v-if="settings.theme.logo && !isFullViewport && introVisible"
        :src="settings.theme.logo"
        alt="Event logo"
        class="event-logo mb-4"
      />
      <h1 v-if="titleEnabled && !isFullViewport && introVisible" class="event-title mb-4">
        {{ settings.theme.eventTitle }}
      </h1>

      <!-- Full-viewport reveals (giant wheel + Price Is Right vertical drum): a
           full-bleed backdrop with the title, status, winner card and GO button
           layered on top — edge to edge, no surrounding gaps. -->
      <template v-if="isFullViewport">
        <WheelSpinner
          v-if="isGiantWheel && wheelSegments.length"
          :segments="wheelSegments"
          :winner-segment-idx="wheelWinnerSegmentIdx"
          :active="wheelActive"
          :duration-ms="drawDurationMs"
          :stop-requested="manualStopRequested"
          :colors="wheelColors"
          :pointer-color="settings.spinner.pointerColor"
          :giant-zoom="settings.spinner.giantZoom"
          giant
          @done="onWheelDone"
        />
        <PriceIsRightWheel
          v-else-if="isPriceWheel && wheelSegments.length"
          :segments="wheelSegments"
          :winner-segment-idx="wheelWinnerSegmentIdx"
          :active="wheelActive"
          :duration-ms="drawDurationMs"
          :stop-requested="manualStopRequested"
          :colors="wheelColors"
          :pointer-color="settings.spinner.pointerColor"
          @done="onWheelDone"
        />

        <div class="giant-overlay">
          <div class="giant-top">
            <img
              v-if="settings.theme.logo && introVisible"
              :src="settings.theme.logo"
              alt="Event logo"
              class="event-logo mb-2"
            />
            <h1 v-if="titleEnabled && introVisible" class="event-title giant-text">
              {{ settings.theme.eventTitle }}
            </h1>
            <h1 v-if="store.spinning" class="font-weight-thin giant-text giant-headline">
              And the Winner Is...
            </h1>
            <h1 v-else-if="!store.selected" class="font-weight-thin giant-text giant-headline">
              Ready to start drawing!
            </h1>
            <div v-if="batchProgressText" class="giant-text batch-progress">
              {{ batchProgressText }}
            </div>
          </div>

          <transition name="winner-pop">
            <WinnerRoster
              v-if="showRoster && !wheelActive"
              :names="rosterNames"
              :note="shortfallNote"
              class="winner-overlay"
            />
            <v-card
              v-else-if="store.selected && !wheelActive"
              round
              class="winner-card winner-overlay"
              elevation="12"
            >
              <v-card-text class="overlay-content">
                <h2 class="overlay-name">{{ winnerName }}</h2>
                <div v-for="row in detailRows" :key="row.key" class="overlay-detail">
                  <template v-if="settings.winnerDisplay.showLabels">{{ row.label }}: </template
                  >{{ row.value }}
                </div>
              </v-card-text>
            </v-card>
          </transition>

          <v-btn
            v-if="!store.useMultiDisplayMode && !store.spinning && !batchRunning"
            :disabled="!canStart"
            variant="elevated"
            color="primary"
            class="giant-go go-btn"
            @click="startDraw(settings.drawCount)"
          >
            GO!
          </v-btn>

          <div
            v-if="startHint && !store.spinning && !store.selected"
            class="giant-empty"
          >
            {{ startHint }}
          </div>
        </div>
      </template>

      <!-- Simultaneous multi-winner reveal: one spinner pane per winner, side
           by side. Used by the classic and standard-wheel styles only. -->
      <template v-else-if="simulActive">
        <h1 class="display-3 font-weight-thin mb-4 event-title">
          And the Winner Is...
        </h1>
        <div class="simul-grid">
          <template v-for="pane in simulPanes" :key="pane.id">
            <WheelSpinner
              v-if="pane.kind === 'wheel'"
              :segments="pane.segments"
              :winner-segment-idx="pane.winnerSegmentIdx"
              :active="simulActive"
              :duration-ms="pane.durationMs"
              :stop-requested="manualStopRequested"
              :colors="wheelColors"
              :pointer-color="settings.spinner.pointerColor"
              :size="simulPaneSize"
              @done="onPaneDone"
            />
            <SlotReveal
              v-else
              :names="simulNames"
              :winner-name="pane.winnerName"
              :active="simulActive"
              :duration-ms="pane.durationMs"
              :stop-requested="manualStopRequested"
              @done="onPaneDone"
            />
          </template>
        </div>
      </template>

      <!-- Standard spinning wheel: centered, with the winner card overlaying
           the wheel's center once it stops. -->
      <template v-else-if="isWheel">
        <h1 v-if="store.spinning" class="display-3 font-weight-thin mb-4 event-title">
          And the Winner Is...
        </h1>
        <h1 v-else-if="!store.selected" class="display-3 font-weight-thin mb-4 event-title">
          Ready to start drawing!
        </h1>
        <div v-if="batchProgressText" class="text-medium-emphasis mb-2 batch-progress">
          {{ batchProgressText }}
        </div>

        <div class="wheel-stage" :style="wheelStageStyle">
          <WheelSpinner
            v-if="wheelSegments.length"
            :segments="wheelSegments"
            :winner-segment-idx="wheelWinnerSegmentIdx"
            :active="wheelActive"
            :duration-ms="drawDurationMs"
            :stop-requested="manualStopRequested"
            :colors="wheelColors"
            :pointer-color="settings.spinner.pointerColor"
            :size="settings.spinner.size"
            @done="onWheelDone"
          />

          <transition name="winner-pop">
            <!-- After a simultaneous draw there's no wheel on the stage, so the
                 roster sits in normal flow instead of overlaying the center. -->
            <WinnerRoster
              v-if="showRoster && !wheelActive"
              :names="rosterNames"
              :note="shortfallNote"
              :class="wheelSegments.length ? 'winner-overlay' : ''"
            />
            <v-card
              v-else-if="store.selected && !wheelActive"
              round
              class="winner-card"
              :class="wheelSegments.length ? 'winner-overlay' : ''"
              elevation="12"
            >
              <v-card-text class="overlay-content">
                <h2 class="overlay-name">{{ winnerName }}</h2>
                <div
                  v-for="row in detailRows"
                  :key="row.key"
                  class="overlay-detail"
                >
                  <template v-if="settings.winnerDisplay.showLabels">{{ row.label }}: </template
                  >{{ row.value }}
                </div>
              </v-card-text>
            </v-card>
          </transition>
        </div>

        <v-btn
          v-if="!store.useMultiDisplayMode && !store.spinning && !batchRunning"
          :disabled="!canStart"
          variant="elevated"
          color="primary"
          class="mt-6 go-btn"
          @click="startDraw(settings.drawCount)"
        >
          GO!
        </v-btn>

        <div
          v-if="startHint && !store.spinning && !store.selected"
          class="text-medium-emphasis mt-2"
        >
          {{ startHint }}
        </div>
      </template>

      <v-card
        v-else
        round
        class="mx-auto winner-card"
        :class="`animation-${settings.animationStyle}`"
        elevation="8"
      >
        <v-card-title>
          <h1 v-if="store.spinning" class="display-3 font-weight-thin">And the Winner Is...</h1>
          <h1 v-else-if="!store.selected" class="display-3 font-weight-thin">
            Ready to start drawing!
          </h1>
          <div v-if="batchProgressText" class="text-medium-emphasis batch-progress">
            {{ batchProgressText }}
          </div>
        </v-card-title>

        <v-card-text>
          <div class="scaled-text">
            <div
              v-if="store.spinning && store.currentCandidate"
              class="spin-name"
              :class="{ spinning: store.spinning }"
            >
              <h2 class="card-name">{{ spinName }}</h2>
            </div>
            <div v-else-if="showRoster">
              <div class="roster-grid">
                <div v-for="(name, i) in rosterNames" :key="i" class="roster-name">
                  {{ name }}
                </div>
              </div>
              <div v-if="shortfallNote" class="text-medium-emphasis mt-2">
                {{ shortfallNote }}
              </div>
            </div>
            <div v-else-if="store.selected">
              <h2 class="card-name">{{ winnerName }}</h2>
              <div v-for="row in detailRows" :key="row.key" class="card-detail mb-2">
                <template v-if="settings.winnerDisplay.showLabels">{{ row.label }}: </template
                >{{ row.value }}
              </div>
            </div>
          </div>
        </v-card-text>

        <v-card-actions v-if="!store.useMultiDisplayMode">
          <v-btn
            v-show="!store.spinning && !batchRunning"
            :disabled="!canStart"
            variant="elevated"
            color="primary"
            @click="startDraw(settings.drawCount)"
            >GO!</v-btn
          >
          <div
            v-if="startHint && !store.spinning"
            class="text-medium-emphasis mt-2"
          >
            {{ startHint }}
          </div>
        </v-card-actions>
      </v-card>

    </v-container>
  </v-main>
</template>

<style scoped>
/* Visually hidden but available to screen readers (the aria-live status). */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
button {
  width: 100%;
}
.go-btn {
  max-width: 320px;
  width: 100%;
}
.event-logo {
  max-height: 20vh;
  max-width: 80vw;
  object-fit: contain;
}
.event-title {
  color: var(--app-headline, rgb(var(--v-theme-primary)));
}
/* Classic card text. The winner name is the headline; detail rows are smaller.
   Both are bounded with clamp() (keyed off vmin, not vw) so they stay large on a
   projector but never outgrow the card and wrap/clip the way a flat 8vw rule did
   on wide screens. */
.scaled-text {
  max-width: 88vw;
  margin-inline: auto;
}
.card-name {
  font-size: clamp(2rem, 9vmin, 6rem);
  line-height: 1.1;
  overflow-wrap: anywhere;
}
.card-detail {
  font-size: clamp(1.1rem, 3.2vmin, 2.25rem);
  line-height: 1.3;
  overflow-wrap: anywhere;
}

/* Giant wheel overlay: a full-viewport layer above the wheel backdrop holding
   the branding/status (top), the winner card (center) and the GO button
   (bottom). pointer-events pass through except on interactive children. */
.giant-overlay {
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
.giant-top {
  position: absolute;
  top: clamp(2.75rem, 6vh, 5rem); /* clear of the pointer at the very top */
  left: 0;
  right: 0;
  text-align: center;
  padding-inline: 1rem;
}
.giant-text {
  text-shadow:
    0 1px 3px rgba(0, 0, 0, 0.45),
    0 0 2px rgba(0, 0, 0, 0.35);
}
.giant-headline {
  font-size: clamp(1.5rem, 5vmin, 3.25rem);
}
.giant-go {
  position: absolute;
  bottom: clamp(1.5rem, 5vh, 4rem);
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
}
.giant-empty {
  position: absolute;
  bottom: clamp(1.5rem, 5vh, 4rem);
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

/* Wheel stage: positions the winner card as an overlay centered on the wheel
   so the result is visible without scrolling. */
.wheel-stage {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.winner-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  /* Size to content, but never exceed the wheel's footprint or the viewport.
     Tying the cap to the same vmin the wheel uses keeps the font and the card
     width growing together, so text no longer wraps oddly on big screens. */
  width: max-content;
  max-width: min(85vw, 64vmin);
  z-index: 10;
  background: color-mix(
    in srgb,
    var(--app-winner-card-bg, rgb(var(--v-theme-surface))) 96%,
    transparent
  );
  backdrop-filter: blur(2px);
}
.overlay-content {
  text-align: center;
  padding: clamp(0.75rem, 2vmin, 1.5rem) clamp(1rem, 3vmin, 2rem) !important;
}
/* Name and detail rows are scaled to the wheel (vmin), not the viewport width,
   and capped so they stay inside the card. The name is the headline; details
   are noticeably smaller. */
.overlay-name {
  font-size: clamp(1.5rem, 6vmin, 3rem) !important;
  line-height: 1.1;
  margin-bottom: clamp(0.25rem, 1.5vmin, 0.75rem);
  white-space: nowrap;
}
.overlay-detail {
  font-size: clamp(0.9rem, 2.6vmin, 1.4rem);
  line-height: 1.35;
  white-space: nowrap;
}

/* Pop-in transition when the wheel stops and the winner is revealed. */
.winner-pop-enter-active {
  transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
}
.winner-pop-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.winner-pop-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.6);
}
.winner-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.9);
}

.winner-card {
  background: var(--app-winner-card-bg, rgb(var(--v-theme-surface)));
  color: var(--app-winner-card-text, rgb(var(--v-theme-primary)));
}
/* Keep the classic reveal card within the viewport so long names wrap
   inside it instead of overflowing. */
.winner-card.animation-classic {
  max-width: 92vw;
}

.winner-card .v-btn {
  background-color: rgb(var(--v-theme-primary));
}

.winner-card h1,
.winner-card h2 {
  color: var(--app-winner-card-text, rgb(var(--v-theme-primary)));
}

.spin-name {
  display: inline-block;
}

/* Simultaneous multi-winner reveal: one pane per winner, wrapping to fit. */
.simul-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: clamp(0.75rem, 2vmin, 1.5rem);
  max-width: 96vw;
}

/* End-of-batch roster inside the classic card. */
.roster-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: clamp(0.5rem, 1.5vmin, 1rem) clamp(1rem, 3vmin, 2rem);
}
.roster-name {
  font-size: clamp(1.4rem, 5vmin, 3.5rem);
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.batch-progress {
  font-size: clamp(1rem, 2.4vmin, 1.5rem);
}
</style>
