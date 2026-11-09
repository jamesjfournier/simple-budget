import {
  applyForm,
  blankForm,
  buildSuggestions,
  applyCreditScore,
  commitPaycheck,
  formFromBudget,
  parseCreditScore,
  parseDueDate,
  readAllocations,
  rollover,
  setTrackedBalance,
  validateAllocations,
} from './budget.js'
import { centsToInput, isPartialMoney, localDateISO, parseMoney, uid } from './format.js'
import { renderApp } from './render.js'
import { budgetFile, budgetFromFile, clearBudget, loadBudget, saveBudget } from './storage.js'

const app = document.querySelector('#app')

const state = {
  screen: 'onboarding',
  step: 0,
  form: blankForm(),
  wantsSavings: null,
  wantsInvestments: null,
  error: '',
  budget: null,
  toasts: [],
  dissolvingIds: [],
  showConfetti: false,
  focusId: null,
  editingFunds: false,
  fundsDraft: '',
  fundsError: '',
  editingCredit: false,
  creditDraft: '',
  creditError: '',
  editingBalance: null,
  balanceDraft: '',
  balanceError: '',
}

app.addEventListener('click', onClick)
app.addEventListener('input', onInput)
app.addEventListener('change', onChange)
app.addEventListener('keydown', onKeydown)
boot()

function resetBudget() {
  if (!confirm('Reset this budget and start over?')) return
  clearBudget()
  state.budget = null
  state.form = blankForm()
  state.step = 0
  state.wantsSavings = null
  state.wantsInvestments = null
  state.screen = 'onboarding'
  state.error = ''
  state.toasts = []
  state.dissolvingIds = []
  state.showConfetti = false
  state.editingFunds = false
  state.editingCredit = false
  state.fundsDraft = ''
  state.fundsError = ''
  state.creditDraft = ''
  state.creditError = ''
  state.editingBalance = null
  state.balanceDraft = ''
  state.balanceError = ''
  window.scrollTo(0, 0)
  render()
}

window.simpleBudgetReset = resetBudget

function clearEditing() {
  state.error = ''
  state.toasts = []
  state.dissolvingIds = []
  state.showConfetti = false
  state.editingFunds = false
  state.editingCredit = false
  state.fundsDraft = ''
  state.fundsError = ''
  state.creditDraft = ''
  state.creditError = ''
  state.editingBalance = null
  state.balanceDraft = ''
  state.balanceError = ''
}

function exportBudgetText() {
  if (!state.budget) return null
  return budgetFile(state.budget, new Date())
}

function importBudgetText(text) {
  const result = budgetFromFile(text)
  if (!result.ok) return result.error
  if (state.budget && !confirm('Replace the budget you have now with this backup?')) return ''
  const next = rollover(result.budget, new Date())
  state.budget = next
  saveBudget(next)
  state.screen = 'dashboard'
  state.form = blankForm()
  state.step = 0
  state.wantsSavings = null
  state.wantsInvestments = null
  clearEditing()
  window.scrollTo(0, 0)
  render()
  return ''
}

window.simpleBudgetExport = exportBudgetText
window.simpleBudgetImport = importBudgetText

let budgetPicker = null

function backupBudgetFile() {
  const text = exportBudgetText()
  if (!text) {
    alert('There is no budget to back up yet.')
    return
  }
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Simple Budget ${localDateISO(new Date())}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function importBudgetFile() {
  budgetPicker = document.createElement('input')
  budgetPicker.type = 'file'
  budgetPicker.accept = '.json,application/json'
  budgetPicker.addEventListener('change', () => {
    const file = budgetPicker.files && budgetPicker.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const error = importBudgetText(String(reader.result || ''))
      if (error) alert(error)
    })
    reader.readAsText(file)
  })
  budgetPicker.click()
}

function boot() {
  const loaded = loadBudget()
  if (loaded) {
    const next = rollover(loaded, new Date())
    state.budget = next
    if (next !== loaded) saveBudget(next)
    state.screen = 'dashboard'
  }
  render()
}

function render() {
  if (state.budget) {
    const next = rollover(state.budget, new Date())
    if (next !== state.budget) {
      state.budget = next
      saveBudget(next)
    }
  }
  const active = document.activeElement
  const id = active?.id
  const start = active && 'selectionStart' in active ? active.selectionStart : null
  const end = active && 'selectionEnd' in active ? active.selectionEnd : null
  app.innerHTML = renderApp(state)
  if (state.focusId) {
    document.getElementById(state.focusId)?.focus()
    state.focusId = null
    return
  }
  if (!id) return
  const el = document.getElementById(id)
  if (!el) return
  el.focus()
  if (start != null && el.setSelectionRange) {
    try {
      el.setSelectionRange(start, end)
    } catch {
      /* Some inputs don't support a selection range. */
    }
  }
}

function onClick(event) {
  const button = event.target.closest('[data-action]')
  if (!button) return
  const action = button.dataset.action
  const id = button.dataset.id

  if (action === 'frequency') {
    state.form = { ...state.form, payFrequency: button.dataset.value }
    state.error = ''
    render()
    return
  }
  if (action === 'back') {
    state.step = Math.max(0, state.step - 1)
    state.error = ''
    window.scrollTo(0, 0)
    render()
    return
  }
  if (action === 'next') {
    advance()
    return
  }
  if (action === 'savings-choice') {
    state.wantsSavings = button.dataset.value === 'yes'
    if (!state.wantsSavings) state.form = { ...state.form, savingsGoal: '' }
    state.error = ''
    state.focusId = state.wantsSavings ? 'savings-goal' : null
    render()
    return
  }
  if (action === 'investments-choice') {
    state.wantsInvestments = button.dataset.value === 'yes'
    if (!state.wantsInvestments) state.form = { ...state.form, investmentGoal: '' }
    state.error = ''
    state.focusId = state.wantsInvestments ? 'investment-goal' : null
    render()
    return
  }
  if (action === 'add-debt') {
    const debtId = uid()
    state.form = { ...state.form, debts: [...state.form.debts, { id: debtId, name: '', amount: '', minimum: '', repeat: '', dueDate: '' }] }
    state.focusId = `debt-name-${debtId}`
    render()
    return
  }
  if (action === 'remove-debt') {
    state.form = { ...state.form, debts: state.form.debts.filter((debt) => debt.id !== id) }
    render()
    return
  }
  if (action === 'add-expense') {
    const expenseId = uid()
    state.form = {
      ...state.form,
      expenses: [...state.form.expenses, { id: expenseId, name: '', amount: '', dueDate: '', repeat: 'monthly', minimum: '', preset: false }],
    }
    state.focusId = `expense-name-${expenseId}`
    render()
    return
  }
  if (action === 'remove-expense') {
    state.form = { ...state.form, expenses: state.form.expenses.filter((expense) => expense.id !== id) }
    render()
    return
  }
  if (action === 'edit') {
    state.form = formFromBudget(state.budget)
    state.screen = 'edit'
    state.error = ''
    window.scrollTo(0, 0)
    render()
    return
  }
  if (action === 'cancel-edit') {
    state.screen = 'dashboard'
    state.error = ''
    render()
    return
  }
  if (action === 'save-edit') {
    saveEdit()
    return
  }
  if (action === 'reset') {
    resetBudget()
    return
  }
  if (action === 'backup-budget') {
    backupBudgetFile()
    return
  }
  if (action === 'import-budget') {
    importBudgetFile()
    return
  }
  if (action === 'start-pay') {
    state.budget = { ...state.budget, draft: { amount: '', allocations: {} } }
    saveBudget(state.budget)
    state.error = ''
    state.focusId = 'pay-amount'
    render()
    return
  }
  if (action === 'cancel-pay') {
    const draft = state.budget.draft
    const dirty = draft && (draft.amount || Object.values(draft.allocations || {}).some(Boolean))
    if (dirty && !confirm('Discard this paycheck?')) return
    state.budget = { ...state.budget, draft: null }
    saveBudget(state.budget)
    state.error = ''
    render()
    return
  }
  if (action === 'use-suggested') {
    applySuggestions()
    return
  }
  if (action === 'record') {
    recordPaycheck()
    return
  }
  if (action === 'edit-funds') {
    state.editingFunds = true
    state.fundsDraft = centsToInput(state.budget.lastFundsRemaining || 0)
    state.fundsError = ''
    state.focusId = 'funds-remaining'
    render()
    return
  }
  if (action === 'cancel-funds') {
    state.editingFunds = false
    state.fundsError = ''
    render()
    return
  }
  if (action === 'save-funds') {
    saveFunds()
    return
  }
  if (action === 'edit-credit') {
    state.editingCredit = true
    state.creditDraft = state.budget.creditScore == null ? '' : String(state.budget.creditScore)
    state.creditError = ''
    state.focusId = 'credit-score'
    render()
    return
  }
  if (action === 'cancel-credit') {
    state.editingCredit = false
    state.creditError = ''
    state.creditDraft = ''
    render()
    return
  }
  if (action === 'save-credit') {
    saveCredit()
    return
  }
  if (action === 'edit-balance') {
    const kind = button.dataset.id === 'investments' ? 'investments' : 'savings'
    const total = kind === 'savings' ? state.budget.savingsTotal : state.budget.investmentTotal
    state.editingBalance = kind
    state.balanceDraft = centsToInput(total || 0)
    state.balanceError = ''
    state.focusId = `balance-${kind}`
    render()
    return
  }
  if (action === 'cancel-balance') {
    state.editingBalance = null
    state.balanceDraft = ''
    state.balanceError = ''
    render()
    return
  }
  if (action === 'save-balance') {
    saveBalance()
    return
  }
  if (action === 'dismiss-toast') {
    state.toasts = state.toasts.filter((toast) => toast.id !== id)
    render()
  }
}

function onKeydown(event) {
  if (event.key !== 'Enter') return
  const bind = event.target?.dataset?.bind
  if (bind === 'funds-remaining') {
    event.preventDefault()
    saveFunds()
  }
  if (bind === 'credit-score') {
    event.preventDefault()
    saveCredit()
  }
  if (bind === 'balance') {
    event.preventDefault()
    saveBalance()
  }
}

function saveFunds() {
  const cents = parseMoney(state.fundsDraft.trim() === '' ? '0' : state.fundsDraft)
  if (cents == null) {
    state.fundsError = 'Enter the amount you have left.'
    render()
    return
  }
  state.budget = { ...state.budget, lastFundsRemaining: cents, fundsAdjusted: true }
  saveBudget(state.budget)
  state.editingFunds = false
  state.fundsError = ''
  render()
}

function saveBalance() {
  const kind = state.editingBalance
  if (kind !== 'savings' && kind !== 'investments') return
  const cents = parseMoney(state.balanceDraft.trim() === '' ? '0' : state.balanceDraft)
  if (cents == null) {
    state.balanceError = kind === 'savings' ? 'Enter the amount you have saved.' : 'Enter the amount you have invested.'
    render()
    return
  }
  const result = setTrackedBalance(state.budget, kind, cents, new Date())
  state.budget = result.budget
  saveBudget(result.budget)
  state.editingBalance = null
  state.balanceDraft = ''
  state.balanceError = ''
  showCelebrations(result.celebrations)
}

function saveCredit() {
  const score = parseCreditScore(state.creditDraft)
  if (score == null) {
    state.creditError = 'Enter a score from 300 to 900.'
    render()
    return
  }
  state.budget = applyCreditScore(state.budget, score, new Date())
  saveBudget(state.budget)
  state.editingCredit = false
  state.creditDraft = ''
  state.creditError = ''
  render()
}

function onChange(event) {
  const el = event.target
  if (el instanceof HTMLSelectElement) {
    const id = el.dataset.id
    if (el.dataset.bind === 'expense-repeat') patchExpense(id, { repeat: el.value })
    if (el.dataset.bind === 'debt-repeat') patchDebt(id, { repeat: el.value })
    return
  }
  if (!(el instanceof HTMLInputElement)) return
  const value = el.value
  if (value !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return
  if (el.dataset.bind === 'expense-due') {
    patchExpense(el.dataset.id, { dueDate: value })
    return
  }
  if (el.dataset.bind === 'debt-due') {
    patchDebt(el.dataset.id, { dueDate: value })
    return
  }
  if (el.dataset.bind === 'bill-due') setBillDue(el.dataset.id, value)
}

function setBillDue(id, value) {
  const dueDate = value || null
  state.budget = {
    ...state.budget,
    expenses: state.budget.expenses.map((expense) => {
      if (expense.id !== id) return expense
      const nextCycle = dueDate && expense.dueDate && dueDate > expense.dueDate && expense.paid >= expense.amount
      return { ...expense, dueDate, paid: nextCycle ? 0 : expense.paid }
    }),
  }
  saveBudget(state.budget)
  render()
}

function onInput(event) {
  const el = event.target
  if (!(el instanceof HTMLInputElement)) return
  const bind = el.dataset.bind
  if (!bind) return
  const value = el.value
  const id = el.dataset.id

  if (bind === 'funds-remaining') {
    if (!isPartialMoney(value)) {
      render()
      return
    }
    state.fundsDraft = value
    state.fundsError = ''
    render()
    return
  }
  if (bind === 'credit-score') {
    if (!/^\d{0,3}$/.test(value)) {
      render()
      return
    }
    state.creditDraft = value
    state.creditError = ''
    render()
    return
  }
  if (bind === 'bill-due') return
  if (bind === 'expense-due' || bind === 'debt-due') {
    if (value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const key = bind === 'expense-due' ? 'expenses' : 'debts'
      state.form = {
        ...state.form,
        [key]: state.form[key].map((row) => (row.id === id ? { ...row, dueDate: value } : row)),
      }
      state.error = ''
    }
    return
  }
  if (bind === 'debt-name') {
    patchDebt(id, { name: value })
    return
  }
  if (bind === 'expense-name') {
    patchExpense(id, { name: value })
    return
  }
  if (!isPartialMoney(value)) {
    render()
    return
  }
  if (bind === 'balance') {
    if (!isPartialMoney(value)) {
      render()
      return
    }
    state.balanceDraft = value
    state.balanceError = ''
    render()
    return
  }
  if (bind === 'typicalPay' || bind === 'miscBuffer' || bind === 'savingsGoal' || bind === 'investmentGoal') {
    state.form = { ...state.form, [bind]: value }
    state.error = ''
    render()
    return
  }
  if (bind === 'debt-amount') {
    patchDebt(id, { amount: value })
    return
  }
  if (bind === 'debt-minimum') {
    patchDebt(id, { minimum: value })
    return
  }
  if (bind === 'expense-amount') {
    patchExpense(id, { amount: value })
    return
  }
  if (bind === 'expense-minimum') {
    patchExpense(id, { minimum: value })
    return
  }
  if (bind === 'paycheck') {
    updateDraft((draft) => ({ ...draft, amount: value }))
    return
  }
  if (bind === 'alloc') {
    updateDraft((draft) => ({
      ...draft,
      allocations: { ...draft.allocations, [id]: value },
    }))
  }
}

function patchDebt(id, patch) {
  state.form = {
    ...state.form,
    debts: state.form.debts.map((debt) => (debt.id === id ? { ...debt, ...patch } : debt)),
  }
  state.error = ''
  render()
}

function patchExpense(id, patch) {
  state.form = {
    ...state.form,
    expenses: state.form.expenses.map((expense) => (expense.id === id ? { ...expense, ...patch } : expense)),
  }
  state.error = ''
  render()
}

function updateDraft(recipe) {
  state.budget = { ...state.budget, draft: recipe(state.budget.draft) }
  state.error = ''
  saveBudget(state.budget)
  render()
}

function advance() {
  const error = validateStep()
  if (error) {
    state.error = error
    render()
    return
  }
  if (state.step < 6) {
    state.step += 1
    state.error = ''
    state.focusId = focusForStep(state.step)
    window.scrollTo(0, 0)
    render()
    return
  }
  const result = applyForm(
    {
      ...state.form,
      savingsGoal: state.wantsSavings ? state.form.savingsGoal : '',
      investmentGoal: state.wantsInvestments ? state.form.investmentGoal : '',
    },
    null,
    new Date(),
  )
  if (!result.ok) {
    state.error = result.error
    render()
    return
  }
  state.budget = result.budget
  saveBudget(result.budget)
  state.screen = 'dashboard'
  state.error = ''
  window.scrollTo(0, 0)
  render()
}

function validateStep() {
  const form = state.form
  if (state.step === 0 && form.payFrequency !== 'biweekly' && form.payFrequency !== 'monthly') {
    return 'Choose how often you get paid.'
  }
  if (state.step === 1) {
    const typical = parseMoney(form.typicalPay)
    if (typical == null || typical <= 0) return 'Enter about how much you get each paycheck.'
  }
  if (state.step === 2) {
    for (const row of form.debts) {
      const name = row.name.trim()
      const amountRaw = row.amount.trim()
      if (!name && !amountRaw) continue
      if (!name) return 'Name each debt.'
      const amount = parseMoney(amountRaw)
      if (amount == null || amount <= 0) return `Enter how much you still owe on ${name}.`
      const minimumRaw = String(row.minimum ?? '').trim()
      if (minimumRaw) {
        const minimum = parseMoney(minimumRaw)
        if (minimum == null || minimum < 0) return `Enter a minimum payment for ${name}, or leave it blank.`
        if (minimum > amount) return `The minimum for ${name} is more than what's left.`
      }
    }
  }
  if (state.step === 3) {
    for (const row of form.expenses) {
      const name = row.name.trim()
      const amountRaw = row.amount.trim()
      const dueRaw = String(row.dueDate ?? '').trim()
      if (!name && !amountRaw && !dueRaw) continue
      if (!amountRaw && dueRaw) return `Enter a cost for ${name || 'that expense'}, or clear the due date.`
      if (!amountRaw) continue
      if (!name) return 'Name each expense.'
      const amount = parseMoney(amountRaw)
      if (amount == null || amount <= 0) return `Enter a cost for ${name}.`
      if (!parseDueDate(dueRaw).ok) return `Pick a due date for ${name}, or leave it blank.`
      const minimumRaw = String(row.minimum ?? '').trim()
      if (minimumRaw) {
        const minimum = parseMoney(minimumRaw)
        if (minimum == null || minimum < 0) return `Enter a minimum payment for ${name}, or leave it blank.`
        if (minimum > amount) return `The minimum for ${name} is more than the cost.`
      }
    }
  }
  if (state.step === 4) {
    const misc = parseMoney(form.miscBuffer.trim() === '' ? '0' : form.miscBuffer)
    if (misc == null) return 'Enter an everyday spending amount, or 0.'
  }
  if (state.step === 5) {
    if (state.wantsSavings == null) return 'Let me know if you have a savings goal.'
    if (state.wantsSavings) {
      const goal = parseMoney(form.savingsGoal)
      if (goal == null || goal <= 0) return 'Enter the amount you want to save.'
    }
  }
  if (state.step === 6) {
    if (state.wantsInvestments == null) return 'Let me know if you have an investment goal.'
    if (state.wantsInvestments) {
      const goal = parseMoney(form.investmentGoal)
      if (goal == null || goal <= 0) return 'Enter the amount you want to invest.'
    }
  }
  return ''
}

function focusForStep(step) {
  if (step === 1) return 'typical-pay'
  if (step === 2) return state.form.debts[0] ? `debt-name-${state.form.debts[0].id}` : null
  if (step === 3) return state.form.expenses[0] ? `expense-amount-${state.form.expenses[0].id}` : null
  if (step === 4) return 'misc-buffer'
  return null
}

function saveEdit() {
  const result = applyForm(state.form, state.budget, new Date())
  if (!result.ok) {
    state.error = result.error
    render()
    return
  }
  state.budget = result.budget
  saveBudget(result.budget)
  state.screen = 'dashboard'
  state.error = ''
  window.scrollTo(0, 0)
  render()
}

function applySuggestions() {
  const paycheck = parseMoney(state.budget.draft.amount)
  if (paycheck == null || paycheck <= 0) {
    state.error = 'Enter how much you got paid first.'
    render()
    return
  }
  const result = buildSuggestions(state.budget, paycheck, new Date())
  const allocations = {}
  for (const [id, cents] of Object.entries(result.amounts)) {
    if (cents > 0) allocations[id] = centsToInput(cents)
  }
  state.budget = { ...state.budget, draft: { ...state.budget.draft, allocations } }
  state.error = ''
  saveBudget(state.budget)
  render()
}

function showCelebrations(celebrations) {
  state.dissolvingIds = celebrations.filter((item) => item.confetti && item.debtId).map((item) => item.debtId)
  state.showConfetti = celebrations.some((item) => item.confetti)
  state.toasts = [...celebrations, ...state.toasts].slice(0, 3)
  render()
  if (state.showConfetti) {
    window.setTimeout(() => {
      state.showConfetti = false
      render()
    }, 2600)
  }
  if (state.dissolvingIds.length) {
    const ids = [...state.dissolvingIds]
    window.setTimeout(() => {
      state.dissolvingIds = state.dissolvingIds.filter((debtId) => !ids.includes(debtId))
      render()
    }, 1200)
  }
  for (const toast of celebrations) {
    window.setTimeout(() => {
      state.toasts = state.toasts.filter((item) => item.id !== toast.id)
      render()
    }, 7000)
  }
}

function recordPaycheck() {
  const draft = state.budget.draft
  const paycheck = parseMoney(draft.amount)
  const read = readAllocations(draft.allocations)
  if (paycheck == null || !read.ok) {
    state.error = 'Use numbers only, like 2400 or 24.50.'
    render()
    return
  }
  if (paycheck <= 0) {
    state.error = 'Enter how much you got paid.'
    render()
    return
  }
  const errors = validateAllocations(state.budget, paycheck, read.allocations)
  if (errors.length) {
    state.error = errors[0]
    render()
    return
  }
  if (!Object.keys(read.allocations).length) {
    state.error = 'Enter an amount for at least one bill, debt, savings, or investment.'
    render()
    return
  }
  const result = commitPaycheck(state.budget, read.allocations, new Date(), paycheck)
  state.budget = result.budget
  saveBudget(result.budget)
  state.error = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
  showCelebrations(result.celebrations)
}
