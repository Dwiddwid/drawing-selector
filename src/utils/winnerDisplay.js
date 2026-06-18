// Pure helpers for rendering the winner on the drawing screen, driven by the
// user's winnerDisplay settings. Kept framework-free so they can be unit tested.

// Compose the headline/title for a participant from the configured name fields.
// `winnerDisplay` provides `nameKeys` (ordered field keys) and `nameSeparator`.
export function formatWinnerName(participant, winnerDisplay) {
  const fields = participant?.fields || {}
  const { nameKeys = [], nameSeparator = ' ' } = winnerDisplay || {}
  return nameKeys
    .map((k) => (fields[k] ?? '').trim())
    .filter(Boolean)
    .join(nameSeparator)
}

// Returns the ordered, visible detail rows for a winner. Pulls values from the
// winner's fields, skips empty values, and excludes the name fields so they
// don't duplicate the headline.
export function visibleWinnerFields(winner, winnerDisplay) {
  const fields = winner?.fields || {}
  const nameKeys = new Set(winnerDisplay?.nameKeys || [])
  return (winnerDisplay.fields || [])
    .filter((f) => f.visible && !nameKeys.has(f.key))
    .map((f) => ({ key: f.key, label: f.label || f.key, value: fields[f.key] ?? '' }))
    .filter((row) => row.value !== '')
}

// Union of all field keys across a list of participants, preserving first-seen
// order. Used to populate the configurable field list.
export function collectFieldKeys(participants) {
  const seen = new Set()
  const keys = []
  for (const p of participants) {
    for (const key of Object.keys(p.fields || {})) {
      if (!seen.has(key)) {
        seen.add(key)
        keys.push(key)
      }
    }
  }
  return keys
}
