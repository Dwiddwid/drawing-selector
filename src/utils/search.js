// Case-insensitive participant search used by the admin lists. Matches against
// the full name and every extras value so "12B" finds everyone on that bus
// route just like "smith" finds the Smiths.
export function filterParticipants(list, query) {
  const q = (query ?? '').trim().toLowerCase()
  if (!q) return list
  return list.filter((p) => {
    const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.toLowerCase()
    if (name.includes(q)) return true
    return Object.values(p.extras ?? {}).some((v) => String(v).toLowerCase().includes(q))
  })
}
