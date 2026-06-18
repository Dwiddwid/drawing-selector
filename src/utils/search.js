// Case-insensitive participant search used by the admin lists. Matches against
// every field value (and the space-joined combination, so a multi-word query
// like "ada love" still finds someone whose name spans two fields) just like
// "12B" finds everyone on that bus route.
export function filterParticipants(list, query) {
  const q = (query ?? '').trim().toLowerCase()
  if (!q) return list
  return list.filter((p) => {
    const values = Object.values(p.fields ?? {}).map((v) => String(v).toLowerCase())
    if (values.some((v) => v.includes(q))) return true
    return values.join(' ').includes(q)
  })
}
