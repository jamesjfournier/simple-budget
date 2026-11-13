import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyCreditScore,
  addInterest,
  applyForm,
  billPlan,
  buildSuggestions,
  commitPaycheck,
  creditCheckDue,
  creditStanding,
  dueLabel,
  nextCreditCheck,
  parseCreditScore,
  rollover,
  setTrackedBalance,
  splitProportional,
  suggestionLines,
  validateAllocations,
} from '../js/budget.js'
import { localDateISO, parseMoney, resolveDueDate, savingsTicks } from '../js/format.js'
import { budgetFile, budgetFromFile } from '../js/storage.js'

const oct10 = new Date(2026, 9, 10)
const oct24 = new Date(2026, 9, 24)
const oct30 = new Date(2026, 9, 30)

function budget(overrides = {}) {
  return {
    payFrequency: 'monthly',
    typicalPay: 300000,
    miscBuffer: 40000,
    debts: [{ id: 'visa', name: 'Visa', original: 500000, remaining: 500000, celebrated: [] }],
    expenses: [{ id: 'rent', name: 'Rent / Mortgage', amount: 150000, dueDate: '2026-11-01', paid: 0, preset: true }],
    expenseMonth: '2026-10',
    savingsGoal: 200000,
    savingsTotal: 0,
    savingsHistory: [],
    draft: null,
    ...overrides,
  }
}

test('parse money accepts dollars and cents', () => {
  assert.equal(parseMoney('2000'), 200000)
  assert.equal(parseMoney('12.5'), 1250)
  assert.equal(parseMoney('12.50'), 1250)
  assert.equal(parseMoney(''), 0)
  assert.equal(parseMoney('12.345'), null)
})

test('monthly suggestion covers bills, holds everyday money, and splits the rest', () => {
  const result = buildSuggestions(budget(), 300000, oct30)
  assert.equal(result.amounts.rent, 150000)
  assert.equal(result.amounts.visa, 55000)
  assert.equal(result.amounts.savings, 55000)
  assert.equal(result.miscKept, 40000)
  assert.equal(result.unassigned, 40000)
  assert.equal(result.assigned + result.miscKept, 300000)
})

test('biweekly bill due after the next paycheck is only half set aside', () => {
  const expense = { id: 'net', name: 'Internet', amount: 10000, dueDate: '2026-10-28', paid: 0 }
  const plan = billPlan(expense, oct10, 'biweekly')
  assert.equal(plan.urgent, false)
  assert.equal(plan.ideal, 5000)
})

test('biweekly bill due before the next paycheck is covered in full', () => {
  const expense = { id: 'net', name: 'Internet', amount: 10000, dueDate: '2026-10-28', paid: 0 }
  const plan = billPlan(expense, oct24, 'biweekly')
  assert.equal(plan.urgent, true)
  assert.equal(plan.ideal, 10000)
})

test('half already set aside means nothing more is suggested yet', () => {
  const expense = { id: 'net', name: 'Internet', amount: 10000, dueDate: '2026-10-28', paid: 5000 }
  const plan = billPlan(expense, oct10, 'biweekly')
  assert.equal(plan.ideal, 0)
})

test('overdue bills are suggested in full', () => {
  const expense = { id: 'rent', name: 'Rent / Mortgage', amount: 100000, dueDate: '2026-10-01', paid: 0 }
  const plan = billPlan(expense, oct30, 'biweekly')
  assert.equal(plan.urgent, true)
  assert.equal(plan.ideal, 100000)
})

test('urgent bills win when the paycheck cannot cover them', () => {
  const result = buildSuggestions(
    budget({
      payFrequency: 'biweekly',
      miscBuffer: 30000,
      expenses: [{ id: 'rent', name: 'Rent / Mortgage', amount: 200000, dueDate: '2026-10-01', paid: 0, preset: true }],
    }),
    150000,
    oct30,
  )
  assert.equal(result.amounts.rent, 150000)
  assert.equal(result.uncoveredUrgent, 50000)
  assert.equal(result.miscKept, 0)
  assert.equal(result.amounts.visa, undefined)
  assert.equal(result.assigned, 150000)
})

test('leftover goes to savings when there is no debt', () => {
  const result = buildSuggestions(budget({ debts: [], expenses: [], miscBuffer: 0 }), 10000, oct30)
  assert.equal(result.amounts.savings, 10000)
})

test('leftover splits across debts, savings, and investments', () => {
  const result = buildSuggestions(
    budget({ expenses: [], miscBuffer: 0, savingsGoal: 9000, investmentGoal: 9000 }),
    9000,
    oct30,
  )
  assert.equal(result.amounts.visa, 3000)
  assert.equal(result.amounts.savings, 3000)
  assert.equal(result.amounts.investments, 3000)
})

test('investments take the savings share when there is no savings goal', () => {
  const result = buildSuggestions(
    budget({ expenses: [], miscBuffer: 0, savingsGoal: 0, investmentGoal: 5000, investmentTotal: 0 }),
    8000,
    oct30,
  )
  assert.equal(result.amounts.visa, 4000)
  assert.equal(result.amounts.savings, undefined)
  assert.equal(result.amounts.investments, 4000)
})

test('leftover goes to debt when the savings goal is already met', () => {
  const result = buildSuggestions(
    budget({ expenses: [], miscBuffer: 0, savingsTotal: 200000 }),
    8000,
    oct30,
  )
  assert.equal(result.amounts.visa, 8000)
  assert.equal(result.amounts.savings, undefined)
})

test('split stays within each balance', () => {
  const shares = splitProportional(101, [
    { id: 'a', weight: 1 },
    { id: 'b', weight: 1 },
    { id: 'c', weight: 100 },
  ])
  assert.equal((shares.a || 0) + (shares.b || 0) + shares.c, 101)
  assert.ok((shares.a || 0) <= 1)
  assert.ok((shares.b || 0) <= 1)
  assert.ok(shares.c <= 100)
})

test('recording a payment celebrates the highest new milestone once', () => {
  const starting = budget({
    debts: [{ id: 'visa', name: 'Visa', original: 100000, remaining: 100000, celebrated: [] }],
    expenses: [],
  })
  const first = commitPaycheck(starting, { visa: 60000 }, oct30)
  assert.equal(first.budget.debts[0].remaining, 40000)
  assert.deepEqual(first.budget.debts[0].celebrated, [10, 25, 50])
  assert.equal(first.celebrations.length, 1)
  assert.equal(first.celebrations[0].threshold, 50)
  assert.match(first.celebrations[0].message, /50%/)

  const second = commitPaycheck(first.budget, { visa: 10000 }, oct30)
  assert.equal(second.celebrations.length, 0)
  assert.equal(second.budget.debts[0].remaining, 30000)
})

test('paying off a debt celebrates and a savings deposit is charted', () => {
  const starting = budget({
    debts: [{ id: 'visa', name: 'Visa', original: 2000, remaining: 2000, celebrated: [] }],
    savingsGoal: 5000,
    expenses: [],
    miscBuffer: 0,
  })
  const result = commitPaycheck(starting, { visa: 2000, savings: 1500 }, oct30)
  assert.equal(result.budget.debts[0].remaining, 0)
  assert.equal(result.celebrations[0].confetti, true)
  assert.equal(result.budget.savingsTotal, 1500)
  assert.equal(result.budget.savingsHistory[0].total, 1500)
  assert.equal(result.budget.savingsHistory[0].date, '2026-10-30')
  assert.equal(result.budget.draft, null)
})

test('a second deposit on the same day updates that chart point', () => {
  const starting = budget({
    debts: [],
    expenses: [],
    savingsGoal: 5000,
    savingsTotal: 1500,
    savingsHistory: [{ date: '2026-10-30', total: 1500 }],
  })
  const result = commitPaycheck(starting, { savings: 500 }, oct30)
  assert.equal(result.budget.savingsHistory.length, 1)
  assert.equal(result.budget.savingsHistory[0].total, 2000)
})

test('a paycheck deposit and a later balance update both move investments', () => {
  const starting = budget({
    debts: [],
    expenses: [],
    savingsGoal: 0,
    investmentGoal: 10000,
    investmentTotal: 1000,
    investmentHistory: [],
  })
  const paid = commitPaycheck(starting, { investments: 2500 }, oct30)
  assert.equal(paid.budget.investmentTotal, 3500)
  assert.equal(paid.budget.investmentHistory[0].date, '2026-10-30')
  assert.equal(paid.budget.investmentHistory[0].total, 3500)
  const updated = setTrackedBalance(paid.budget, 'investments', 4200, oct30)
  assert.equal(updated.budget.investmentTotal, 4200)
  assert.equal(updated.budget.investmentHistory.length, 1)
  assert.equal(updated.budget.investmentHistory[0].total, 4200)
  assert.equal(updated.celebrations.length, 0)
})

test('updating savings to the goal celebrates once', () => {
  const starting = budget({ savingsGoal: 2000, savingsTotal: 1500, savingsHistory: [] })
  const reached = setTrackedBalance(starting, 'savings', 2000, oct30)
  assert.equal(reached.budget.savingsTotal, 2000)
  assert.equal(reached.celebrations.length, 1)
  assert.match(reached.celebrations[0].message, /savings goal/)
  const again = setTrackedBalance(reached.budget, 'savings', 2500, oct30)
  assert.equal(again.celebrations.length, 0)
})

test('reaching the savings goal celebrates', () => {
  const starting = budget({
    debts: [],
    expenses: [],
    savingsGoal: 2000,
    savingsTotal: 1500,
    savingsHistory: [{ date: '2026-10-01', total: 1500 }],
  })
  const result = commitPaycheck(starting, { savings: 500 }, oct30)
  assert.equal(result.celebrations[0].threshold, 'goal')
  assert.equal(result.celebrations[0].confetti, true)
})

test('a dated bill keeps a partial payment into the next month', () => {
  const starting = budget({
    expenses: [
      { id: 'rent', name: 'Rent / Mortgage', amount: 150000, dueDate: '2026-11-01', paid: 0, preset: true },
      { id: 'misc', name: 'Misc', amount: 2000, dueDate: null, paid: 2000, preset: false },
    ],
  })
  const paid = commitPaycheck(starting, { rent: 40000 }, oct30, 200000)
  assert.equal(paid.budget.expenses[0].paid, 40000)
  assert.equal(paid.budget.lastPayAmount, 200000)
  assert.equal(paid.budget.lastFundsRemaining, 160000)
  const next = rollover(paid.budget, new Date(2026, 10, 1))
  assert.equal(next.expenseMonth, '2026-11')
  assert.equal(next.expenses[0].paid, 40000)
  assert.equal(next.expenses[1].paid, 0)
  assert.equal(rollover(next, new Date(2026, 10, 2)), next)
})

test('allocations cannot pass the paycheck or a remaining balance', () => {
  const current = budget()
  assert.deepEqual(validateAllocations(current, 100000, { rent: 160000 }), [
    'Rent / Mortgage only has $1,500.00 left.',
    'That’s more than this paycheck.',
  ])
  assert.deepEqual(validateAllocations(current, 300000, { visa: 20 }), [])
})

test('blank preset bills are dropped and existing progress is kept on edit', () => {
  const existing = budget()
  existing.expenses[0].paid = 25000
  const created = applyForm(
    {
      payFrequency: 'biweekly',
      typicalPay: '1800',
      miscBuffer: '250',
      debts: [{ id: 'visa', name: 'Visa', amount: '4000', kind: 'loan' }],
      expenses: [
        { id: 'rent', name: 'Rent / Mortgage', amount: '1500', dueDate: '2026-11-01', preset: true },
        { id: 'net', name: 'Internet', amount: '', dueDate: '', preset: true },
        { id: 'phone', name: 'Cellphone', amount: '', dueDate: '2026-11-04', preset: true },
        { id: 'util', name: 'Utilities', amount: '', dueDate: '', preset: true },
      ],
      savingsGoal: '2000',
    },
    existing,
    oct30,
  )
  assert.equal(created.ok, false)
  assert.match(created.error, /Cellphone/)

  const saved = applyForm(
    {
      payFrequency: 'biweekly',
      typicalPay: '1800',
      miscBuffer: '250',
      debts: [{ id: 'visa', name: 'Visa', amount: '4000', kind: 'loan' }],
      expenses: [
        { id: 'rent', name: 'Rent / Mortgage', amount: '1500', dueDate: '2026-11-01', preset: true },
        { id: 'net', name: 'Internet', amount: '', dueDate: '', preset: true },
      ],
      savingsGoal: '',
    },
    existing,
    oct30,
  )
  assert.equal(saved.ok, true)
  assert.equal(saved.budget.expenses.length, 1)
  assert.equal(saved.budget.expenses[0].paid, 25000)
  assert.equal(saved.budget.debts[0].remaining, 400000)
  assert.equal(saved.budget.debts[0].original, 400000)
  assert.equal(saved.budget.savingsGoal, 0)
  assert.equal(saved.budget.payFrequency, 'biweekly')
  assert.equal(saved.budget.expenses[0].dueDate, '2026-11-01')
})

test('a future due date is not past due, and a passed date is', () => {
  const upcoming = { amount: 10000, paid: 0, dueDate: '2026-11-05' }
  const missed = { amount: 10000, paid: 0, dueDate: '2026-10-01' }
  const today = { amount: 10000, paid: 0, dueDate: '2026-10-30' }
  assert.equal(dueLabel(upcoming, oct30), 'Due Nov 5')
  assert.equal(dueLabel(missed, oct30), 'Past due · Oct 1')
  assert.equal(dueLabel(today, oct30), 'Due today')
  assert.equal(resolveDueDate({ dueDay: 1 }, oct30), '2026-11-01')
  assert.equal(resolveDueDate({ dueDay: 30 }, oct30), '2026-10-30')
  assert.equal(resolveDueDate({ dueDate: '2026-12-15' }, oct30), '2026-12-15')
})

test('savings scale runs from zero to the goal', () => {
  assert.deepEqual(savingsTicks(500000), [0, 100000, 200000, 300000, 400000, 500000])
})

test('moving a paid bill to a later due date starts the next payment', () => {
  const existing = budget()
  existing.expenses[0].paid = 150000
  const saved = applyForm(
    {
      payFrequency: 'monthly',
      typicalPay: '3000',
      miscBuffer: '400',
      debts: [{ id: 'visa', name: 'Visa', amount: '5000', kind: 'loan' }],
      expenses: [{ id: 'rent', name: 'Rent / Mortgage', amount: '1500', dueDate: '2026-12-01', preset: true }],
      savingsGoal: '2000',
    },
    existing,
    oct30,
  )
  assert.equal(saved.ok, true)
  assert.equal(saved.budget.expenses[0].paid, 0)
  assert.equal(saved.budget.expenses[0].dueDate, '2026-12-01')
})

test('credit score bands, the 31 day reminder, and the change since last update', () => {
  assert.equal(creditStanding(600).label, '100 points to 700.')
  assert.equal(creditStanding(700).label, '700 reached. 750 is next.')
  assert.equal(creditStanding(750).label, '750 reached. 800 is next.')
  assert.equal(creditStanding(800).label, '800+ reached. Strong work.')
  assert.equal(parseCreditScore('600'), 600)
  assert.equal(parseCreditScore('299'), null)
  assert.equal(parseCreditScore('901'), null)
  const checked = new Date(2026, 9, 28)
  assert.equal(localDateISO(nextCreditCheck('2026-10-28')), '2026-11-28')
  assert.equal(creditCheckDue('2026-10-28', new Date(2026, 10, 27)), false)
  assert.equal(creditCheckDue('2026-10-28', new Date(2026, 10, 28)), true)
  const first = applyCreditScore(budget(), 600, checked)
  assert.equal(first.creditScore, 600)
  assert.equal(first.creditPrevious, null)
  assert.equal(first.creditCheckedOn, '2026-10-28')
  const second = applyCreditScore(first, 591, new Date(2026, 10, 28))
  assert.equal(second.creditScore, 591)
  assert.equal(second.creditPrevious, 600)
  assert.equal(second.creditCheckedOn, '2026-11-28')
})

test('a bill every 2 weeks is due in full when it falls before the next paycheck', () => {
  const gym = { id: 'gym', name: 'Gym', amount: 4000, dueDate: '2026-11-10', paid: 0, repeat: 'biweekly' }
  const soon = billPlan(gym, oct30, 'biweekly')
  assert.equal(soon.urgent, true)
  assert.equal(soon.ideal, 4000)
  const later = billPlan({ ...gym, dueDate: '2026-11-20' }, oct30, 'biweekly')
  assert.equal(later.urgent, false)
  assert.equal(later.ideal, 0)
})

test('a weekly bill can need two payments before the next paycheck', () => {
  const plan = billPlan(
    { id: 'gym', name: 'Gym', amount: 2000, dueDate: '2026-11-01', paid: 0, repeat: 'weekly' },
    oct30,
    'biweekly',
  )
  assert.equal(plan.ideal, 4000)
})

test('a paid repeating bill moves to the next due date', () => {
  const starting = budget({
    expenses: [{ id: 'gym', name: 'Gym', amount: 4000, dueDate: '2026-10-30', paid: 4000, repeat: 'biweekly', preset: false }],
  })
  const next = rollover(starting, oct30)
  assert.equal(next.expenses[0].dueDate, '2026-11-13')
  assert.equal(next.expenses[0].paid, 0)
  const waiting = rollover(
    budget({
      expenses: [{ id: 'gym', name: 'Gym', amount: 4000, dueDate: '2026-10-30', paid: 1000, repeat: 'biweekly', preset: false }],
    }),
    oct30,
  )
  assert.equal(waiting.expenses[0].dueDate, '2026-10-30')
  assert.equal(waiting.expenses[0].paid, 1000)
})

test('a debt minimum is set aside before extra payoff', () => {
  const result = buildSuggestions(
    budget({
      payFrequency: 'biweekly',
      miscBuffer: 8000,
      expenses: [],
      savingsGoal: 0,
      debts: [{
        id: 'visa',
        name: 'Visa',
        original: 100000,
        remaining: 100000,
        celebrated: [],
        minimum: 6000,
        repeat: 'biweekly',
        dueDate: '2026-10-30',
        minimumPaid: 0,
      }],
    }),
    10000,
    oct30,
  )
  assert.equal(result.amounts.visa, 6000)
  assert.equal(result.miscKept, 4000)
})

test('paying a repeating minimum moves its next due date', () => {
  const starting = budget({
    debts: [{
      id: 'visa',
      name: 'Visa',
      original: 100000,
      remaining: 100000,
      celebrated: [],
      minimum: 5000,
      repeat: 'biweekly',
      dueDate: '2026-10-30',
      minimumPaid: 0,
    }],
    expenses: [],
  })
  const paid = commitPaycheck(starting, { visa: 5000 }, oct30)
  assert.equal(paid.budget.debts[0].remaining, 95000)
  assert.equal(paid.budget.debts[0].dueDate, '2026-11-13')
  assert.equal(paid.budget.debts[0].minimumPaid, 0)
})

test('a minimum still due after payday is set aside before extra payments', () => {
  const result = buildSuggestions(
    budget({
      payFrequency: 'biweekly',
      miscBuffer: 0,
      expenses: [],
      savingsGoal: 0,
      debts: [{
        id: 'car',
        name: 'Car Loan',
        original: 200000,
        remaining: 200000,
        celebrated: [],
        minimum: 33000,
        repeat: 'biweekly',
        dueDate: '2026-11-20',
        minimumPaid: 0,
      }],
    }),
    50000,
    oct30,
  )
  assert.equal(result.amounts.car, 50000)
  const lines = suggestionLines(
    budget({
      payFrequency: 'biweekly',
      miscBuffer: 0,
      expenses: [],
      savingsGoal: 80000,
      savingsTotal: 0,
      debts: [{
        id: 'car',
        name: 'Car Loan',
        original: 200000,
        remaining: 200000,
        celebrated: [],
        minimum: 33000,
        repeat: 'biweekly',
        dueDate: '2026-11-20',
        minimumPaid: 0,
      }],
    }),
    buildSuggestions(
      budget({
        payFrequency: 'biweekly',
        miscBuffer: 0,
        expenses: [],
        savingsGoal: 80000,
        savingsTotal: 0,
        debts: [{
          id: 'car',
          name: 'Car Loan',
          original: 200000,
          remaining: 200000,
          celebrated: [],
          minimum: 33000,
          repeat: 'biweekly',
          dueDate: '2026-11-20',
          minimumPaid: 0,
        }],
      }),
      50000,
      oct30,
    ),
    oct30,
  )
  assert.equal(lines[0].name, 'Car Loan minimum')
  assert.equal(lines[0].cents, 33000)
  assert.equal(lines[1].name, 'Car Loan')
})

test('an expense minimum is set aside when the full bill is not due yet', () => {
  const result = buildSuggestions(
    budget({
      payFrequency: 'biweekly',
      miscBuffer: 0,
      savingsGoal: 0,
      debts: [],
      expenses: [{
        id: 'gym',
        name: 'Gym',
        amount: 8000,
        dueDate: '2026-11-20',
        paid: 0,
        repeat: 'biweekly',
        minimum: 4000,
        preset: false,
      }],
    }),
    10000,
    oct30,
  )
  assert.equal(result.amounts.gym, 4000)
  const lines = suggestionLines(
    budget({
      payFrequency: 'biweekly',
      miscBuffer: 0,
      savingsGoal: 0,
      debts: [],
      expenses: [{
        id: 'gym',
        name: 'Gym',
        amount: 8000,
        dueDate: '2026-11-20',
        paid: 0,
        repeat: 'biweekly',
        minimum: 4000,
        preset: false,
      }],
    }),
    result,
    oct30,
  )
  assert.equal(lines[0].name, 'Gym minimum')
  assert.equal(lines[0].cents, 4000)
})

test('interest on a credit card raises the balance', () => {
  const card = { id: 'visa', name: 'Visa', kind: 'card', original: 80000, remaining: 72500, celebrated: [10] }
  const charged = addInterest(card, 1500)
  assert.equal(charged.remaining, 74000)
  assert.equal(charged.original, 80000)
  assert.deepEqual(charged.celebrated, [10])
  const grown = addInterest(charged, 10000)
  assert.equal(grown.remaining, 84000)
  assert.equal(grown.original, 84000)
  assert.equal(addInterest({ ...card, kind: 'loan' }, 1500).remaining, 72500)
  assert.equal(addInterest(card, 0), card)

  const saved = applyForm(
    {
      payFrequency: 'monthly',
      typicalPay: '3000',
      miscBuffer: '0',
      debts: [{ id: 'visa', name: 'Visa', amount: '725', kind: 'card' }],
      expenses: [],
      savingsGoal: '',
    },
    null,
    oct30,
  )
  assert.equal(saved.ok, true)
  assert.equal(saved.budget.debts[0].kind, 'card')
  const missing = applyForm(
    {
      payFrequency: 'monthly',
      typicalPay: '3000',
      miscBuffer: '0',
      debts: [{ id: 'visa', name: 'Visa', amount: '725' }],
      expenses: [],
      savingsGoal: '',
    },
    null,
    oct30,
  )
  assert.equal(missing.ok, false)
})

test('a backup file round-trips and a bad file is refused', () => {
  const starting = budget({ savingsTotal: 33000, investmentGoal: 250000, investmentTotal: 7500 })
  const file = budgetFile(starting, oct30)
  const wrapped = JSON.parse(file)
  assert.equal(wrapped.app, 'Simple Budget')
  assert.equal(wrapped.version, 1)
  assert.equal(wrapped.exportedAt, '2026-10-30')
  const restored = budgetFromFile(file)
  assert.equal(restored.ok, true)
  assert.equal(restored.budget.typicalPay, 300000)
  assert.equal(restored.budget.savingsTotal, 33000)
  assert.equal(restored.budget.investmentTotal, 7500)
  assert.equal(restored.budget.debts[0].name, 'Visa')
  assert.equal(restored.budget.debts[0].kind, 'loan')
  const legacyCard = budgetFromFile(JSON.stringify(budget({
    debts: [{ id: 'card', name: 'Credit Card', original: 80000, remaining: 72500, celebrated: [] }],
  })))
  assert.equal(legacyCard.ok, true)
  assert.equal(legacyCard.budget.debts[0].kind, 'card')
  const raw = budgetFromFile(JSON.stringify(starting))
  assert.equal(raw.ok, true)
  assert.equal(raw.budget.payFrequency, 'monthly')
  assert.equal(budgetFromFile('not json').ok, false)
  assert.equal(budgetFromFile('{"hello":1}').ok, false)
})
