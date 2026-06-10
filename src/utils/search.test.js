import { filterParticipants } from './search.js'

const people = [
  { id: '1', firstName: 'Ada', lastName: 'Lovelace', extras: { Grade: '3', 'Bus Route': '12B' } },
  { id: '2', firstName: 'Alan', lastName: 'Turing', extras: { Grade: '4' } },
  { id: '3', firstName: 'Grace', lastName: 'Hopper', extras: {} },
  { id: '4', firstName: 'Katherine', lastName: 'Johnson' }, // no extras at all
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

  it('matches across the full name', () => {
    expect(filterParticipants(people, 'alan tur').map((p) => p.id)).toEqual(['2'])
  })

  it('matches extras values', () => {
    expect(filterParticipants(people, '12b').map((p) => p.id)).toEqual(['1'])
    expect(filterParticipants(people, '4').map((p) => p.id)).toEqual(['2'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterParticipants(people, 'zebra')).toEqual([])
  })

  it('tolerates participants without extras', () => {
    expect(filterParticipants(people, 'katherine').map((p) => p.id)).toEqual(['4'])
  })
})
