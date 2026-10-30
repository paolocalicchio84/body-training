export const MONTH_NAMES = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
] as const

export function todayIso(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function currentMonthId(now = new Date()): string {
  return todayIso(now).slice(0, 7)
}

export function isMonthId(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  return year >= 1 && year <= 9999 && month >= 1 && month <= 12
}

export function isValidDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return false
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function monthIdFromDate(iso: string): string | null {
  if (!isValidDate(iso)) return null
  return iso.slice(0, 7)
}

export function formatMonthId(monthId: string): string {
  if (!isMonthId(monthId)) return monthId
  const [year, month] = monthId.split('-').map(Number)
  return `${MONTH_NAMES[month - 1]} ${year}`
}

export function formatMonthTitle(monthId: string): string {
  const label = formatMonthId(monthId)
  return label.charAt(0).toLocaleUpperCase('it') + label.slice(1)
}

export function formatDateLong(iso: string): string {
  if (!isValidDate(iso)) return iso
  const [year, month, day] = iso.split('-').map(Number)
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`
}
