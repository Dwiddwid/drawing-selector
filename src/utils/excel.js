// Excel (.xlsx) import: convert a workbook into the same { headers, rows }
// tabular shape parseCsv produces, so spreadsheets flow through the standard
// column-mapping dialog.
//
// SheetJS is heavy (~430 KB), so it's loaded lazily on first use — the main
// bundle doesn't grow, it's excluded from the service worker's precache (see
// workbox globIgnores in vite.config.js) so PWA installs don't pay for it, and
// the portable single-file build drops it entirely (callers gate on
// __PORTABLE_BUILD__ before importing this module's parser).

// Turn a sheet's array-of-arrays into trimmed string cells.
const toCell = (v) => {
  if (v == null) return ''
  return String(v).trim()
}

// Parse a workbook from an ArrayBuffer. Returns one entry per non-empty sheet:
// [{ name, headers, rows }] where the first row is treated as the header row.
export async function parseWorkbook(arrayBuffer) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheets = []
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    // header: 1 → array of arrays; raw: false → formatted display strings
    // (dates and numbers come out the way the spreadsheet shows them).
    const grid = XLSX.utils
      .sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
      .map((row) => row.map(toCell))
      .filter((row) => row.some((cell) => cell !== ''))
    if (grid.length === 0) continue
    const headers = grid[0]
    const rows = grid.slice(1).map((cells) => {
      const obj = {}
      headers.forEach((h, j) => {
        obj[h] = cells[j] ?? ''
      })
      return obj
    })
    sheets.push({ name, headers, rows })
  }
  return sheets
}
