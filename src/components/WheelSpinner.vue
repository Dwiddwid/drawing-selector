<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { targetRotation } from '../utils/wheel.js'

const props = defineProps({
  segments: { type: Array, required: true }, // [{ label, candidateIdx }]
  winnerSegmentIdx: { type: Number, required: true },
  active: { type: Boolean, default: false }, // when true, begin spinning
  durationMs: { type: Number, default: 4200 },
  size: { type: Number, default: 480 },
  // Giant mode: the wheel is blown up so its center sits well below the visible
  // area. Only the top arc shows, so names scroll on/off as it spins and every
  // entry can appear on the wheel even with a large pool.
  giant: { type: Boolean, default: false },
  colors: {
    type: Array,
    default: () => [
      '#1e3d59',
      '#1c8c9a',
      '#ff6f61',
      '#ffcf48',
      '#7ed957',
      '#b39ddb',
      '#f48fb1',
      '#4dd0e1',
    ],
  },
})
const emit = defineEmits(['done'])

const canvasRef = ref(null)
let rotation = 0
let rafId = 0

// Pre-rendered wheel bitmap. The wheel's content never changes while spinning —
// only its rotation — so we draw all the wedges + labels once into an offscreen
// canvas, then each frame just blit that bitmap with a rotation transform. This
// turns per-frame work from "N wedge fills + N text layouts on a huge canvas"
// into a single GPU-accelerated drawImage, which removes the spin stutter.
let bitmap = null

const segCount = computed(() => props.segments.length)
const dpr = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1

// Cap the backing-store resolution. A giant wheel at full DPR can exceed the
// GPU's max texture size (commonly 4096–8192px), which forces slow software
// rendering — a major cause of the stutter. Staying under the cap keeps it on
// the GPU; the slight softness on hi-DPI screens is unnoticeable while spinning.
const MAX_DEVICE_PX = 4096

// The giant wheel fills the whole viewport. Its center sits below the bottom
// edge so only the upper portion shows, and its radius is large enough to reach
// every corner of the viewport — so there are no gaps at the sides or bottom.
const vw = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const vh = ref(typeof window !== 'undefined' ? window.innerHeight : 800)
function recomputeViewport() {
  if (typeof window === 'undefined') return
  vw.value = window.innerWidth
  vh.value = window.innerHeight
}

function deviceScale(logicalPx) {
  return Math.max(1, Math.min(dpr, MAX_DEVICE_PX / logicalPx))
}

// Gap in CSS pixels between the top of the viewport and the wheel's rim.
// Setting r = cy - GIANT_TOP_GAP puts the topmost point of the wheel exactly
// this far below the top edge, so the rim is always visible.
const GIANT_TOP_GAP = 20

// Canvas + wheel geometry in CSS pixels.
//   cw/ch — canvas (visible) size      cx/cy — wheel center      r — wheel radius
const geom = computed(() => {
  if (props.giant) {
    const cw = vw.value
    const ch = vh.value
    const cx = cw / 2
    // Push the center 16 % of the viewport height below the bottom edge so
    // the spokes' convergence point stays offscreen. The radius is then set so
    // the topmost point of the rim lands exactly GIANT_TOP_GAP px below the
    // top of the viewport (cy - r = GIANT_TOP_GAP).  This is always large
    // enough to cover the bottom corners: r ≈ 1.16·ch which is well above the
    // bottom-corner distance of √((cw/2)² + (0.16·ch)²).
    const cy = ch + ch * 1 //0.16 might not be enough
    const r = cy - GIANT_TOP_GAP
    return { cw, ch, cx, cy, r }
  }
  const s = props.size
  return { cw: s, ch: s, cx: s / 2, cy: s / 2, r: s / 2 - 12 }
})

// Render the static wheel (wedges, labels, hub) once into an offscreen square
// bitmap of side 2r, with the wheel centered in it.
function buildBitmap() {
  if (typeof document === 'undefined') {
    bitmap = null
    return
  }
  const { r } = geom.value
  const side = Math.ceil(2 * r)
  const scale = deviceScale(side)
  const px = Math.round(side * scale)
  const off = bitmap || document.createElement('canvas')
  off.width = px
  off.height = px
  const ctx = off.getContext?.('2d')
  if (!ctx) {
    bitmap = null
    return
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, side, side)

  const n = segCount.value
  if (n > 0) {
    const c = r // wheel center within the square bitmap
    const segAngle = (Math.PI * 2) / n
    for (let i = 0; i < n; i++) {
      const start = i * segAngle // rotation applied at blit time, not here
      const end = start + segAngle
      ctx.beginPath()
      ctx.moveTo(c, c)
      ctx.arc(c, c, r, start, end)
      ctx.closePath()
      ctx.fillStyle = props.colors[i % props.colors.length]
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = props.giant ? 3 : 2
      ctx.stroke()

      if (props.giant) {
        drawGiantLabel(ctx, c, c, r, start, segAngle, props.segments[i].label)
      } else {
        drawRadialLabel(ctx, c, c, r, start, segAngle, n, props.segments[i].label)
      }
    }
    // Hub (only meaningful for the normal wheel — the giant wheel's is offscreen).
    if (!props.giant) {
      ctx.beginPath()
      ctx.arc(c, c, r * 0.11, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }
  bitmap = off
}

// Per-frame: clear, blit the pre-rendered bitmap rotated about the wheel center,
// then the static pointer (normal wheel only — the giant's pointer is CSS).
function renderFrame() {
  const cv = canvasRef.value
  if (!cv) return
  const ctx = cv.getContext?.('2d')
  if (!ctx) return
  const { cw, ch, cx, cy, r } = geom.value
  const scale = deviceScale(Math.max(cw, ch))
  const pxW = Math.round(cw * scale)
  const pxH = Math.round(ch * scale)
  if (cv.width !== pxW || cv.height !== pxH) {
    cv.width = pxW
    cv.height = pxH
    cv.style.width = `${cw}px`
    cv.style.height = `${ch}px`
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, cw, ch)
  if (bitmap) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rotation)
    ctx.drawImage(bitmap, -r, -r, 2 * r, 2 * r)
    ctx.restore()
  }
  if (!props.giant) {
    ctx.beginPath()
    ctx.moveTo(cx - 16, 6)
    ctx.lineTo(cx + 16, 6)
    ctx.lineTo(cx, 38)
    ctx.closePath()
    ctx.fillStyle = '#ff6f61'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.stroke()
  }
}

// Rebuild the bitmap and repaint — used on mount and whenever the segments or
// size change.
function rebuild() {
  buildBitmap()
  renderFrame()
}

// Normal wheel: text runs radially from the rim toward the center.
function drawRadialLabel(ctx, cx, cy, r, start, segAngle, n, label) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(start + segAngle / 2)
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  const fontSize = Math.max(11, Math.min(20, (r / Math.max(8, n)) * 1.4))
  ctx.font = `600 ${fontSize}px sans-serif`
  const maxChars = Math.max(8, Math.floor((r / fontSize) * 1.3))
  const trimmed = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label
  ctx.fillText(trimmed, r - 12, 0)
  ctx.restore()
}

// Giant wheel: text runs radially (along the spoke, rotated 90° from the rim)
// so names have the full radius to occupy. The font height is constrained by
// the per-slice arc thickness so neighbouring labels don't collide, but the
// length is bounded by the (very large) radius — so even long names fit and
// aren't truncated the way tangential text was.
function drawGiantLabel(ctx, cx, cy, r, start, segAngle, label) {
  const mid = start + segAngle / 2
  const arcThickness = r * segAngle
  const fontSize = Math.max(14, Math.min(48, arcThickness * 0.7))
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(mid) // radial orientation (name points toward the center)
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${fontSize}px sans-serif`
  // Plenty of radial room — only truncate truly enormous labels.
  const maxChars = Math.max(12, Math.floor((r * 0.6) / (fontSize * 0.55)))
  const trimmed = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label
  ctx.fillText(trimmed, r - 18, 0)
  ctx.restore()
}

function spin() {
  if (props.winnerSegmentIdx < 0 || segCount.value === 0) {
    emit('done')
    return
  }
  const startRot = rotation
  const finalRot = targetRotation(props.winnerSegmentIdx, segCount.value)
  const start = performance.now()
  const dur = props.durationMs

  const step = (now) => {
    const t = Math.min(1, (now - start) / dur)
    // Ease-out quintic — feels like a real wheel slowing under friction.
    const eased = 1 - Math.pow(1 - t, 5)
    rotation = startRot + (finalRot - startRot) * eased
    renderFrame()
    if (t < 1) {
      rafId = requestAnimationFrame(step)
    } else {
      // Normalize rotation so repeat spins don't accumulate huge numbers.
      rotation = rotation % (Math.PI * 2)
      emit('done')
    }
  }
  rafId = requestAnimationFrame(step)
}

function onResize() {
  if (props.giant) {
    recomputeViewport()
    rebuild()
  }
}

onMounted(() => {
  if (props.giant) recomputeViewport()
  rebuild()
  window.addEventListener('resize', onResize)
  if (props.active) spin()
})
onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  window.removeEventListener('resize', onResize)
})
watch(
  () => props.active,
  (a) => {
    if (a) spin()
  },
)
watch(() => props.segments, () => rebuild(), { deep: true })
watch(
  () => `${geom.value.cw}x${geom.value.ch}x${Math.round(geom.value.r)}`,
  () => rebuild(),
)
</script>

<template>
  <!-- Giant: an oversized wheel that fills the entire viewport, its center
       below the bottom edge so only the upper arc shows. -->
  <div v-if="giant" class="wheel-giant-viewport">
    <canvas ref="canvasRef" class="wheel-canvas-giant" />
    <!-- Pointer fixed at the top-center of the screen. -->
    <div class="giant-pointer" aria-hidden="true" />
  </div>

  <!-- Normal wheel. -->
  <div v-else class="wheel-wrap">
    <canvas ref="canvasRef" class="wheel-canvas" />
  </div>
</template>

<style scoped>
.wheel-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}
.wheel-canvas {
  max-width: 70vmin;
  max-height: 70vmin;
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.25));
}

/* Giant wheel: a full-viewport backdrop. The canvas itself is sized to the
   viewport (cw×ch) by the render loop, so it reaches every edge — no gaps. */
.wheel-giant-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}
.wheel-canvas-giant {
  position: absolute;
  top: 0;
  left: 0;
}
.giant-pointer {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 22px solid transparent;
  border-right: 22px solid transparent;
  border-top: 40px solid #ff6f61;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4));
  z-index: 5;
}
</style>
