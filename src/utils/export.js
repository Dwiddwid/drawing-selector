// Export helpers for winners and full app state.

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
  const extraKeys = [...new Set(winners.flatMap((w) => Object.keys(w.extras || {})))]
  const headers = ['First Name', 'Last Name', ...extraKeys]
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = [
    headers.map(escape).join(','),
    ...winners.map((w) =>
      [w.firstName, w.lastName, ...extraKeys.map((k) => w.extras?.[k] ?? '')].map(escape).join(','),
    ),
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

export function deserializeState(json) {
  let parsed
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON file.')
  }
  if (!Array.isArray(parsed.candidates) || !Array.isArray(parsed.winners)) {
    throw new Error('JSON must have "candidates" and "winners" arrays.')
  }
  const result = { candidates: parsed.candidates, winners: parsed.winners }
  // Only surface settings when present and shaped like an object.
  if (parsed.settings && typeof parsed.settings === 'object') {
    result.settings = parsed.settings
  }
  return result
}
