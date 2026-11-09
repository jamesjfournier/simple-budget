import {
  addDays,
  addMonths,
  formatMoney,
  formatShortDate,
  isISODate,
  localDateISO,
  monthKey,
  parseISODate,
  parseMoney,
  startOfDay,
  uid,
} from './format.js'

export const PRESETS = ['Rent / Mortgage', 'Internet', 'Cellphone', 'Utilities']
export const MILESTONES = [10, 25, 50, 75, 100]

export function normalizeRepeat(value, fallback = 'monthly') {
  if (value === 'weekly' || value === 'biweekly' || value === 'monthly') return value
  return fallback
}

export function repeatLabel(repeat) {
  if (repeat === 'weekly') return 'Every week'
  if (repeat === 'biweekly') return 'Every 2 weeks'
  return ''
}

function addRepeat(date, repeat) {
  if (repeat === 'weekly') return addDays(date, 7)
  if (repeat === 'biweekly') return addDays(date, 14)
  if (repeat === 'monthly') return addMonths(date, 1)
  return null
}

function cyclesInWindow(dueDate, repeat, payday, today) {
  const end = startOfDay(payday)
  const first = startOfDay(parseISODate(dueDate))
  const today0 = startOfDay(today)
  if (first > end) return 0
  if (repeat === 'monthly') return 1
  let count = 1
  let cursor = first
  while (count < 8) {
    const next = addRepeat(cursor, repeat)
    if (!next) break
    const nextDay = startOfDay(next)
    if (nextDay.getTime() <= cursor.getTime() || nextDay >= end) break
    cursor = nextDay
    if (cursor > today0) count += 1
  }
  return count
}

function advanceIfPaid(dueDate, today, paidOff, repeat) {
  if (!paidOff || !isISODate(dueDate)) return null
  const normalized = normalizeRepeat(repeat, '')
  if (!normalized) return null
  const due = parseISODate(dueDate)
  if (startOfDay(today) < startOfDay(due)) return null
  const next = addRepeat(due, normalized)
  return next ? localDateISO(next) : null
}

export function percentPaid(debt) {
  if (!debt.original) return 0
  return ((debt.original - debt.remaining) / debt.original) * 100
}

export function blankForm() {
  return {
    payFrequency: '',
    typicalPay: '',
    miscBuffer: '',
    debts: [{ id: uid(), name: '', amount: '', minimum: '', repeat: '', dueDate: '' }],
    expenses: PRESETS.map((name) => ({
      id: uid(),
      name,
      amount: '',
      dueDate: '',
      repeat: 'monthly',
      minimum: '',
      preset: true,
    })),
    savingsGoal: '',
    investmentGoal: '',
  }
}

export function formFromBudget(budget) {
  const presetRows = PRESETS.map((name) => {
    const found = budget.expenses.find((expense) => expense.preset && expense.name === name)
    return {
      id: found?.id || uid(),
      name,
      amount: found ? centsInput(found.amount) : '',
      dueDate: found?.dueDate || '',
      repeat: normalizeRepeat(found?.repeat, 'monthly'),
      minimum: found?.minimum ? centsInput(found.minimum) : '',
      preset: true,
    }
  })
  const custom = budget.expenses
    .filter((expense) => !expense.preset)
    .map((expense) => ({
      id: expense.id,
      name: expense.name,
      amount: centsInput(expense.amount),
      dueDate: expense.dueDate || '',
      repeat: normalizeRepeat(expense.repeat, 'monthly'),
      minimum: expense.minimum ? centsInput(expense.minimum) : '',
      preset: false,
    }))
  const debts = budget.debts.map((debt) => ({
    id: debt.id,
    name: debt.name,
    amount: debt.remaining === 0 ? '0' : centsInput(debt.remaining),
    minimum: debt.minimum ? centsInput(debt.minimum) : '',
    repeat: normalizeRepeat(debt.repeat, ''),
    dueDate: debt.dueDate || '',
    settled: debt.remaining === 0,
  }))
  return {
    payFrequency: budget.payFrequency,
    typicalPay: centsInput(budget.typicalPay),
    miscBuffer: centsInput(budget.miscBuffer),
    debts: debts.length ? debts : [{ id: uid(), name: '', amount: '', minimum: '', repeat: '', dueDate: '' }],
    expenses: [...presetRows, ...custom],
    savingsGoal: budget.savingsGoal ? centsInput(budget.savingsGoal) : '',
    investmentGoal: budget.investmentGoal ? centsInput(budget.investmentGoal) : '',
  }
}

function centsInput(cents) {
  if (!cents) return ''
  const dollars = Math.floor(cents / 100)
  const rest = cents % 100
  if (rest === 0) return String(dollars)
  return `${dollars}.${String(rest).padStart(2, '0')}`
}

export function parseDueDate(raw) {
  const text = String(raw ?? '').trim()
  if (text === '') return { ok: true, dueDate: null }
  if (!isISODate(text)) return { ok: false, dueDate: null }
  return { ok: true, dueDate: text }
}

export function applyForm(form, existing, today) {
  if (form.payFrequency !== 'biweekly' && form.payFrequency !== 'monthly') {
    return { ok: false, error: 'Choose how often you get paid.' }
  }
  const typical = parseMoney(form.typicalPay)
  if (typical == null || typical <= 0) {
    return { ok: false, error: 'Enter about how much you get each paycheck.' }
  }
  const misc = parseMoney(form.miscBuffer.trim() === '' ? '0' : form.miscBuffer)
  if (misc == null) {
    return { ok: false, error: 'Enter an everyday spending amount, or 0.' }
  }

  const debts = []
  for (const row of form.debts) {
    const name = row.name.trim()
    const amountRaw = row.amount.trim()
    if (!name && !amountRaw) continue
    if (!name) return { ok: false, error: 'Name each debt.' }
    const amount = parseMoney(amountRaw)
    if (amount == null) return { ok: false, error: `Enter how much you still owe on ${name}.` }
    const prev = existing?.debts.find((debt) => debt.id === row.id)
    const minimumRaw = String(row.minimum ?? '').trim()
    const minimum = minimumRaw === '' ? 0 : parseMoney(minimumRaw)
    if (minimum == null || minimum < 0) {
      return { ok: false, error: `Enter a minimum payment for ${name}, or leave it blank.` }
    }
    if (amount > 0 && minimum > amount) {
      return { ok: false, error: `The minimum for ${name} is more than what's left.` }
    }
    const due = parseDueDate(row.dueDate)
    if (!due.ok) return { ok: false, error: `Pick a due date for the ${name} minimum, or leave it blank.` }
    const repeat = minimum > 0 ? normalizeRepeat(row.repeat, '') : ''
    if (amount === 0) {
      if (!prev) return { ok: false, error: `Enter how much you still owe on ${name}.` }
      debts.push({
        id: row.id,
        name,
        original: prev.original,
        remaining: 0,
        celebrated: MILESTONES,
        minimum: 0,
        repeat: '',
        dueDate: null,
        minimumPaid: 0,
      })
      continue
    }
    if (amount < 0) return { ok: false, error: `Enter how much you still owe on ${name}.` }
    const paidDown = prev ? Math.max(0, prev.original - prev.remaining) : 0
    const original = paidDown + amount
    const pct = original === 0 ? 0 : (paidDown / original) * 100
    let minimumPaid = prev ? Math.min(prev.minimumPaid || 0, minimum) : 0
    if (prev && due.dueDate && prev.dueDate && due.dueDate > prev.dueDate && (prev.minimumPaid || 0) >= (prev.minimum || 0) && (prev.minimum || 0) > 0) {
      minimumPaid = 0
    }
    debts.push({
      id: row.id,
      name,
      original,
      remaining: amount,
      celebrated: MILESTONES.filter((mark) => pct >= mark),
      minimum,
      repeat,
      dueDate: minimum > 0 ? due.dueDate : null,
      minimumPaid,
    })
  }

  const month = monthKey(today)
  const monthChanged = Boolean(existing && existing.expenseMonth && existing.expenseMonth !== month)

  const expenses = []
  for (const row of form.expenses) {
    const name = row.name.trim()
    const amountRaw = row.amount.trim()
    const dueRaw = String(row.dueDate ?? '').trim()
    if (!name && !amountRaw && !dueRaw) continue
    if (!amountRaw && dueRaw) {
      return {
        ok: false,
        error: `Enter a cost for ${name || 'that expense'}, or clear the due date.`,
      }
    }
    if (!amountRaw) continue
    if (!name) return { ok: false, error: 'Name each expense.' }
    const amount = parseMoney(amountRaw)
    if (amount == null || amount <= 0) {
      return { ok: false, error: `Enter a cost for ${name}.` }
    }
    const due = parseDueDate(dueRaw)
    if (!due.ok) {
      return { ok: false, error: `Pick a due date for ${name}, or leave it blank.` }
    }
    const minimumRaw = String(row.minimum ?? '').trim()
    const minimum = minimumRaw === '' ? 0 : parseMoney(minimumRaw)
    if (minimum == null || minimum < 0) {
      return { ok: false, error: `Enter a minimum payment for ${name}, or leave it blank.` }
    }
    if (minimum > amount) {
      return { ok: false, error: `The minimum for ${name} is more than the cost.` }
    }
    const prev = existing?.expenses.find((expense) => expense.id === row.id)
    expenses.push({
      id: row.id,
      name,
      amount,
      dueDate: due.dueDate,
      paid: carriedPaid(prev, amount, due.dueDate, monthChanged),
      repeat: normalizeRepeat(row.repeat, 'monthly'),
      minimum,
      preset: Boolean(row.preset),
    })
  }

  const goalRaw = form.savingsGoal.trim()
  const savingsGoal = goalRaw === '' ? 0 : parseMoney(goalRaw)
  if (savingsGoal == null) return { ok: false, error: 'Enter a savings goal, or leave it blank.' }
  const investRaw = String(form.investmentGoal ?? '').trim()
  const investmentGoal = investRaw === '' ? 0 : parseMoney(investRaw)
  if (investmentGoal == null) return { ok: false, error: 'Enter an investment goal, or leave it blank.' }

  return {
    ok: true,
    budget: {
      payFrequency: form.payFrequency,
      typicalPay: typical,
      miscBuffer: misc,
      debts,
      expenses,
      expenseMonth: month,
      savingsGoal,
      savingsTotal: existing?.savingsTotal || 0,
      savingsHistory: existing?.savingsHistory || [],
      investmentGoal,
      investmentTotal: existing?.investmentTotal || 0,
      investmentHistory: existing?.investmentHistory || [],
      lastPayAmount: existing?.lastPayAmount ?? null,
      lastFundsRemaining: existing?.lastFundsRemaining ?? null,
      fundsAdjusted: Boolean(existing?.fundsAdjusted),
      creditScore: existing?.creditScore ?? null,
      creditPrevious: existing?.creditPrevious ?? null,
      creditCheckedOn: existing?.creditCheckedOn ?? null,
      draft: existing?.draft || null,
    },
  }
}

function carriedPaid(prev, amount, dueDate, monthChanged) {
  if (!prev) return 0
  const paid = Math.min(prev.paid || 0, amount)
  if (!dueDate && monthChanged) return 0
  if (dueDate && prev.dueDate && dueDate > prev.dueDate && prev.paid >= prev.amount) return 0
  return paid
}

export function rollover(budget, today) {
  const key = monthKey(today)
  const monthChanged = budget.expenseMonth !== key
  let changed = monthChanged
  const expenses = budget.expenses.map((expense) => {
    const repeat = normalizeRepeat(expense.repeat, 'monthly')
    let next = expense
    if (monthChanged && !expense.dueDate && repeat === 'monthly') next = { ...expense, paid: 0 }
    let guard = 0
    while (guard < 16) {
      const dueDate = advanceIfPaid(next.dueDate, today, next.amount > 0 && (next.paid || 0) >= next.amount, repeat)
      if (!dueDate) break
      next = { ...next, dueDate, paid: 0 }
      guard += 1
    }
    if (next !== expense) changed = true
    return next
  })
  const debts = budget.debts.map((debt) => {
    const repeat = normalizeRepeat(debt.repeat, '')
    let next = debt
    let guard = 0
    while (guard < 16) {
      const dueDate = advanceIfPaid(
        next.dueDate,
        today,
        (next.minimum || 0) > 0 && (next.minimumPaid || 0) >= next.minimum && next.remaining > 0,
        repeat,
      )
      if (!dueDate) break
      next = { ...next, dueDate, minimumPaid: 0 }
      guard += 1
    }
    if (next !== debt) changed = true
    return next
  })
  if (!changed) return budget
  return { ...budget, expenseMonth: key, expenses, debts }
}

export function nextPayday(today, frequency) {
  return frequency === 'biweekly' ? addDays(today, 14) : addMonths(today, 1)
}

export function billPlan(expense, today, frequency) {
  const repeat = normalizeRepeat(expense.repeat, 'monthly')
  const paid = expense.paid || 0
  const remaining = Math.max(0, expense.amount - paid)
  const payday = nextPayday(today, frequency)
  if (!isISODate(expense.dueDate)) {
    if (remaining === 0) return { remaining, urgent: false, ideal: 0 }
    if (frequency === 'monthly') return { remaining, urgent: true, ideal: remaining }
    const urgent = today.getDate() >= 15
    if (urgent) return { remaining, urgent: true, ideal: remaining }
    const halfway = Math.round(expense.amount / 2)
    return { remaining, urgent: false, ideal: Math.min(remaining, Math.max(0, halfway - paid)) }
  }

  const count = cyclesInWindow(expense.dueDate, repeat, payday, today)
  const ideal = remaining + Math.max(0, count - 1) * expense.amount
  if (count > 0 && ideal > 0) return { remaining: ideal, urgent: true, ideal }
  if (remaining === 0) return { remaining: 0, urgent: false, ideal: 0 }
  if (frequency === 'monthly' || repeat === 'monthly') {
    if (frequency === 'monthly') return { remaining, urgent: true, ideal: remaining }
    const halfway = Math.round(expense.amount / 2)
    return { remaining, urgent: false, ideal: Math.min(remaining, Math.max(0, halfway - paid)) }
  }
  return { remaining, urgent: false, ideal: 0 }
}

export function paymentPlan(expense, today, frequency) {
  const full = billPlan(expense, today, frequency)
  const minimum = Math.min(Math.max(0, expense.minimum || 0), expense.amount || 0)
  if (minimum <= 0) return full
  const minimumLeft = Math.max(0, minimum - (expense.paid || 0))
  if (minimumLeft <= 0 || full.ideal >= minimumLeft) return full
  return { ...full, ideal: minimumLeft }
}

function minimumPlan(debt, today, frequency) {
  const minimum = debt.minimum || 0
  if (minimum <= 0 || debt.remaining <= 0) return { ideal: 0, urgent: false }
  const plan = billPlan(
    {
      amount: minimum,
      paid: Math.min(debt.minimumPaid || 0, minimum),
      dueDate: debt.dueDate || null,
      repeat: debt.repeat ? normalizeRepeat(debt.repeat, 'monthly') : 'monthly',
    },
    today,
    frequency,
  )
  let ideal = Math.min(plan.ideal, debt.remaining)
  let urgent = Boolean(plan.urgent && ideal > 0)
  if (ideal <= 0 && debt.repeat) {
    const paid = Math.min(debt.minimumPaid || 0, minimum)
    ideal = Math.min(Math.max(0, minimum - paid), debt.remaining)
    urgent = false
  }
  return { ideal, urgent }
}

export function suggestionLines(budget, result, today) {
  const lines = []
  for (const expense of budget.expenses) {
    const suggested = result.amounts[expense.id] || 0
    if (!suggested) continue
    const minimum = Math.min(expense.minimum || 0, expense.amount || 0)
    const minimumLeft = Math.max(0, minimum - (expense.paid || 0))
    const remaining = Math.max(0, expense.amount - (expense.paid || 0))
    if (minimumLeft > 0 && suggested <= minimumLeft && remaining > suggested) {
      lines.push({ name: `${expense.name} minimum`, cents: suggested })
    } else {
      lines.push({ name: expense.name, cents: suggested })
    }
  }
  for (const debt of budget.debts) {
    const suggested = result.amounts[debt.id] || 0
    if (!suggested) continue
    const minPart = Math.min(suggested, minimumPlan(debt, today, budget.payFrequency).ideal)
    if (minPart > 0 && suggested > minPart) {
      lines.push({ name: `${debt.name} minimum`, cents: minPart })
      lines.push({ name: debt.name, cents: suggested - minPart })
    } else if (minPart > 0) {
      lines.push({ name: `${debt.name} minimum`, cents: suggested })
    } else {
      lines.push({ name: debt.name, cents: suggested })
    }
  }
  if (result.amounts.savings) lines.push({ name: 'Savings', cents: result.amounts.savings })
  if (result.amounts.investments) lines.push({ name: 'Investments', cents: result.amounts.investments })
  lines.push({ name: 'Everyday spending', cents: result.miscKept })
  return lines
}

export function buildSuggestions(budget, paycheckCents, today) {
  const amounts = {}
  if (paycheckCents <= 0) {
    return {
      amounts,
      miscKept: 0,
      uncoveredUrgent: 0,
      nextPayday: nextPayday(today, budget.payFrequency),
      assigned: 0,
      unassigned: 0,
    }
  }

  const plans = [
    ...budget.expenses.map((expense) => ({
      id: expense.id,
      plan: paymentPlan(expense, today, budget.payFrequency),
    })),
    ...budget.debts
      .filter((debt) => debt.remaining > 0 && (debt.minimum || 0) > 0)
      .map((debt) => ({
        id: debt.id,
        plan: minimumPlan(debt, today, budget.payFrequency),
      })),
  ]
  let room = paycheckCents
  let uncoveredUrgent = 0

  for (const item of plans) {
    if (!item.plan.urgent || item.plan.ideal <= 0) continue
    const give = Math.min(item.plan.ideal, room)
    if (give > 0) amounts[item.id] = (amounts[item.id] || 0) + give
    uncoveredUrgent += item.plan.ideal - give
    room -= give
  }

  const miscKept = Math.min(budget.miscBuffer, room)
  room -= miscKept

  for (const item of plans) {
    if (item.plan.urgent || item.plan.ideal <= 0) continue
    const give = Math.min(item.plan.ideal, room)
    if (give > 0) amounts[item.id] = (amounts[item.id] || 0) + give
    room -= give
  }

  const leftover = room
  const openDebts = budget.debts.filter((debt) => debt.remaining > 0)
  const saveRoom = (budget.savingsGoal || 0) > 0 ? Math.max(0, budget.savingsGoal - (budget.savingsTotal || 0)) : 0
  const investRoom = (budget.investmentGoal || 0) > 0 ? Math.max(0, budget.investmentGoal - (budget.investmentTotal || 0)) : 0
  const pots = []
  if (openDebts.length) pots.push('debt')
  if (saveRoom > 0) pots.push('save')
  if (investRoom > 0) pots.push('invest')
  const shares = shareLeftover(leftover, pots)
  let debtBudget = shares.debt || 0
  let saveGive = Math.min(shares.save || 0, saveRoom)
  let investGive = Math.min(shares.invest || 0, investRoom)
  let overflow = (shares.save || 0) - saveGive + ((shares.invest || 0) - investGive)
  if (overflow > 0 && saveRoom > saveGive) {
    const extra = Math.min(overflow, saveRoom - saveGive)
    saveGive += extra
    overflow -= extra
  }
  if (overflow > 0 && investRoom > investGive) {
    const extra = Math.min(overflow, investRoom - investGive)
    investGive += extra
    overflow -= extra
  }
  if (overflow > 0 && openDebts.length) debtBudget += overflow
  if (saveGive > 0) amounts.savings = saveGive
  if (investGive > 0) amounts.investments = investGive

  const debtRoom = openDebts.reduce((sum, debt) => sum + Math.max(0, debt.remaining - (amounts[debt.id] || 0)), 0)
  const debtGive = Math.min(debtBudget, debtRoom)
  const extra = splitProportional(
    debtGive,
    openDebts.map((debt) => ({ id: debt.id, weight: Math.max(0, debt.remaining - (amounts[debt.id] || 0)) })),
  )
  for (const [id, cents] of Object.entries(extra)) amounts[id] = (amounts[id] || 0) + cents

  const assigned = Object.values(amounts).reduce((sum, value) => sum + value, 0)
  return {
    amounts,
    miscKept,
    uncoveredUrgent,
    nextPayday: nextPayday(today, budget.payFrequency),
    assigned,
    unassigned: paycheckCents - assigned,
  }
}

export function splitProportional(total, items) {
  const result = {}
  let remaining = total
  let active = items.filter((item) => item.weight > 0).map((item) => ({ id: item.id, room: item.weight }))
  if (remaining <= 0 || active.length === 0) return result

  while (remaining > 0 && active.length > 0) {
    const weight = active.reduce((sum, item) => sum + item.room, 0)
    if (weight <= 0) break
    let consumed = 0
    let assigned = 0
    const next = []
    active.forEach((item, index) => {
      const isLast = index === active.length - 1
      let share = isLast ? remaining - consumed : Math.floor((remaining * item.room) / weight)
      share = Math.max(0, Math.min(share, item.room))
      if (share > 0) result[item.id] = (result[item.id] || 0) + share
      consumed += share
      assigned += share
      if (item.room - share > 0) next.push({ id: item.id, room: item.room - share })
    })
    if (assigned === 0) break
    remaining -= assigned
    active = next
  }
  return result
}

export function readAllocations(allocations) {
  const parsed = {}
  for (const [id, raw] of Object.entries(allocations || {})) {
    const cents = parseMoney(raw)
    if (cents == null) return { ok: false, allocations: {} }
    if (cents > 0) parsed[id] = cents
  }
  return { ok: true, allocations: parsed }
}

export function validateAllocations(budget, paycheckCents, allocations, today = new Date()) {
  const errors = []
  let sum = 0
  for (const [id, cents] of Object.entries(allocations)) {
    sum += cents
    if (id === 'savings' || id === 'investments') continue
    const debt = budget.debts.find((item) => item.id === id)
    if (debt && cents > debt.remaining) {
      errors.push(`${debt.name} only has ${formatMoney(debt.remaining)} left.`)
    }
    const expense = budget.expenses.find((item) => item.id === id)
    if (expense) {
      const current = Math.max(0, expense.amount - (expense.paid || 0))
      const left = Math.max(current, paymentPlan(expense, today, budget.payFrequency).ideal)
      if (cents > left) errors.push(`${expense.name} only has ${formatMoney(left)} left.`)
    }
  }
  if (sum > paycheckCents) errors.push('That’s more than this paycheck.')
  return errors
}

export function milestoneMessage(name, threshold) {
  if (threshold === 100) return `${name} is paid off.`
  if (threshold === 50) return `You've paid 50% of your ${name} debt. Way to go!`
  if (threshold === 75) return `You've paid 75% of your ${name} debt. Almost there.`
  if (threshold === 25) return `You've paid 25% of your ${name} debt. Keep going.`
  return `You've paid 10% of your ${name} debt. Nice start.`
}

function settleExpensePayment(expense, pay, today) {
  const repeat = normalizeRepeat(expense.repeat, 'monthly')
  let paid = (expense.paid || 0) + pay
  let dueDate = expense.dueDate
  let guard = 0
  while (expense.amount > 0 && paid >= expense.amount && guard < 16) {
    const advanced = advanceIfPaid(dueDate, today, true, repeat)
    if (!advanced) break
    paid -= expense.amount
    dueDate = advanced
    guard += 1
  }
  return { ...expense, paid, dueDate }
}

function settleDebtPayment(debt, pay, today) {
  const remaining = Math.max(0, debt.remaining - pay)
  const minimum = debt.minimum || 0
  const repeat = normalizeRepeat(debt.repeat, '')
  let minimumPaid = (debt.minimumPaid || 0) + pay
  let dueDate = debt.dueDate || null
  let guard = 0
  if (minimum > 0 && repeat) {
    while (dueDate && minimumPaid >= minimum && remaining > 0 && guard < 16) {
      const advanced = advanceIfPaid(dueDate, today, true, repeat)
      if (!advanced) break
      minimumPaid -= minimum
      dueDate = advanced
      guard += 1
    }
  }
  if (guard === 0) minimumPaid = Math.min(Math.max(0, minimumPaid), minimum)
  return { remaining, minimumPaid: Math.max(0, minimumPaid), dueDate }
}

function shareLeftover(total, pots) {
  const shares = {}
  if (!pots.length || total <= 0) return shares
  const base = Math.floor(total / pots.length)
  const remainder = total - base * pots.length
  pots.forEach((name, index) => {
    const extra = index >= pots.length - remainder ? 1 : 0
    shares[name] = base + extra
  })
  return shares
}

function trackedKeys(kind) {
  if (kind === 'savings') {
    return {
      total: 'savingsTotal',
      history: 'savingsHistory',
      goal: 'savingsGoal',
      message: "You've reached your savings goal. Way to go!",
    }
  }
  return {
    total: 'investmentTotal',
    history: 'investmentHistory',
    goal: 'investmentGoal',
    message: "You've reached your investment goal. Way to go!",
  }
}

function appendHistory(history, total, today) {
  const date = localDateISO(today)
  const point = { date, total }
  const list = Array.isArray(history) ? history : []
  const last = list[list.length - 1]
  if (last?.date === date) return list.slice(0, -1).concat(point)
  return list.concat(point)
}

function goalCelebration(budget, kind, previous, total) {
  const keys = trackedKeys(kind)
  const goal = budget[keys.goal] || 0
  if (goal <= 0 || previous >= goal || total < goal) return null
  return {
    id: uid(),
    threshold: 'goal',
    message: keys.message,
    confetti: true,
  }
}

function applyTrackedDeposit(budget, kind, pay, today, celebrations) {
  const keys = trackedKeys(kind)
  const previous = budget[keys.total] || 0
  if (!pay) return { total: previous, history: budget[keys.history] || [] }
  const total = previous + pay
  const celebration = goalCelebration(budget, kind, previous, total)
  if (celebration) celebrations.push(celebration)
  return { total, history: appendHistory(budget[keys.history], total, today) }
}

export function setTrackedBalance(budget, kind, cents, today) {
  const keys = trackedKeys(kind)
  const previous = budget[keys.total] || 0
  const celebrations = []
  const celebration = goalCelebration(budget, kind, previous, cents)
  if (celebration) celebrations.push(celebration)
  return {
    budget: {
      ...budget,
      [keys.total]: cents,
      [keys.history]: appendHistory(budget[keys.history], cents, today),
    },
    celebrations,
  }
}

export function commitPaycheck(budget, allocations, today, paycheckCents) {
  const celebrations = []
  const debts = budget.debts.map((debt) => {
    const pay = Math.min(allocations[debt.id] || 0, debt.remaining)
    if (!pay) return debt
    const before = percentPaid(debt)
    const settled = settleDebtPayment(debt, pay, today)
    const next = { ...debt, ...settled }
    const after = percentPaid(next)
    const marks = MILESTONES.filter((mark) => before < mark && after >= mark && !debt.celebrated.includes(mark))
    if (!marks.length) return next
    next.celebrated = [...debt.celebrated, ...marks]
    const highest = marks[marks.length - 1]
    celebrations.push({
      id: uid(),
      debtId: debt.id,
      threshold: highest,
      message: milestoneMessage(debt.name, highest),
      confetti: highest === 100,
    })
    return next
  })

  const expenses = budget.expenses.map((expense) => {
    const current = Math.max(0, expense.amount - (expense.paid || 0))
    const room = Math.max(current, paymentPlan(expense, today, budget.payFrequency).ideal)
    const pay = Math.min(allocations[expense.id] || 0, room)
    if (!pay) return expense
    return settleExpensePayment(expense, pay, today)
  })

  const savings = applyTrackedDeposit(budget, 'savings', allocations.savings || 0, today, celebrations)
  const investments = applyTrackedDeposit(budget, 'investments', allocations.investments || 0, today, celebrations)

  const assigned = Object.values(allocations).reduce((sum, value) => sum + value, 0)
  const recordedPay = typeof paycheckCents === 'number'
  return {
    budget: {
      ...budget,
      debts,
      expenses,
      savingsTotal: savings.total,
      savingsHistory: savings.history,
      investmentTotal: investments.total,
      investmentHistory: investments.history,
      lastPayAmount: recordedPay ? paycheckCents : (budget.lastPayAmount ?? null),
      lastFundsRemaining: recordedPay ? paycheckCents - assigned : (budget.lastFundsRemaining ?? null),
      fundsAdjusted: recordedPay ? false : Boolean(budget.fundsAdjusted),
      draft: null,
    },
    celebrations,
  }
}

export const CREDIT_MIN = 300
export const CREDIT_MAX = 900

export function creditStanding(score) {
  if (score >= 800) return { label: '800+ reached. Strong work.' }
  if (score >= 750) return { label: '750 reached. 800 is next.' }
  if (score >= 700) return { label: '700 reached. 750 is next.' }
  const points = 700 - score
  return { label: points === 1 ? '1 point to 700.' : `${points} points to 700.` }
}

export function parseCreditScore(raw) {
  const text = String(raw ?? '').trim()
  if (!/^\d{3}$/.test(text)) return null
  const score = Number(text)
  if (score < CREDIT_MIN || score > CREDIT_MAX) return null
  return score
}

export function nextCreditCheck(checkedOn) {
  if (!isISODate(checkedOn)) return null
  return addDays(parseISODate(checkedOn), 31)
}

export function creditCheckDue(checkedOn, today) {
  const next = nextCreditCheck(checkedOn)
  if (!next) return false
  return startOfDay(today) >= startOfDay(next)
}

export function applyCreditScore(budget, score, today) {
  return {
    ...budget,
    creditPrevious: budget.creditScore == null ? null : budget.creditScore,
    creditScore: score,
    creditCheckedOn: localDateISO(today),
  }
}

export function dueLabel(expense, today) {
  const remaining = expense.amount - (expense.paid || 0)
  const due = isISODate(expense.dueDate) ? parseISODate(expense.dueDate) : null
  const cadence = repeatLabel(expense.repeat)
  const suffix = cadence ? ` · ${cadence}` : ''
  if (remaining <= 0) return (due ? `Paid · due ${formatShortDate(due)}` : 'Paid') + suffix
  if (!due) return `No due date${suffix}`
  const today0 = startOfDay(today)
  const due0 = startOfDay(due)
  if (today0.getTime() === due0.getTime()) return `Due today${suffix}`
  if (today0 > due0) return `Past due · ${formatShortDate(due0)}${suffix}`
  return `Due ${formatShortDate(due0)}${suffix}`
}

export function minimumLabel(debt) {
  const minimum = debt.minimum || 0
  if (minimum <= 0) return ''
  const cadence = repeatLabel(debt.repeat)
  return cadence ? `Minimum ${formatMoney(minimum)} ${cadence.toLowerCase()}` : `Minimum ${formatMoney(minimum)}`
}

export function suggestionNote(result, budget) {
  const when = result.nextPayday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (result.uncoveredUrgent > 0) {
    return `Payments due before ${when} are ${formatMoney(result.uncoveredUrgent)} more than this paycheck. The suggestion puts the whole check toward those.`
  }
  if (result.miscKept < budget.miscBuffer) {
    return `Next paycheck is about ${when}. Everyday spending drops to ${formatMoney(result.miscKept)} so bills can be covered.`
  }
  return `Next paycheck is about ${when}. This split leaves ${formatMoney(result.miscKept)} for everyday spending.`
}
