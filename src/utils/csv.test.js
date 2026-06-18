import { describe, it, expect } from 'vitest'
import {
  parseCsv,
  suggestMapping,
  normalizeWithMapping,
  participantKey,
  migrateParticipant,
  migrateParticipants,
} from './csv.js'

describe('parseCsv', () => {
  it('parses basic rows into header-keyed objects', () => {
    const { headers, rows } = parseCsv('First Name,Last Name\nAda,Lovelace\nAlan,Turing')
    expect(headers).toEqual(['First Name', 'Last Name'])
    expect(rows).toEqual([
      { 'First Name': 'Ada', 'Last Name': 'Lovelace' },
      { 'First Name': 'Alan', 'Last Name': 'Turing' },
    ])
  })

  it('handles quoted fields containing commas', () => {
    const { rows } = parseCsv('First Name,Last Name\nJohn,"Smith, Jr."')
    expect(rows[0]['Last Name']).toBe('Smith, Jr.')
  })

  it('handles escaped double quotes', () => {
    const { rows } = parseCsv('First Name,Last Name\n"A ""B"" C",Doe')
    expect(rows[0]['First Name']).toBe('A "B" C')
  })

  it('handles CRLF and CR line endings', () => {
    const crlf = parseCsv('First Name,Last Name\r\nAda,Lovelace\r\n')
    const cr = parseCsv('First Name,Last Name\rAda,Lovelace')
    expect(crlf.rows).toEqual([{ 'First Name': 'Ada', 'Last Name': 'Lovelace' }])
    expect(cr.rows).toEqual([{ 'First Name': 'Ada', 'Last Name': 'Lovelace' }])
  })

  it('trims headers and values and skips blank lines', () => {
    const { headers, rows } = parseCsv('  First Name , Last Name \n\n Ada , Lovelace \n   \n')
    expect(headers).toEqual(['First Name', 'Last Name'])
    expect(rows).toEqual([{ 'First Name': 'Ada', 'Last Name': 'Lovelace' }])
  })

  it('returns empty result for empty input', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] })
    expect(parseCsv('   \n  ')).toEqual({ headers: [], rows: [] })
  })
})

describe('suggestMapping', () => {
  it('auto-detects first/last name columns as name fields', () => {
    const m = suggestMapping(['first name', 'LASTNAME', 'Grade'])
    expect(m).toEqual([
      { key: 'first name', role: 'name', label: 'first name', include: true },
      { key: 'LASTNAME', role: 'name', label: 'LASTNAME', include: true },
      { key: 'Grade', role: 'detail', label: 'Grade', include: true },
    ])
  })

  it('detects a single name column for non-person lists', () => {
    const m = suggestMapping(['Restaurant', 'Cuisine', 'City'])
    expect(m[0]).toMatchObject({ key: 'Restaurant', role: 'name' })
    expect(m[1]).toMatchObject({ key: 'Cuisine', role: 'detail' })
    expect(m[2]).toMatchObject({ key: 'City', role: 'detail' })
  })

  it('marks unrecognized columns as detail', () => {
    const m = suggestMapping(['Color', 'Size'])
    expect(m.every((e) => e.role === 'detail')).toBe(true)
  })
})

describe('normalizeWithMapping', () => {
  const mapping = (entries) =>
    entries.map((e) => ({ include: true, ...e, label: e.label ?? e.key }))

  it('builds fields, using the custom label as the key', () => {
    const { rows } = parseCsv('First Name,Last Name,G\nAda,Lovelace,3')
    const list = normalizeWithMapping(
      rows,
      mapping([
        { key: 'First Name', role: 'name' },
        { key: 'Last Name', role: 'name' },
        { key: 'G', role: 'detail', label: 'Grade' },
      ]),
    )
    expect(list).toHaveLength(1)
    expect(list[0].fields).toEqual({ 'First Name': 'Ada', 'Last Name': 'Lovelace', Grade: '3' })
    expect(list[0].id).toBeTruthy()
  })

  it('supports a single-name list (restaurants)', () => {
    const { rows } = parseCsv('Restaurant,Cuisine\nJoe Diner,American')
    const list = normalizeWithMapping(
      rows,
      mapping([
        { key: 'Restaurant', role: 'name' },
        { key: 'Cuisine', role: 'detail' },
      ]),
    )
    expect(list[0].fields).toEqual({ Restaurant: 'Joe Diner', Cuisine: 'American' })
  })

  it('drops skipped/excluded columns', () => {
    const { rows } = parseCsv('Name,Secret\nAda,hidden')
    const list = normalizeWithMapping(rows, [
      { key: 'Name', role: 'name', label: 'Name', include: true },
      { key: 'Secret', role: 'skip', label: 'Secret', include: false },
    ])
    expect(list[0].fields).toEqual({ Name: 'Ada' })
  })

  it('skips rows whose name values are all empty', () => {
    const { rows } = parseCsv('First Name,Last Name\nAda,Lovelace\n,\nAlan,Turing')
    const list = normalizeWithMapping(
      rows,
      mapping([
        { key: 'First Name', role: 'name' },
        { key: 'Last Name', role: 'name' },
      ]),
    )
    expect(list).toHaveLength(2)
  })

  it('assigns a unique id to each participant', () => {
    const { rows } = parseCsv('Name\nAda\nAlan')
    const list = normalizeWithMapping(rows, mapping([{ key: 'Name', role: 'name' }]))
    expect(list[0].id).toBeTruthy()
    expect(list[0].id).not.toBe(list[1].id)
  })
})

describe('participantKey', () => {
  it('is stable for identical content regardless of case', () => {
    const a = { fields: { 'First Name': 'Ada', 'Last Name': 'Lovelace', Grade: '3' } }
    const b = { fields: { 'First Name': 'ada', 'Last Name': 'LOVELACE', Grade: '3' } }
    expect(participantKey(a)).toBe(participantKey(b))
  })

  it('is order-independent across fields', () => {
    const a = { fields: { 'First Name': 'Ada', Grade: '3' } }
    const b = { fields: { Grade: '3', 'First Name': 'Ada' } }
    expect(participantKey(a)).toBe(participantKey(b))
  })

  it('differs when a field differs', () => {
    const a = { fields: { Name: 'Ada', Bus: '1' } }
    const b = { fields: { Name: 'Ada', Bus: '2' } }
    expect(participantKey(a)).not.toBe(participantKey(b))
  })
})

describe('migrateParticipant', () => {
  it('converts a legacy { firstName, lastName, extras } record', () => {
    const out = migrateParticipant({
      id: 'x',
      firstName: 'Ada',
      lastName: 'Lovelace',
      extras: { Grade: '3' },
    })
    expect(out).toEqual({ id: 'x', fields: { 'First Name': 'Ada', 'Last Name': 'Lovelace', Grade: '3' } })
  })

  it('drops empty name parts', () => {
    const out = migrateParticipant({ id: 'y', firstName: 'Cher', lastName: '', extras: {} })
    expect(out.fields).toEqual({ 'First Name': 'Cher' })
  })

  it('is idempotent for already-migrated records', () => {
    const already = { id: 'z', fields: { Name: 'Ada' } }
    expect(migrateParticipant(already)).toBe(already)
  })

  it('migrateParticipants maps a list and tolerates non-arrays', () => {
    const out = migrateParticipants([{ id: '1', firstName: 'Ada', lastName: 'L', extras: {} }])
    expect(out[0].fields).toEqual({ 'First Name': 'Ada', 'Last Name': 'L' })
    expect(migrateParticipants(null)).toEqual([])
  })
})
