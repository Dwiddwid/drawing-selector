// Pure helpers for rendering the winner on the drawing screen, driven by the
// user's winnerDisplay settings. Kept framework-free so they can be unit tested.

export function formatWinnerName(winner, nameFormat) {
  const first = (winner.firstName || '').trim()
  const last = (winner.lastName || '').trim()
  switch (nameFormat) {
    case 'first':
      return first
    case 'last-first':
      return last && first ? `${last}, ${first}` : last || first
    case 'first-last':
    default:
      return [first, last].filter(Boolean).join(' ')
  }
}

// Returns the ordered, visible detail rows for a winner. Each row pulls its
// value from the winner's extras by key, skipping fields with no value.
export function visibleWinnerFields(winner, winnerDisplay) {
  const extras = winner.extras || {}
  return (winnerDisplay.fields || [])
    .filter((f) => f.visible)
    .map((f) => ({ key: f.key, label: f.label || f.key, value: extras[f.key] ?? '' }))
    .filter((row) => row.value !== '')
}

// Union of all extras keys across a list of participants, preserving first-seen
// order. Used to populate the configurable field list.
export function collectExtraKeys(participants) {
  const seen = new Set()
  const keys = []
  for (const p of participants) {
    for (const key of Object.keys(p.extras || {})) {
      if (!seen.has(key)) {
        seen.add(key)
        keys.push(key)
      }
    }
  }
  return keys
}
