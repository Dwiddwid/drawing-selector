import { describe, it, expect, vi, afterEach } from 'vitest'
import { downloadWinnersCsv, exportStateJson, deserializeState } from './export.js'

function person(firstName, lastName, extras = {}) {
  const fields = {}
  if (firstName) fields['First Name'] = firstName
  if (lastName) fields['Last Name'] = lastName
  Object.assign(fields, extras)
  return { id: `${firstName}-${lastName}`, fields }
}

// Sets up stubs for the browser download APIs that jsdom does not implement.
// Returns helpers to read what was passed to Blob and to the anchor element.
function setupDownloadEnv() {
  let content = ''
  const anchor = { href: '', download: '', click: vi.fn() }

  vi.stubGlobal(
    'Blob',
    class {
      constructor(parts) {
        content = parts.join('')
      }
    },
  )
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(document, 'createElement').mockReturnValue(anchor)

  return { getContent: () => content, anchor }
}

describe('deserializeState', () => {
  it('parses valid JSON into candidates and winners arrays', () => {
    const ada = person('Ada', 'Lovelace')
    const { candidates, winners } = deserializeState(
      JSON.stringify({ candidates: [ada], winners: [] }),
    )
    expect(candidates).toEqual([ada])
    expect(winners).toEqual([])
  })

  it('throws on invalid JSON', () => {
    expect(() => deserializeState('not-json')).toThrow('Invalid JSON file.')
  })

  it('throws when candidates is missing', () => {
    expect(() => deserializeState(JSON.stringify({ winners: [] }))).toThrow(/candidates/i)
  })

  it('throws when winners is not an array', () => {
    expect(() => deserializeState(JSON.stringify({ candidates: [], winners: null }))).toThrow()
  })

  it('accepts empty arrays', () => {
    expect(deserializeState(JSON.stringify({ candidates: [], winners: [] }))).toEqual({
      candidates: [],
      winners: [],
    })
  })

  it('round-trips entries and externalId on participants', () => {
    const weighted = { id: 'u1', externalId: true, fields: { Name: 'Ada' }, entries: 7 }
    const { candidates } = deserializeState(
      JSON.stringify({ candidates: [weighted], winners: [] }),
    )
    expect(candidates[0]).toEqual(weighted)
  })

  it('migrates legacy { firstName, lastName, extras } records from old backups', () => {
    const legacy = { id: 'x', firstName: 'Ada', lastName: 'Lovelace', extras: { Grade: '3' } }
    const { candidates } = deserializeState(
      JSON.stringify({ candidates: [legacy], winners: [] }),
    )
    expect(candidates[0]).toEqual({
      id: 'x',
      fields: { 'First Name': 'Ada', 'Last Name': 'Lovelace', Grade: '3' },
    })
  })

  it('throws when the top level is not an object', () => {
    expect(() => deserializeState('null')).toThrow('JSON must have "candidates" and "winners" arrays.')
    expect(() => deserializeState('42')).toThrow('JSON must have "candidates" and "winners" arrays.')
  })

  it('rejects non-object list entries with the list name and index', () => {
    expect(() =>
      deserializeState(JSON.stringify({ candidates: ['Ada'], winners: [] })),
    ).toThrow('Invalid candidates entry at index 0 — expected an object.')
    expect(() =>
      deserializeState(JSON.stringify({ candidates: [], winners: [person('A', 'B'), null] })),
    ).toThrow('Invalid winners entry at index 1 — expected an object.')
    expect(() =>
      deserializeState(JSON.stringify({ candidates: [[]], winners: [] })),
    ).toThrow('Invalid candidates entry at index 0 — expected an object.')
  })

  it('rejects entries that are neither current nor legacy participant shapes', () => {
    expect(() =>
      deserializeState(JSON.stringify({ candidates: [{ id: 'x', fields: 'oops' }], winners: [] })),
    ).toThrow('Invalid candidates entry at index 0 — missing a "fields" map.')
    expect(() =>
      deserializeState(JSON.stringify({ candidates: [{ id: 'x' }], winners: [] })),
    ).toThrow('missing a "fields" map')
    // Legacy records with any of the old keys still pass (they're migratable).
    expect(() =>
      deserializeState(JSON.stringify({ candidates: [{ firstName: 'Ada' }], winners: [] })),
    ).not.toThrow()
  })
})

describe('downloadWinnersCsv', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns false and skips the download when winners list is empty', () => {
    const { anchor } = setupDownloadEnv()
    expect(downloadWinnersCsv([])).toBe(false)
    expect(anchor.click).not.toHaveBeenCalled()
  })

  it('returns true for a non-empty winners list', () => {
    setupDownloadEnv()
    expect(downloadWinnersCsv([person('Ada', 'Lovelace')])).toBe(true)
  })

  it('produces correct header and data rows', () => {
    const { getContent } = setupDownloadEnv()
    downloadWinnersCsv([person('Ada', 'Lovelace', { Grade: '3', Bus: '12B' })])
    const [header, row] = getContent().split('\r\n')
    expect(header).toBe('"First Name","Last Name","Grade","Bus"')
    expect(row).toBe('"Ada","Lovelace","3","12B"')
  })

  it('escapes embedded double-quotes in values', () => {
    const { getContent } = setupDownloadEnv()
    downloadWinnersCsv([person('Say "Hi"', 'Doe')])
    expect(getContent()).toContain('"Say ""Hi"""')
  })

  it('unions extra keys across all winners', () => {
    const { getContent } = setupDownloadEnv()
    downloadWinnersCsv([
      person('Ada', 'Lovelace', { Grade: '3' }),
      person('Alan', 'Turing', { Bus: '5A' }),
    ])
    const header = getContent().split('\r\n')[0]
    expect(header).toContain('"Grade"')
    expect(header).toContain('"Bus"')
  })

  it('fills missing extra values with empty strings', () => {
    const { getContent } = setupDownloadEnv()
    downloadWinnersCsv([person('Ada', 'Lovelace', { Grade: '3' }), person('Alan', 'Turing', {})])
    const rows = getContent().split('\r\n')
    expect(rows[2]).toBe('"Alan","Turing",""')
  })

  it('sets the anchor download attribute to winners.csv', () => {
    const { anchor } = setupDownloadEnv()
    downloadWinnersCsv([person('Ada', 'Lovelace')])
    expect(anchor.download).toBe('winners.csv')
  })
})

describe('exportStateJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('serializes candidates and winners into valid JSON', () => {
    const { getContent } = setupDownloadEnv()
    const candidates = [person('Ada', 'Lovelace')]
    const winners = [person('Alan', 'Turing')]
    exportStateJson(candidates, winners)
    const parsed = JSON.parse(getContent())
    expect(parsed.candidates).toEqual(candidates)
    expect(parsed.winners).toEqual(winners)
  })

  it('sets the anchor download attribute to drawing-state.json', () => {
    const { anchor } = setupDownloadEnv()
    exportStateJson([], [])
    expect(anchor.download).toBe('drawing-state.json')
  })

  it('includes settings when provided', () => {
    const { getContent } = setupDownloadEnv()
    const settings = { isPro: true, theme: { primary: '#000000' } }
    exportStateJson([], [], settings)
    expect(JSON.parse(getContent()).settings).toEqual(settings)
  })

  it('omits the settings key when not provided', () => {
    const { getContent } = setupDownloadEnv()
    exportStateJson([], [])
    expect('settings' in JSON.parse(getContent())).toBe(false)
  })
})

describe('deserializeState settings', () => {
  it('returns settings when present', () => {
    const { settings } = deserializeState(
      JSON.stringify({ candidates: [], winners: [], settings: { isPro: false } }),
    )
    expect(settings).toEqual({ isPro: false })
  })

  it('omits settings when absent (backward compatible)', () => {
    const result = deserializeState(JSON.stringify({ candidates: [], winners: [] }))
    expect('settings' in result).toBe(false)
  })
})
