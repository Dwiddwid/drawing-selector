import { describe, it, expect } from 'vitest'
import { formatWinnerName, visibleWinnerFields, collectFieldKeys } from './winnerDisplay.js'

function person(firstName, lastName, extras = {}) {
  const fields = {}
  if (firstName) fields['First Name'] = firstName
  if (lastName) fields['Last Name'] = lastName
  Object.assign(fields, extras)
  return { id: `${firstName}-${lastName}`, fields }
}

describe('formatWinnerName', () => {
  const ada = person('Ada', 'Lovelace')

  it('joins the configured name fields (first-last default)', () => {
    const config = { nameKeys: ['First Name', 'Last Name'], nameSeparator: ' ' }
    expect(formatWinnerName(ada, config)).toBe('Ada Lovelace')
  })

  it('formats a single name field', () => {
    expect(formatWinnerName(ada, { nameKeys: ['First Name'] })).toBe('Ada')
  })

  it('formats last, first with a custom separator', () => {
    const config = { nameKeys: ['Last Name', 'First Name'], nameSeparator: ', ' }
    expect(formatWinnerName(ada, config)).toBe('Lovelace, Ada')
  })

  it('handles a missing name part gracefully', () => {
    const config = { nameKeys: ['Last Name', 'First Name'], nameSeparator: ', ' }
    expect(formatWinnerName(person('Cher', ''), config)).toBe('Cher')
    expect(formatWinnerName(person('', 'Smith'), { nameKeys: ['First Name', 'Last Name'] })).toBe(
      'Smith',
    )
  })

  it('works for a generic single-name list (restaurants)', () => {
    const r = { id: 'r1', fields: { Restaurant: "Joe's Diner", Cuisine: 'American' } }
    expect(formatWinnerName(r, { nameKeys: ['Restaurant'] })).toBe("Joe's Diner")
  })
})

describe('visibleWinnerFields', () => {
  const winner = person('Ada', 'Lovelace', { Grade: '3', Bus: '12B', Parent: '' })

  it('returns only visible fields with values, in configured order', () => {
    const config = {
      nameKeys: ['First Name', 'Last Name'],
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

  it('excludes name fields so they do not duplicate the headline', () => {
    const config = {
      nameKeys: ['First Name', 'Last Name'],
      fields: [
        { key: 'First Name', label: 'First Name', visible: true },
        { key: 'Grade', label: 'Grade', visible: true },
      ],
    }
    expect(visibleWinnerFields(winner, config)).toEqual([
      { key: 'Grade', label: 'Grade', value: '3' },
    ])
  })

  it('skips fields toggled off', () => {
    const config = { nameKeys: [], fields: [{ key: 'Grade', label: 'Grade', visible: false }] }
    expect(visibleWinnerFields(winner, config)).toEqual([])
  })

  it('falls back to key when label is empty', () => {
    const config = { nameKeys: [], fields: [{ key: 'Grade', label: '', visible: true }] }
    expect(visibleWinnerFields(winner, config)[0].label).toBe('Grade')
  })
})

describe('collectFieldKeys', () => {
  it('unions field keys across participants in first-seen order', () => {
    const people = [
      person('Ada', 'Lovelace', { Grade: '3', Bus: '12B' }),
      person('Alan', 'Turing', { Bus: '5A', Parent: 'Yes' }),
    ]
    expect(collectFieldKeys(people)).toEqual(['First Name', 'Last Name', 'Grade', 'Bus', 'Parent'])
  })

  it('returns an empty array when there are no participants', () => {
    expect(collectFieldKeys([])).toEqual([])
  })
})
