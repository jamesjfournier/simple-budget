export function parseMoney(input) {
  const cleaned = String(input ?? '').replace(/[$,\s]/g, '')
  if (cleaned === '' || cleaned === '.') return 0
  if (!/^\d*\.?\d{0,2}$/.test(cleaned) || cleaned === '') return null
  const [dollars, fraction = ''] = cleaned.split('.')
  const cents = `${fraction}00`.slice(0, 2)
  return Number(dollars || '0') * 100 + Number(cents)
}

export function isPartialMoney(input) {
  return input === '' || /^\d*\.?\d{0,2}$/.test(input)
}

export function formatMoney(cents) {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(Math.round(cents))
  const dollars = Math.floor(abs / 100)
  const rest = String(abs % 100).padStart(2, '0')
  return `${sign}$${dollars.toLocaleString('en-US')}.${rest}`
}

export function centsToInput(cents) {
  if (!cents) return ''
  const dollars = Math.floor(cents / 100)
  const rest = cents % 100
  if (rest === 0) return String(dollars)
  return `${dollars}.${String(rest).padStart(2, '0')}`
}

export function compactMoney(cents) {
  const dollars = Math.abs(cents) / 100
  if (dollars >= 10000) return `$${Math.round(dollars / 1000)}k`
  if (dollars >= 1000) {
    const rounded = dollars / 1000
    const text = rounded >= 10 ? rounded.toFixed(0) : rounded.toFixed(1).replace(/\.0$/, '')
    return `$${text}k`
  }
  return formatMoney(cents).replace(/\.00$/, '')
}

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date, days) {
  const next = startOfDay(date)
  next.setDate(next.getDate() + days)
  return next
}

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function addMonths(date, count) {
  const next = startOfDay(date)
  const day = next.getDate()
  next.setDate(1)
  next.setMonth(next.getMonth() + count)
  next.setDate(Math.min(day, daysInMonth(next.getFullYear(), next.getMonth())))
  return next
}

export function dueDateThisMonth(dueDay, today) {
  const day = Math.min(dueDay, daysInMonth(today.getFullYear(), today.getMonth()))
  return new Date(today.getFullYear(), today.getMonth(), day)
}

export function localDateISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseISODate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = parseISODate(value)
  return !Number.isNaN(date.getTime()) && localDateISO(date) === value
}

export function resolveDueDate(expense, today) {
  if (isISODate(expense?.dueDate)) return expense.dueDate
  const day = Number(expense?.dueDay)
  if (!Number.isInteger(day) || day < 1 || day > 31) return null
  let due = dueDateThisMonth(day, today)
  if (startOfDay(today) > due) due = addMonths(due, 1)
  return localDateISO(due)
}

export function savingsTicks(goalCents) {
  const goal = Math.round(goalCents)
  if (goal <= 0) return [0]
  const rough = Math.max(goal / 4, 1)
  const pow = 10 ** Math.floor(Math.log10(rough))
  let step = 10 * pow
  for (const base of [1, 2, 2.5, 5, 10]) {
    const candidate = base * pow
    if (goal / candidate <= 5) {
      step = candidate
      break
    }
  }
  step = Math.max(1, Math.round(step))
  const ticks = [0]
  for (let value = step; value < goal; value += step) {
    if (goal - value < step * 0.35) break
    ticks.push(value)
  }
  ticks.push(goal)
  return ticks
}

export function formatShortDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatLongDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ordinal(day) {
  const tens = day % 100
  if (tens >= 11 && tens <= 13) return `${day}th`
  switch (day % 10) {
    case 1:
      return `${day}st`
    case 2:
      return `${day}nd`
    case 3:
      return `${day}rd`
    default:
      return `${day}th`
  }
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return `id-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char])
}
