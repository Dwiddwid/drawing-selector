// Export helpers for winners and full app state.

import { migrateParticipants } from './csv.js'

function triggerDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadWinnersCsv(winners) {
  if (winners.length === 0) return false
  // Columns are the first-seen union of all field keys across winners (the
  // keys double as the user's custom labels).
  const keys = [...new Set(winners.flatMap((w) => Object.keys(w.fields || {})))]
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = [
    keys.map(escape).join(','),
    ...winners.map((w) => keys.map((k) => w.fields?.[k] ?? '').map(escape).join(',')),
  ]
  triggerDownload(rows.join('\r\n'), 'winners.csv', 'text/csv')
  return true
}

// `settings` is optional so older backups (without it) still round-trip.
export function exportStateJson(candidates, winners, settings) {
  const state = { candidates, winners }
  if (settings) state.settings = settings
  const payload = JSON.stringify(state, null, 2)
  triggerDownload(payload, 'drawing-state.json', 'application/json')
}

// Each element must be a current { fields } participant or a migratable legacy
// { firstName / lastName / extras } record — anything else would crash
// migrateParticipant (or worse, reach the store and break the next draw).
function assertImportableParticipant(p, listName, i) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) {
    throw new Error(`Invalid ${listName} entry at index ${i} — expected an object.`)
  }
  const hasFields = p.fields && typeof p.fields === 'object' && !Array.isArray(p.fields)
  const legacy = 'firstName' in p || 'lastName' in p || 'extras' in p
  if (!hasFields && !legacy) {
    throw new Error(`Invalid ${listName} entry at index ${i} — missing a "fields" map.`)
  }
}

export function deserializeState(json) {
  let parsed
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON file.')
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON must have "candidates" and "winners" arrays.')
  }
  if (!Array.isArray(parsed.candidates) || !Array.isArray(parsed.winners)) {
    throw new Error('JSON must have "candidates" and "winners" arrays.')
  }
  parsed.candidates.forEach((p, i) => assertImportableParticipant(p, 'candidates', i))
  parsed.winners.forEach((p, i) => assertImportableParticipant(p, 'winners', i))
  // Migrate any legacy { firstName, lastName, extras } records from older
  // backups to the generic { id, fields } shape.
  const result = {
    candidates: migrateParticipants(parsed.candidates),
    winners: migrateParticipants(parsed.winners),
  }
  // Only surface settings when present and shaped like an object.
  if (parsed.settings && typeof parsed.settings === 'object') {
    result.settings = parsed.settings
  }
  return result
}
