// Wheel-of-fortune segment helpers.
//
// The actual draw is honest — the winner is decided by the store before the
// wheel starts spinning. The visual wheel must just *display* that winner in
// one of its segments so the pointer can land on a real name.
//
// For small pools we show every candidate. For larger pools we sample a
// representative subset (always including the winner) so segment labels stay
// legible.

import { lighten, darken } from './color.js'

export const MAX_WHEEL_SEGMENTS = 24

// The original segment palette, shared with the settings store so "custom"
// colors start from the familiar look.
export const DEFAULT_WHEEL_COLORS = [
  '#1e3d59',
  '#1c8c9a',
  '#ff6f61',
  '#ffcf48',
  '#7ed957',
  '#b39ddb',
  '#f48fb1',
  '#4dd0e1',
]

// Derive an 8-color segment palette from the event theme. Alternates darker
// and lighter variants of primary/secondary/accent so adjacent segments always
// contrast even when the base colors are similar.
export function wheelColorsFromTheme(theme) {
  const { primary, secondary, accent } = theme
  return [
    primary,
    lighten(secondary, 0.08),
    accent,
    lighten(primary, 0.22),
    darken(secondary, 0.12),
    lighten(accent, 0.18),
    darken(primary, 0.1),
    darken(accent, 0.14),
  ]
}

// Returns { segments: [{ label, candidateIdx }], winnerSegmentIdx }.
// `candidates` is the full pool; `winnerIdx` is the index in `candidates` of
// the pre-chosen winner. `random` is injectable for deterministic tests.
// `label` resolves a candidate's display text; the caller passes one built from
// the winnerDisplay name config. Defaults to joining all field values.
function defaultLabel(c) {
  return Object.values(c.fields ?? {}).join(' ').trim() || '(no name)'
}

export function buildWheelSegments(
  candidates,
  winnerIdx,
  { max = MAX_WHEEL_SEGMENTS, random = Math.random, label: labelFn = defaultLabel } = {},
) {
  if (!Array.isArray(candidates) || candidates.length === 0 || winnerIdx < 0) {
    return { segments: [], winnerSegmentIdx: -1 }
  }
  const label = (c) => labelFn(c) || '(no name)'

  if (candidates.length <= max) {
    return {
      segments: candidates.map((c, i) => ({ label: label(c), candidateIdx: i })),
      winnerSegmentIdx: winnerIdx,
    }
  }

  // Larger pool: sample (max - 1) other candidates and slot the winner in at a
  // pseudo-random position so the audience can't predict where the pointer
  // will land.
  const otherIdxs = []
  for (let i = 0; i < candidates.length; i++) {
    if (i !== winnerIdx) otherIdxs.push(i)
  }
  // Fisher–Yates shuffle the "others" with the supplied RNG, then take max-1.
  for (let i = otherIdxs.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[otherIdxs[i], otherIdxs[j]] = [otherIdxs[j], otherIdxs[i]]
  }
  const picked = otherIdxs.slice(0, max - 1)
  const winnerSegmentIdx = Math.floor(random() * max)
  const segments = []
  let p = 0
  for (let i = 0; i < max; i++) {
    if (i === winnerSegmentIdx) {
      segments.push({ label: label(candidates[winnerIdx]), candidateIdx: winnerIdx })
    } else {
      const ci = picked[p++]
      segments.push({ label: label(candidates[ci]), candidateIdx: ci })
    }
  }
  return { segments, winnerSegmentIdx }
}

// Final rotation (radians) that puts the center of `winnerSegmentIdx` directly
// under a pointer at the top of the canvas (angle = -PI/2 in standard coords).
// Adds `fullSpins` complete revolutions for showmanship.
export function targetRotation(winnerSegmentIdx, segmentCount, fullSpins = 5) {
  if (segmentCount <= 0) return 0
  const segAngle = (Math.PI * 2) / segmentCount
  const segCenter = winnerSegmentIdx * segAngle + segAngle / 2
  const pointerAngle = -Math.PI / 2
  return pointerAngle - segCenter + Math.PI * 2 * fullSpins
}
