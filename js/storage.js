import { isISODate, localDateISO, monthKey, resolveDueDate } from './format.js'
import { CREDIT_MAX, CREDIT_MIN, normalizeRepeat } from './budget.js'

const KEY = 'budget-app-v1'

export function loadBudget() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return parseBudget(JSON.parse(raw))
  } catch {
    return null
  }
}

export function parseBudget(data) {
  if (!data || (data.payFrequency !== 'biweekly' && data.payFrequency !== 'monthly')) return null
  return {
      payFrequency: data.payFrequency,
      typicalPay: Number(data.typicalPay) || 0,
      miscBuffer: Number(data.miscBuffer) || 0,
      debts: Array.isArray(data.debts) ? data.debts.map((debt) => normalizeDebt(debt)) : [],
      expenses: Array.isArray(data.expenses)
        ? data.expenses.map((expense) => normalizeExpense(expense, new Date()))
        : [],
      expenseMonth: data.expenseMonth || monthKey(new Date()),
      savingsGoal: Number(data.savingsGoal) || 0,
      savingsTotal: Number(data.savingsTotal) || 0,
      savingsHistory: Array.isArray(data.savingsHistory) ? data.savingsHistory : [],
      investmentGoal: Number(data.investmentGoal) || 0,
      investmentTotal: Number(data.investmentTotal) || 0,
      investmentHistory: Array.isArray(data.investmentHistory) ? data.investmentHistory : [],
      lastPayAmount: numberOrNull(data.lastPayAmount),
      lastFundsRemaining: numberOrNull(data.lastFundsRemaining),
      fundsAdjusted: Boolean(data.fundsAdjusted),
      creditScore: scoreOrNull(data.creditScore),
      creditPrevious: scoreOrNull(data.creditPrevious),
      creditCheckedOn: isISODate(data.creditCheckedOn) ? data.creditCheckedOn : null,
      draft: data.draft && typeof data.draft === 'object' ? data.draft : null,
    }
}

export function budgetFile(budget, today) {
  return JSON.stringify({
    app: 'Simple Budget',
    version: 1,
    exportedAt: localDateISO(today),
    budget,
  }, null, 2)
}

export function budgetFromFile(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not a Simple Budget backup.' }
  }
  const payload = data && data.app === 'Simple Budget' && data.budget && typeof data.budget === 'object'
    ? data.budget
    : data
  const budget = parseBudget(payload)
  if (!budget) return { ok: false, error: 'That file is not a Simple Budget backup.' }
  return { ok: true, budget }
}

function normalizeExpense(expense, today) {
  return {
    id: expense.id,
    name: expense.name || '',
    amount: Number(expense.amount) || 0,
    dueDate: resolveDueDate(expense, today),
    paid: Number(expense.paid) || 0,
    repeat: normalizeRepeat(expense.repeat, 'monthly'),
    minimum: Math.min(Number(expense.amount) || 0, Math.max(0, Number(expense.minimum) || 0)),
    preset: Boolean(expense.preset),
  }
}

function debtKind(debt) {
  if (debt.kind === 'card' || debt.kind === 'loan') return debt.kind
  if (/credit\s*card/i.test(debt.name || '')) return 'card'
  return 'loan'
}

function normalizeDebt(debt) {
  const minimum = Math.max(0, Number(debt.minimum) || 0)
  return {
    id: debt.id,
    name: debt.name || '',
    kind: debtKind(debt),
    original: Number(debt.original) || 0,
    remaining: Number(debt.remaining) || 0,
    celebrated: Array.isArray(debt.celebrated) ? debt.celebrated : [],
    minimum,
    repeat: minimum > 0 ? normalizeRepeat(debt.repeat, '') : '',
    dueDate: isISODate(debt.dueDate) ? debt.dueDate : null,
    minimumPaid: Math.min(minimum, Math.max(0, Number(debt.minimumPaid) || 0)),
  }
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function scoreOrNull(value) {
  const score = Number(value)
  if (!Number.isInteger(score) || score < CREDIT_MIN || score > CREDIT_MAX) return null
  return score
}

export function saveBudget(budget) {
  localStorage.setItem(KEY, JSON.stringify(budget))
}

export function clearBudget() {
  localStorage.removeItem(KEY)
}
