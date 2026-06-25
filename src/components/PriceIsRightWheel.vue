<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { reelDrumRotation, flapperDeflection, DEFAULT_WHEEL_COLORS } from '../utils/wheel.js'

// The Price Is Right "Big Wheel" seen the way the audience sees it: on edge. The
// wheel is a giant vertical drum — names roll down from the top of the screen,
// swell to full size as they pass the front, and disappear off the bottom, each
// one tilting with the curve of the wheel. A side pointer clicks past the
// segments and marks the winner at the centre.
//
// Built with CSS 3D transforms: the segments are mounted around a cylinder
// (rotateX(i·segAngle) translateZ(radius)); spinning just animates the drum's
// rotateX. Perspective does the tilt/foreshortening for free. The draw is still
// honest — the store pre-picks the winner; we only land that panel at the front.
const props = defineProps({
  segments: { type: Array, required: true }, // [{ label, candidateIdx }]
  winnerSegmentIdx: { type: Number, required: true },
  active: { type: Boolean, default: false }, // when true, begin spinning
  // Timed spin length. Infinity = 'manual' mode: free-spin until `stopRequested`
  // flips true, then settle onto the winner.
  durationMs: { type: Number, default: 5200 },
  stopRequested: { type: Boolean, default: false },
  colors: {
    type: Array,
    default: () => [...DEFAULT_WHEEL_COLORS],
  },
  pointerColor: { type: String, default: '#ff6f61' }, // the side pointer color
})
const emit = defineEmits(['done'])

// Drum rotation in degrees, animated by the spin loop. Positive = names roll
// downward (top of the drum tips toward the viewer and over).
const rotation = ref(0)
let rafId = 0

const vh = ref(typeof window !== 'undefined' ? window.innerHeight : 800)
const vw = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
function recomputeViewport() {
  if (typeof window === 'undefined') return
  vh.value = window.innerHeight
  vw.value = window.innerWidth
}

const n = computed(() => props.segments.length)
const segAngle = computed(() => (n.value > 0 ? 360 / n.value : 360)) // degrees

const bandWidth = computed(() =>
  Math.round(Math.min(900, Math.max(360, vw.value * 0.6))),
)

// Each segment panel is a fixed share of the viewport height, so a handful of
// names are always visible at once and a name is the same readable size no
// matter how many entries there are. The cylinder radius is then derived so the
// panels tile the drum edge-to-edge (face of a regular n-gon at that radius);
// for very small pools the half-angle is clamped so the radius stays sane.
const faceHeight = computed(() => Math.max(56, Math.round(vh.value * 0.22)))
const radius = computed(() => {
  const half = Math.min((segAngle.value / 2) * (Math.PI / 180), (60 * Math.PI) / 180)
  const r = faceHeight.value / (2 * Math.tan(half))
  return Math.round(Math.min(vh.value * 1.5, Math.max(faceHeight.value * 0.8, r)))
})
// Perspective tuned so the front name is magnified only modestly; magFactor is
// that magnification (P / (P − radius)), used to keep names inside the band.
const perspective = computed(() => Math.round(radius.value * 2.4 + 240))
const magFactor = computed(() => perspective.value / (perspective.value - radius.value))
const longestLabel = computed(() =>
  Math.min(40, Math.max(4, props.segments.reduce((m, s) => Math.max(m, (s.label || '').length), 0))),
)
// Shrink the font until the longest name fits the band width once magnified, and
// never taller than half a panel.
const fontPx = computed(() => {
  const widthFont = (bandWidth.value * 0.82) / (magFactor.value * longestLabel.value * 0.56)
  const heightFont = faceHeight.value * 0.5
  return Math.max(14, Math.floor(Math.min(widthFont, heightFont)))
})

const sceneStyle = computed(() => ({
  perspective: `${perspective.value}px`,
}))
const bandStyle = computed(() => ({ width: `${bandWidth.value}px` }))
const drumStyle = computed(() => ({
  transform: `rotateX(${rotation.value}deg)`,
}))

// Each panel is mounted at its angle around the drum and pushed out by the
// radius; translateY(-50%) centres it on the drum's mid-line.
function segStyle(i) {
  return {
    height: `${faceHeight.value}px`,
    marginTop: `${-faceHeight.value / 2}px`,
    transform: `rotateX(${i * segAngle.value}deg) translateZ(${radius.value}px)`,
    background: props.colors[i % props.colors.length],
    fontSize: `${fontPx.value}px`,
  }
}

// The side pointer flicks toward the wheel as each segment boundary sweeps past
// the front, then snaps back — the click of the flapper. Driven by the pure
// flapperDeflection() helper so the tick rate follows the wheel speed.
const pointerStyle = computed(() => {
  const segRad = segAngle.value * (Math.PI / 180)
  const rotRad = rotation.value * (Math.PI / 180)
  const kick = flapperDeflection(rotRad, segRad) * 12 // px toward the wheel
  return {
    transform: `translateY(-50%) translateX(${-kick}px)`,
    borderRightColor: props.pointerColor,
  }
})

// Manual mode: free-spin speed (deg/s) and how long the settle-to-winner
// ease-out runs once the operator presses Stop.
const FREE_SPIN_SPEED_DEG = 300
const SETTLE_MS = 2200

function spin() {
  if (props.winnerSegmentIdx < 0 || n.value === 0) {
    emit('done')
    return
  }
  if (Number.isFinite(props.durationMs)) {
    // Land the winner at the front, sweeping forward from where we are now.
    const target = reelDrumRotation(props.winnerSegmentIdx, n.value)
    const finalRot = rotation.value + ((target - rotation.value) % 360) + 360 * 6
    easeTo(finalRot, props.durationMs)
  } else {
    freeSpin()
  }
}

// Ease the drum from its current rotation to `finalRot` over `dur` ms, then
// normalize and emit done.
function easeTo(finalRot, dur) {
  const startRot = rotation.value
  const start = performance.now()
  const stepFrame = (now) => {
    const t = Math.min(1, (now - start) / dur)
    // Ease-out quintic — a heavy wheel slowing under friction.
    const eased = 1 - Math.pow(1 - t, 5)
    rotation.value = startRot + (finalRot - startRot) * eased
    if (t < 1) {
      rafId = requestAnimationFrame(stepFrame)
    } else {
      rotation.value = finalRot % 360
      emit('done')
    }
  }
  rafId = requestAnimationFrame(stepFrame)
}

// Spin at a constant speed until the operator presses Stop, then settle the
// winner's panel to the front from wherever the drum is, plus a couple of extra
// turns for showmanship.
function freeSpin() {
  let last = performance.now()
  const loop = (now) => {
    const dt = Math.max(0, (now - last) / 1000)
    last = now
    rotation.value += FREE_SPIN_SPEED_DEG * dt
    if (props.stopRequested) {
      const target = reelDrumRotation(props.winnerSegmentIdx, n.value, 0)
      const delta = (((target - rotation.value) % 360) + 360) % 360
      easeTo(rotation.value + delta + 360 * 2, SETTLE_MS)
    } else {
      rafId = requestAnimationFrame(loop)
    }
  }
  rafId = requestAnimationFrame(loop)
}

onMounted(() => {
  recomputeViewport()
  window.addEventListener('resize', recomputeViewport)
  if (props.active) spin()
})
onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  window.removeEventListener('resize', recomputeViewport)
})
watch(
  () => props.active,
  (a) => {
    if (a) spin()
  },
)
</script>

<template>
  <div class="pir-viewport">
    <div class="pir-band" :style="bandStyle">
      <!-- Marquee bulb rails framing the wheel, like the studio wheel. -->
      <div class="pir-rail left" aria-hidden="true" />
      <div class="pir-rail right" aria-hidden="true" />

      <!-- The rotating drum of names. -->
      <div class="pir-scene" :style="sceneStyle">
        <div class="pir-drum" :style="drumStyle">
          <div v-for="(seg, i) in segments" :key="i" class="pir-seg" :style="segStyle(i)">
            <span class="pir-label">{{ seg.label }}</span>
          </div>
        </div>
      </div>

      <!-- Cylindrical shading: darken the top and bottom so the wheel reads as
           curving away, with a bright band across the front centre. -->
      <div class="pir-shade" aria-hidden="true" />

      <!-- Side pointer marking the winning row at front centre. -->
      <div class="pir-pointer" :style="pointerStyle" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
.pir-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}
.pir-band {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  overflow: hidden;
  background: linear-gradient(180deg, #15151c 0%, #23232e 50%, #15151c 100%);
  box-shadow:
    inset 0 0 60px rgba(0, 0, 0, 0.6),
    0 0 40px rgba(0, 0, 0, 0.4);
}
.pir-scene {
  position: absolute;
  inset: 0;
}
.pir-drum {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 0;
  transform-style: preserve-3d;
  will-change: transform;
}
.pir-seg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  backface-visibility: hidden;
  border-top: 3px solid rgba(255, 215, 120, 0.9);
  border-bottom: 3px solid rgba(140, 100, 20, 0.9);
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.35);
  transform-origin: 50% 50%;
}
.pir-label {
  color: #fff;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 88%;
  text-shadow:
    0 2px 4px rgba(0, 0, 0, 0.55),
    0 0 2px rgba(0, 0, 0, 0.4);
}
.pir-shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  background:
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.82) 0%,
      rgba(0, 0, 0, 0.25) 14%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(0, 0, 0, 0.25) 86%,
      rgba(0, 0, 0, 0.82) 100%
    );
}
/* Bulb rails along both edges of the wheel. */
.pir-rail {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 22px;
  z-index: 3;
  background: #101016;
}
.pir-rail.left {
  left: 0;
  border-right: 2px solid rgba(0, 0, 0, 0.6);
}
.pir-rail.right {
  right: 0;
  border-left: 2px solid rgba(0, 0, 0, 0.6);
}
.pir-rail::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
    circle at 50% 50%,
    #fff7da 0,
    #ffd24d 28%,
    rgba(255, 170, 0, 0.35) 55%,
    transparent 70%
  );
  background-size: 100% 30px;
  background-repeat: repeat-y;
  animation: pir-twinkle 1.1s ease-in-out infinite;
}
.pir-rail.right::before {
  animation-delay: 0.55s;
}
@keyframes pir-twinkle {
  0%,
  100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}
/* Pointer: a triangle on the right edge pointing left into the wheel. */
.pir-pointer {
  position: absolute;
  right: 14px;
  top: 50%;
  width: 0;
  height: 0;
  z-index: 4;
  border-top: 26px solid transparent;
  border-bottom: 26px solid transparent;
  border-right: 40px solid #ff6f61;
  filter: drop-shadow(-2px 2px 3px rgba(0, 0, 0, 0.5));
}
</style>
