/** Euro interi in centesimi. I calcoli intermedi della ripartizione usano i centesimi esatti. */

export function formatEuro(cents: number): string {
  if (!Number.isSafeInteger(cents)) return '—'
  const sign = cents < 0 ? '−' : ''
  const abs = Math.abs(cents)
  const euros = Math.trunc(abs / 100)
  const frac = abs % 100
  const grouped = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${grouped},${String(frac).padStart(2, '0')} €`
}

export function formatSignedEuro(cents: number): string {
  if (cents > 0) return `+ ${formatEuro(cents)}`
  return formatEuro(cents)
}

/** Valore da rimettere in un campo, senza separatore delle migliaia. */
export function formatAmountInput(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const euros = Math.trunc(abs / 100)
  const frac = abs % 100
  return `${sign}${euros},${String(frac).padStart(2, '0')}`
}

export function formatPercentHundredths(hundredths: number): string {
  const sign = hundredths < 0 ? '−' : ''
  const abs = Math.abs(hundredths)
  const whole = Math.trunc(abs / 100)
  const frac = abs % 100
  return `${sign}${whole},${String(frac).padStart(2, '0')} %`
}

/**
 * Accetta importi italiani: 150, 150,5, 150,50, 2.200,00.
 * Il punto è solo separatore delle migliaia. Al massimo due decimali.
 * Rifiuta negativi, vuoti e più di due decimali.
 */
export function parseMoneyToCents(raw: string): number | null {
  let text = raw.trim().replace(/\s+/g, '').replaceAll('€', '')
  if (!text) return null
  if (text.startsWith('+')) text = text.slice(1)
  if (!text || text.startsWith('-')) return null

  let normalized: string
  if (text.includes(',') && text.includes('.')) {
    if (!/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(text)) return null
    normalized = text.replaceAll('.', '').replace(',', '.')
  } else if (text.includes(',')) {
    if (!/^\d+,\d{1,2}$/.test(text)) return null
    normalized = text.replace(',', '.')
  } else if (text.includes('.')) {
    if (!/^\d{1,3}(\.\d{3})+$/.test(text)) return null
    normalized = text.replaceAll('.', '')
  } else if (!/^\d+$/.test(text)) {
    return null
  } else {
    normalized = text
  }

  const [whole, frac = ''] = normalized.split('.')
  if (frac.length > 2 || !/^\d+$/.test(whole)) return null
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2))
  if (!Number.isSafeInteger(cents)) return null
  return cents
}

export function parseVoucherCount(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d+$/.test(text)) return null
  const count = Number(text)
  if (!Number.isSafeInteger(count)) return null
  return count
}
