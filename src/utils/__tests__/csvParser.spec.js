import { describe, it, expect } from 'vitest'
import { csvToJSON } from '../csvParser.js'

describe('csvToJSON', () => {
  it('parses a standard CSV with headers', () => {
    const csv = 'First Name,Last Name,School Grade\nAlice,Smith,5\nBob,Jones,6'
    const result = csvToJSON(csv)
    expect(result).toEqual([
      { 'First Name': 'Alice', 'Last Name': 'Smith', 'School Grade': '5' },
      { 'First Name': 'Bob', 'Last Name': 'Jones', 'School Grade': '6' },
    ])
  })

  it('handles \\r\\n line endings', () => {
    const csv = 'First Name,Last Name\r\nAlice,Smith\r\nBob,Jones'
    const result = csvToJSON(csv)
    expect(result).toHaveLength(2)
    expect(result[0]['First Name']).toBe('Alice')
  })

  it('handles \\r line endings', () => {
    const csv = 'First Name,Last Name\rAlice,Smith\rBob,Jones'
    const result = csvToJSON(csv)
    expect(result).toHaveLength(2)
  })

  it('skips blank lines', () => {
    const csv = 'First Name,Last Name\nAlice,Smith\n\nBob,Jones\n'
    const result = csvToJSON(csv)
    expect(result).toHaveLength(2)
  })

  it('returns empty array for header-only CSV', () => {
    const csv = 'First Name,Last Name,School Grade'
    const result = csvToJSON(csv)
    expect(result).toEqual([])
  })

  it('handles trailing newline at end of file', () => {
    const csv = 'First Name,Last Name\nAlice,Smith\n'
    const result = csvToJSON(csv)
    expect(result).toHaveLength(1)
  })

  it('preserves whitespace in field values', () => {
    const csv = 'First Name,Last Name\n Alice , Smith '
    const result = csvToJSON(csv)
    expect(result[0]['First Name']).toBe(' Alice ')
    expect(result[0]['Last Name']).toBe(' Smith ')
  })

  it('handles single-column CSV', () => {
    const csv = 'Name\nAlice\nBob'
    const result = csvToJSON(csv)
    expect(result).toEqual([{ Name: 'Alice' }, { Name: 'Bob' }])
  })

  it('handles many columns', () => {
    const csv = 'A,B,C,D,E\n1,2,3,4,5'
    const result = csvToJSON(csv)
    expect(result[0]).toEqual({ A: '1', B: '2', C: '3', D: '4', E: '5' })
  })

  it('sets undefined for missing fields in a row', () => {
    const csv = 'First Name,Last Name,School Grade\nAlice,Smith'
    const result = csvToJSON(csv)
    expect(result[0]['School Grade']).toBeUndefined()
  })
})
