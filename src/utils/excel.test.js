import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseWorkbook } from './excel.js'

// Build a real .xlsx ArrayBuffer in-test so parseWorkbook exercises the same
// SheetJS read path the browser uses.
function workbookBuffer(sheets) {
  const wb = XLSX.utils.book_new()
  for (const [name, aoa] of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name)
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}

describe('parseWorkbook', () => {
  it('parses a single sheet into headers and row objects', async () => {
    const buffer = workbookBuffer([
      ['People', [['First Name', 'Last Name'], ['Ada', 'Lovelace'], ['Alan', 'Turing']]],
    ])
    const sheets = await parseWorkbook(buffer)
    expect(sheets).toHaveLength(1)
    expect(sheets[0].name).toBe('People')
    expect(sheets[0].headers).toEqual(['First Name', 'Last Name'])
    expect(sheets[0].rows).toEqual([
      { 'First Name': 'Ada', 'Last Name': 'Lovelace' },
      { 'First Name': 'Alan', 'Last Name': 'Turing' },
    ])
  })

  it('returns every non-empty sheet and skips empty ones', async () => {
    const buffer = workbookBuffer([
      ['Day 1', [['Name'], ['Ada']]],
      ['Empty', [[]]],
      ['Day 2', [['Name'], ['Alan'], ['Grace']]],
    ])
    const sheets = await parseWorkbook(buffer)
    expect(sheets.map((s) => s.name)).toEqual(['Day 1', 'Day 2'])
    expect(sheets[1].rows).toHaveLength(2)
  })

  it('stringifies numeric cells and fills missing cells with empty strings', async () => {
    const buffer = workbookBuffer([
      ['Sheet1', [['Name', 'Entries'], ['Ada', 3], ['Alan']]],
    ])
    const [sheet] = await parseWorkbook(buffer)
    expect(sheet.rows[0].Entries).toBe('3')
    expect(sheet.rows[1]).toEqual({ Name: 'Alan', Entries: '' })
  })

  it('returns an empty list for a workbook with no data', async () => {
    const buffer = workbookBuffer([['Sheet1', [[]]]])
    expect(await parseWorkbook(buffer)).toEqual([])
  })
})
