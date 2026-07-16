// Quote-aware CSV parsing and participant normalization.
// Columns are mapped to a generic `fields` object via the import dialog; one or
// more columns are designated as "name" (the headline) and the rest as details.

let uidCounter = 0
export function uid() {
  const g = globalThis.crypto
  if (g && typeof g.randomUUID === 'function') {
    return g.randomUUID()
  }
  uidCounter += 1
  return `p_${Date.now().toString(36)}_${uidCounter}_${Math.random().toString(36).slice(2, 8)}`
}

// Delimiters we can parse. Comma is the classic CSV; semicolon is what Excel
// exports in many European locales; tab covers TSV files and text pasted
// straight out of a spreadsheet.
export const CSV_DELIMITERS = [',', ';', '\t']

// Guess the delimiter by counting candidate characters outside quoted regions
// across the first few non-empty lines. Highest total wins; comma wins ties
// (and a single-column file with no delimiter at all).
export function detectDelimiter(text) {
  const source = String(text ?? '')
  const counts = { ',': 0, ';': 0, '\t': 0 }
  let inQuotes = false
  let lines = 0
  let lineHadContent = false
  for (let i = 0; i < source.length && lines < 10; i++) {
    const c = source[i]
    if (inQuotes) {
      if (c === '"') inQuotes = false
      continue
    }
    if (c === '"') inQuotes = true
    else if (c === '\n' || c === '\r') {
      if (lineHadContent) lines += 1
      lineHadContent = false
      if (c === '\r' && source[i + 1] === '\n') i++
    } else {
      if (c.trim() !== '') lineHadContent = true
      if (c in counts) counts[c] += 1
    }
  }
  // Tie-break order = declaration order: ',' > ';' > '\t'.
  let best = ','
  for (const d of CSV_DELIMITERS) {
    if (counts[d] > counts[best]) best = d
  }
  return best
}

// Parse raw CSV/TSV text into ordered headers and row objects.
// Handles quoted fields containing delimiters/newlines, escaped "" quotes, and
// \r\n / \r / \n line endings. Trims headers and values; skips blank lines.
//   delimiter — ',', ';' or '\t'; auto-detected when omitted.
//   hasHeader — false treats every row as data and synthesizes headers
//     ('Name', 'Column 2', …), so a plain one-name-per-line paste auto-maps
//     its only column to the name role.
// Returns { headers, rows, delimiter, raggedRows } — `delimiter` is the one
// actually used, `raggedRows` counts data rows whose raw cell count differs
// from the header row (usually a sign the wrong delimiter was picked).
export function parseCsv(text, { delimiter, hasHeader = true } = {}) {
  // Strip a leading UTF-8 BOM (U+FEFF). Spreadsheet exports (e.g. Excel "CSV
  // UTF-8") prepend one; left in place it becomes part of the first header
  // ("Person" with a hidden BOM), breaking alias auto-detection and field-key
  // matching.
  const raw = String(text ?? '')
  const source = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const delim = CSV_DELIMITERS.includes(delimiter) ? delimiter : detectDelimiter(source)
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < source.length; i++) {
    const c = source[i]

    if (inQuotes) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }

    if (c === '"') {
      inQuotes = true
    } else if (c === delim) {
      endField()
    } else if (c === '\n') {
      endRow()
    } else if (c === '\r') {
      endRow()
      if (source[i + 1] === '\n') i++
    } else {
      field += c
    }
  }
  endRow()

  const nonEmpty = rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [], delimiter: delim, raggedRows: 0 }
  }

  // Headerless input (e.g. a pasted name list): synthesize headers sized to the
  // widest row. 'Name' matches the single-name aliases, so the first column
  // auto-maps to the name role in the import dialog.
  const headers = hasHeader
    ? nonEmpty[0].map((h) => h.trim())
    : Array.from(
        { length: Math.max(...nonEmpty.map((cells) => cells.length)) },
        (_, j) => (j === 0 ? 'Name' : `Column ${j + 1}`),
      )
  const cellRows = hasHeader ? nonEmpty.slice(1) : nonEmpty
  let raggedRows = 0
  const dataRows = cellRows.map((cells) => {
    if (cells.length !== headers.length) raggedRows += 1
    const obj = {}
    headers.forEach((h, j) => {
      obj[h] = (cells[j] ?? '').trim()
    })
    return obj
  })

  return { headers, rows: dataRows, delimiter: delim, raggedRows }
}

// Convert a parsed JSON array of flat objects into the same { headers, rows }
// tabular shape parseCsv produces, so a JSON participant list flows through the
// standard mapping dialog. Headers are the union of keys in first-appearance
// order; values are stringified (nested objects/arrays as JSON).
export function tabularizeJsonList(parsed) {
  if (!Array.isArray(parsed)) {
    throw new Error('JSON participant list must be an array of objects.')
  }
  const headers = []
  const seen = new Set()
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i]
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`JSON list entry at index ${i} is not an object.`)
    }
    for (const key of Object.keys(item)) {
      if (!seen.has(key)) {
        seen.add(key)
        headers.push(key)
      }
    }
  }
  const toCell = (v) => {
    if (v == null) return ''
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v).trim()
  }
  const rows = parsed.map((item) => {
    const obj = {}
    for (const h of headers) obj[h] = toCell(item[h])
    return obj
  })
  return { headers, rows }
}

const normHeader = (h) => h.toLowerCase().replace(/[\s_]+/g, '')

function findHeader(headers, aliases) {
  for (const h of headers) {
    if (aliases.includes(normHeader(h))) return h
  }
  return null
}

// Header aliases that should default to "name" (headline) columns. First/last
// reproduce the old person behaviour; the single-name aliases let lists like
// restaurants/games auto-map their one identifying column.
const FIRST_ALIASES = ['firstname', 'first', 'fname', 'givenname']
const LAST_ALIASES = ['lastname', 'last', 'lname', 'surname', 'familyname']
const SINGLE_NAME_ALIASES = ['name', 'fullname', 'person', 'title', 'restaurant', 'item', 'game', 'team']
// Columns that identify a participant (used as their stable identity) and
// columns that carry a per-participant entry count / weight.
const ID_ALIASES = ['id', 'userid', 'participantid', 'memberid', 'attendeeid', 'uuid']
const ENTRIES_ALIASES = [
  'entries',
  'entry',
  'count',
  'tickets',
  'days',
  'daysattended',
  'attendance',
  'weight',
  'odds',
]

// Build a default column mapping for the import dialog. Each entry is
// { key, role, label, include }, where `role` is 'name' | 'detail' | 'id' |
// 'entries' and `key` is the original header. First/Last columns auto-map to
// name; if neither is present, a single recognizable name column (Name,
// Restaurant, …) is used. A recognizable id/entries column maps to its role.
// Everything else defaults to a detail field. Empty headers are excluded.
export function suggestMapping(headers) {
  const firstHeader = findHeader(headers, FIRST_ALIASES)
  const lastHeader = findHeader(headers, LAST_ALIASES)
  const singleHeader = !firstHeader && !lastHeader ? findHeader(headers, SINGLE_NAME_ALIASES) : null
  const idHeader = findHeader(headers, ID_ALIASES)
  const entriesHeader = findHeader(headers, ENTRIES_ALIASES)
  return headers.map((h) => {
    let role = 'detail'
    if (h === firstHeader || h === lastHeader || h === singleHeader) role = 'name'
    else if (h === idHeader) role = 'id'
    else if (h === entriesHeader) role = 'entries'
    return { key: h, role, label: h, include: h.trim() !== '' }
  })
}

// Parse a raw entry-count cell to an integer weight. Blank / non-numeric values
// default to 1 (everyone gets at least one chance); a valid number is floored
// and clamped at 0 (an explicit 0 keeps the participant but excludes them from
// the draw).
function parseEntries(raw) {
  const s = String(raw ?? '').trim()
  if (s === '') return 1
  const n = Number(s)
  if (!Number.isFinite(n)) return 1
  return Math.max(0, Math.floor(n))
}

// The number of draw entries (weight) a participant holds. Missing/invalid
// `entries` defaults to 1, so legacy pools draw uniformly as before.
export function entryWeight(p) {
  const n = p?.entries
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 1
}

// Map parsed rows to { id, fields } participants using a column mapping from the
// import dialog. The custom `label` becomes the field key (so labels flow
// straight through to display/filters/export). Skipped/excluded columns are
// dropped; rows whose name-role values are all empty are skipped.
export function normalizeWithMapping(rows, mapping) {
  const used = (mapping || []).filter((m) => m.include && m.role !== 'skip')
  const nameCols = used.filter((m) => m.role === 'name')
  // Id and entries are identity/weight metadata, not display fields, so they are
  // pulled out of the row separately and kept off the `fields` map.
  const idCol = used.find((m) => m.role === 'id')
  const entriesCol = used.find((m) => m.role === 'entries')
  const fieldCols = used.filter((m) => m.role === 'name' || m.role === 'detail')
  const participants = []
  for (const row of rows) {
    const nameVals = nameCols.map((m) => (row[m.key] ?? '').trim())
    if (nameVals.length && nameVals.every((v) => v === '')) continue
    const fields = {}
    for (const m of fieldCols) {
      const value = (row[m.key] ?? '').trim()
      if (value !== '') fields[(m.label || m.key).trim()] = value
    }
    if (Object.keys(fields).length === 0) continue
    const entries = entriesCol ? parseEntries(row[entriesCol.key]) : 1
    const externalId = idCol ? (row[idCol.key] ?? '').trim() : ''
    const participant = { id: externalId || uid(), fields, entries }
    if (externalId) participant.externalId = true
    participants.push(participant)
  }
  return participants
}

// Stable key used to exclude prior winners (and in-pool duplicates) on import,
// and to match returning people in accumulate mode. When the participant has an
// imported id, that id *is* the identity (so re-imports dedupe and two people
// with identical fields but different ids stay distinct). The id is kept
// case-sensitive — external ids like "U1" and "u1" are distinct identities.
// Otherwise the key is built from every field, so two entries sharing a
// headline but differing in another column are treated separately.
export function participantKey(p) {
  if (p.externalId) return `id=${p.id}`
  const fields = p.fields || {}
  return Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('|')
    .toLowerCase()
}

// Convert a legacy participant ({ firstName, lastName, extras }) to the generic
// { id, fields } shape. Idempotent: already-migrated objects are returned as-is.
export function migrateParticipant(p) {
  if (p && p.fields && typeof p.fields === 'object') return p
  const fields = {}
  if (p.firstName) fields['First Name'] = p.firstName
  if (p.lastName) fields['Last Name'] = p.lastName
  Object.assign(fields, p.extras || {})
  return { id: p.id || uid(), fields }
}

export function migrateParticipants(list) {
  return Array.isArray(list) ? list.map(migrateParticipant) : []
}
