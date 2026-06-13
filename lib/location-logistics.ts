export const productionLocation = {
  address: "Санкт-Петербург, Уральская улица, 13",
  latitude: 59.9532837,
  longitude: 30.2630469
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function clampMinutes(value: number) {
  return Math.max(3, Math.min(90, Math.round(value)))
}

export function dgisFirmUrl(dgisId?: string | null) {
  const id = cleanText(dgisId)
  return id ? `https://2gis.ru/spb/firm/${encodeURIComponent(id)}` : null
}

export function dgisSearchUrl(input: { name?: string | null; city?: string | null; address?: string | null }) {
  const query = [cleanText(input.name), cleanText(input.address), cleanText(input.city) ?? "Санкт-Петербург"].filter(Boolean).join(" ")
  return query ? `https://2gis.ru/spb/search/${encodeURIComponent(query)}` : null
}

export function normalizeDgisUrl(input: {
  dgisUrl?: string | null
  dgisId?: string | null
  name?: string | null
  city?: string | null
  address?: string | null
}) {
  const direct = cleanText(input.dgisUrl)
  if (direct && /2gis\.ru/i.test(direct)) return direct
  return dgisFirmUrl(input.dgisId) ?? dgisSearchUrl(input)
}

export function estimateDriveMinutesFromWalk(walkMin?: number | null) {
  const value = Number(walkMin)
  if (!Number.isFinite(value) || value <= 0) return null
  return clampMinutes(3 + value * 0.55)
}

export function estimateDriveMinutesFromCoordinates(latitude?: number | null, longitude?: number | null) {
  const lat = Number(latitude)
  const lon = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const earthRadiusKm = 6371
  const dLat = ((lat - productionLocation.latitude) * Math.PI) / 180
  const dLon = ((lon - productionLocation.longitude) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((productionLocation.latitude * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  const directKm = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return clampMinutes(8 + directKm * 4.2)
}

export function estimateDriveMinutesFromText(input: {
  address?: string | null
  district?: string | null
  city?: string | null
  segment?: string | null
}) {
  const text = [input.address, input.district, input.city, input.segment].filter(Boolean).join(" ").toLowerCase()
  if (!text.trim()) return null
  if (/уральск[^0-9]{0,30}13\b/.test(text)) return 3
  if (/уральск/.test(text)) return 6
  if (/василеостров|в\.о\.|линия в\.о|средний проспект|малый в\.о|большой проспект в\.о|университетская/.test(text)) return 18
  if (/кронверк|петроград|профессора попова|аптекар/.test(text)) return 28
  if (/централь|адмиралтей|мойк|грибоедов|морская|красноармейск|московский проспект|правды|фонтанк|моховая|соляной|дворцовая/.test(text)) return 35
  if (/киров|балтийск|двинская|декабристов|лоцманская|черниговская/.test(text)) return 42
  if (/калинин|политехническ|литовская|выборг|кудров|мурино|парнас|парголов|всеволож|ленинградская область/.test(text)) return 55
  if (/невск|большевиков|красногвард|малоохтинск|охта/.test(text)) return 50
  if (/аэропорт|пулково/.test(text)) return 60
  if (/городская сеть|сеть|несколько адресов|город\/область|спб\/ло/.test(text)) return 45
  return 40
}

export function normalizeDriveMinutes(input: {
  value?: number | null
  walkMin?: number | null
  latitude?: number | null
  longitude?: number | null
  address?: string | null
  district?: string | null
  city?: string | null
  segment?: string | null
}) {
  const explicit = Number(input.value)
  if (Number.isFinite(explicit) && explicit > 0) return clampMinutes(explicit)
  return (
    estimateDriveMinutesFromCoordinates(input.latitude, input.longitude) ??
    estimateDriveMinutesFromWalk(input.walkMin) ??
    estimateDriveMinutesFromText(input) ??
    45
  )
}
