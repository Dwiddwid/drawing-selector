import { describe, it, expect } from 'vitest'
import { formatWinnerName, visibleWinnerFields, collectExtraKeys } from './winnerDisplay.js'

function person(firstName, lastName, extras = {}) {
  return { id: `${firstName}-${lastName}`, firstName, lastName, extras }
}

describe('formatWinnerName', () => {
  const ada = person('Ada', 'Lovelace')

  it('formats first-last (default)', () => {
    expect(formatWinnerName(ada, 'first-last')).toBe('Ada Lovelace')
    expect(formatWinnerName(ada, 'unknown')).toBe('Ada Lovelace')
  })

  it('formats first only', () => {
    expect(formatWinnerName(ada, 'first')).toBe('Ada')
  })

  it('formats last, first', () => {
    expect(formatWinnerName(ada, 'last-first')).toBe('Lovelace, Ada')
  })

  it('handles a missing name part gracefully', () => {
    expect(formatWinnerName(person('Cher', ''), 'last-first')).toBe('Cher')
    expect(formatWinnerName(person('', 'Smith'), 'first-last')).toBe('Smith')
  })
})

describe('visibleWinnerFields', () => {
  const winner = person('Ada', 'Lovelace', { Grade: '3', Bus: '12B', Parent: '' })

  it('returns only visible fields with values, in configured order', () => {
    const config = {
      fields: [
        { key: 'Bus', label: 'Bus Route', visible: true },
        { key: 'Grade', label: 'Grade', visible: true },
        { key: 'Parent', label: 'Parent', visible: true }, // empty value -> skipped
      ],
    }
    expect(visibleWinnerFields(winner, config)).toEqual([
      { key: 'Bus', label: 'Bus Route', value: '12B' },
      { key: 'Grade', label: 'Grade', value: '3' },
    ])
  })

  it('skips fields toggled off', () => {
    const config = { fields: [{ key: 'Grade', label: 'Grade', visible: false }] }
    expect(visibleWinnerFields(winner, config)).toEqual([])
  })

  it('falls back to key when label is empty', () => {
    const config = { fields: [{ key: 'Grade', label: '', visible: true }] }
    expect(visibleWinnerFields(winner, config)[0].label).toBe('Grade')
  })
})

describe('collectExtraKeys', () => {
  it('unions extras keys across participants in first-seen order', () => {
    const people = [
      person('Ada', 'Lovelace', { Grade: '3', Bus: '12B' }),
      person('Alan', 'Turing', { Bus: '5A', Parent: 'Yes' }),
    ]
    expect(collectExtraKeys(people)).toEqual(['Grade', 'Bus', 'Parent'])
  })

  it('returns an empty array when there are no extras', () => {
    expect(collectExtraKeys([person('Ada', 'Lovelace')])).toEqual([])
  })
})
