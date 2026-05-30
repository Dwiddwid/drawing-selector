<script setup>
import { computed, ref, watch } from 'vue'
import { useParticipantStore } from '../stores/participants.js'
import { useSettingsStore } from '../stores/settings.js'
import { formatWinnerName, visibleWinnerFields } from '../utils/winnerDisplay.js'
import { createTriggerChannel } from '../utils/platform.js'
import { celebrate } from '../utils/celebration.js'
import { buildWheelSegments } from '../utils/wheel.js'
import WheelSpinner from '../components/WheelSpinner.vue'

const store = useParticipantStore()
const settings = useSettingsStore()

// Both 'wheel' and 'wheel-giant' use the canvas-wheel reveal flow.
const isWheel = computed(
  () => settings.animationStyle === 'wheel' || settings.animationStyle === 'wheel-giant',
)
const isGiantWheel = computed(() => settings.animationStyle === 'wheel-giant')

// Wheel-spin state. The visual wheel needs to know the winner before the
// pointer can land on them, so for that style we pre-pick from the store,
// render the wheel, and commit only after the rotation eases to a stop.
const wheelActive = ref(false)
const wheelSegments = ref([])
const wheelWinnerSegmentIdx = ref(-1)
const pendingWinnerIdx = ref(-1)

function startDraw() {
  if (isWheel.value) {
    if (!store.beginVisualSpin()) return
    const idx = store.pickWinnerIndex()
    if (idx < 0) {
      // Pool emptied between the check and the pick — bail cleanly.
      store.commitAt(-1)
      return
    }
    pendingWinnerIdx.value = idx
    // The giant wheel shows every candidate (names scroll past), so don't cap
    // the segment count; the standard wheel keeps the default cap.
    const opts = isGiantWheel.value ? { max: store.candidates.length } : {}
    const { segments, winnerSegmentIdx } = buildWheelSegments(store.candidates, idx, opts)
    wheelSegments.value = segments
    wheelWinnerSegmentIdx.value = winnerSegmentIdx
    wheelActive.value = true
  } else {
    store.selectRandomCandidate(settings.animationStyle)
  }
}

function onWheelDone() {
  wheelActive.value = false
  if (pendingWinnerIdx.value >= 0) {
    store.commitAt(pendingWinnerIdx.value)
    pendingWinnerIdx.value = -1
  }
}

// Cross-tab trigger for multi-display mode. Uses BroadcastChannel on the web and
// a localStorage-event fallback in the portable (file://) Offline Edition, so a
// remote draw works in both. Still falls back to this screen's own GO! button.
const bc = createTriggerChannel()
bc?.onMessage(() => startDraw())

const winnerName = computed(() =>
  store.selected ? formatWinnerName(store.selected, settings.winnerDisplay.nameFormat) : '',
)
const detailRows = computed(() =>
  store.selected ? visibleWinnerFields(store.selected, settings.winnerDisplay) : [],
)

// Fire confetti + chime exactly once per reveal (when `selected` transitions
// from null to a participant).
watch(
  () => store.selected,
  (next, prev) => {
    if (!next || prev) return
    celebrate({
      confetti: settings.celebration.confetti,
      sound: settings.celebration.sound,
    })
  },
)
</script>

<template>
  <v-main>
    <v-container fluid fill-height class="text-center d-flex flex-column align-center justify-center fill-height">
      <img
        v-if="settings.theme.logo && !isGiantWheel"
        :src="settings.theme.logo"
        alt="Event logo"
        class="event-logo mb-4"
      />
      <h1 v-if="settings.theme.eventTitle && !isGiantWheel" class="event-title mb-4">
        {{ settings.theme.eventTitle }}
      </h1>

      <!-- Giant wheel: a full-viewport wheel backdrop (its center is below the
           screen so only the top arc shows) with the title, status, winner card
           and GO button layered on top — edge to edge, no surrounding gaps. -->
      <template v-if="isGiantWheel">
        <WheelSpinner
          v-if="wheelSegments.length"
          :segments="wheelSegments"
          :winner-segment-idx="wheelWinnerSegmentIdx"
          :active="wheelActive"
          giant
          @done="onWheelDone"
        />

        <div class="giant-overlay">
          <div class="giant-top">
            <img
              v-if="settings.theme.logo"
              :src="settings.theme.logo"
              alt="Event logo"
              class="event-logo mb-2"
            />
            <h1 v-if="settings.theme.eventTitle" class="event-title giant-text">
              {{ settings.theme.eventTitle }}
            </h1>
            <h1 v-if="store.spinning" class="font-weight-thin giant-text giant-headline">
              And the Winner Is...
            </h1>
            <h1 v-else-if="!store.selected" class="font-weight-thin giant-text giant-headline">
              Ready to start drawing!
            </h1>
          </div>

          <transition name="winner-pop">
            <v-card
              v-if="store.selected && !wheelActive"
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
            v-if="!store.useMultiDisplayMode && !store.spinning"
            :disabled="store.candidates.length === 0"
            variant="elevated"
            color="primary"
            class="giant-go go-btn"
            @click="startDraw"
          >
            GO!
          </v-btn>

          <div
            v-if="store.candidates.length === 0 && !store.spinning && !store.selected"
            class="giant-empty"
          >
            No participants loaded — import a CSV first.
          </div>
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

        <div class="wheel-stage">
          <WheelSpinner
            v-if="wheelSegments.length"
            :segments="wheelSegments"
            :winner-segment-idx="wheelWinnerSegmentIdx"
            :active="wheelActive"
            @done="onWheelDone"
          />

          <transition name="winner-pop">
            <v-card
              v-if="store.selected && !wheelActive"
              round
              class="winner-card winner-overlay"
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
          v-if="!store.useMultiDisplayMode && !store.spinning"
          :disabled="store.candidates.length === 0"
          variant="elevated"
          color="primary"
          class="mt-6 go-btn"
          @click="startDraw"
        >
          GO!
        </v-btn>

        <div
          v-if="store.candidates.length === 0 && !store.spinning && !store.selected"
          class="text-medium-emphasis mt-2"
        >
          No participants loaded — import a CSV first.
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
        </v-card-title>

        <v-card-text>
          <div class="scaled-text">
            <div
              v-if="store.spinning && store.currentCandidate"
              class="spin-name"
              :class="{ spinning: store.spinning }"
            >
              <h2 class="card-name">
                {{ store.currentCandidate.firstName }} {{ store.currentCandidate.lastName }}
              </h2>
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
            v-show="!store.spinning"
            :disabled="store.candidates.length === 0"
            variant="elevated"
            color="primary"
            v-on:click="startDraw"
            >GO!</v-btn
          >
          <div
            v-if="store.candidates.length === 0 && !store.spinning"
            class="text-medium-emphasis mt-2"
          >
            No participants loaded — import a CSV first.
          </div>
        </v-card-actions>
      </v-card>

    </v-container>
  </v-main>
</template>

<style scoped>
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
  color: rgb(var(--v-theme-primary));
}
/* Classic / reel card text. The winner name is the headline; detail rows are
   smaller. Both are bounded with clamp() (keyed off vmin, not vw) so they stay
   large on a projector but never outgrow the card and wrap/clip the way a flat
   8vw rule did on wide screens. */
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
  background: rgba(var(--v-theme-surface), 0.96);
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
  background: rgb(var(--v-theme-surface));
}
/* Keep the classic/reel reveal card within the viewport so long names wrap
   inside it instead of overflowing. */
.winner-card.animation-classic,
.winner-card.animation-reel {
  max-width: 92vw;
}

.winner-card .v-btn {
  background-color: rgb(var(--v-theme-primary));
}

.winner-card h1,
.winner-card h2 {
  color: rgb(var(--v-theme-primary));
}

/* Reel style — vertical sliding reveal during the spin. */
.spin-name {
  display: inline-block;
}
.animation-reel .spin-name.spinning {
  animation: spin-reel 0.25s ease-in-out infinite;
}
@keyframes spin-reel {
  0% { transform: translateY(-30%); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translateY(30%); opacity: 0; }
}
</style>
