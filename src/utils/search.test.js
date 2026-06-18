import { filterParticipants } from './search.js'

function person(firstName, lastName, extras = {}) {
  const fields = {}
  if (firstName) fields['First Name'] = firstName
  if (lastName) fields['Last Name'] = lastName
  Object.assign(fields, extras)
  return { id: `${firstName}-${lastName}`, fields }
}

const people = [
  { ...person('Ada', 'Lovelace', { Grade: '3', 'Bus Route': '12B' }), id: '1' },
  { ...person('Alan', 'Turing', { Grade: '4' }), id: '2' },
  { ...person('Grace', 'Hopper'), id: '3' },
  { id: '4', fields: { 'First Name': 'Katherine', 'Last Name': 'Johnson' } },
]

describe('filterParticipants', () => {
  it('returns the full list for an empty or whitespace query', () => {
    expect(filterParticipants(people, '')).toEqual(people)
    expect(filterParticipants(people, '   ')).toEqual(people)
    expect(filterParticipants(people, null)).toEqual(people)
    expect(filterParticipants(people, undefined)).toEqual(people)
  })

  it('matches first and last names case-insensitively', () => {
    expect(filterParticipants(people, 'ada').map((p) => p.id)).toEqual(['1'])
    expect(filterParticipants(people, 'HOPPER').map((p) => p.id)).toEqual(['3'])
  })

  it('matches across the full name (query spanning two fields)', () => {
    expect(filterParticipants(people, 'alan tur').map((p) => p.id)).toEqual(['2'])
  })

  it('matches field values', () => {
    expect(filterParticipants(people, '12b').map((p) => p.id)).toEqual(['1'])
    expect(filterParticipants(people, '4').map((p) => p.id)).toEqual(['2'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterParticipants(people, 'zebra')).toEqual([])
  })

  it('tolerates participants without fields', () => {
    expect(filterParticipants(people, 'katherine').map((p) => p.id)).toEqual(['4'])
  })
})
