import {
  buildSuggestions,
  creditCheckDue,
  creditStanding,
  dueLabel,
  minimumLabel,
  nextCreditCheck,
  readAllocations,
  suggestionLines,
  suggestionNote,
  validateAllocations,
} from './budget.js'
import {
  compactMoney,
  escapeHtml,
  formatLongDate,
  formatMoney,
  parseISODate,
  parseMoney,
  savingsTicks,
  startOfDay,
} from './format.js'

export function renderApp(state) {
  const today = new Date()
  const page = state.screen === 'onboarding'
    ? renderOnboarding(state)
    : state.screen === 'edit'
      ? renderEdit(state)
      : renderDashboard(state, today)
  return `${page}${toaster(state.toasts)}${state.showConfetti ? confetti() : ''}`
}

function renderOnboarding(state) {
  const step = state.step
  return `<div class="wrap">
    ${brand()}
    <p class="lede">A few questions, then your overview.</p>
    <div class="dots" aria-hidden="true">
      ${[0, 1, 2, 3, 4, 5, 6].map((index) => `<i class="${index === step ? 'is-on' : ''} ${index < step ? 'is-done' : ''}"></i>`).join('')}
    </div>
    <section>
      ${stepBody(state)}
      ${errorHtml(state.error)}
      <div class="actions">
        ${step > 0 ? '<button type="button" class="ghost" data-action="back">Back</button>' : ''}
        <button type="button" class="primary" data-action="next">${step === 6 ? 'See my budget' : 'Continue'}</button>
      </div>
    </section>
  </div>`
}

function stepBody(state) {
  const form = state.form
  if (state.step === 0) {
    return `<h2>How often do you get paid?</h2>
      <p class="muted">This is used to suggest how to split each paycheck.</p>
      <div class="choices">
        ${choice('biweekly', 'Bi-weekly', form.payFrequency === 'biweekly')}
        ${choice('monthly', 'Monthly', form.payFrequency === 'monthly')}
      </div>`
  }
  if (state.step === 1) {
    return `<h2>About how much lands each paycheck?</h2>
      <p class="muted">A rough number is enough. You’ll enter the real amount every time you get paid.</p>
      <div class="field"><label for="typical-pay">Amount</label>${moneyField('typical-pay', form.typicalPay, 'typicalPay')}</div>`
  }
  if (state.step === 2) {
    return `<h2>Which debts are you paying off?</h2>
      <p class="muted">Name each one, mark it as a credit card or a loan, and enter what you still owe. A credit card can take an interest charge from the chart.</p>
      ${debtEditor(form.debts)}
      <button type="button" class="add" data-action="add-debt"><span>+</span> Add a debt</button>`
  }
  if (state.step === 3) {
    return `<h2>What expenses do you have?</h2>
      <p class="muted">Leave a row blank if you don’t have that bill. Monthly is the usual repeat. A gym membership can be every 2 weeks.</p>
      ${expenseEditor(form.expenses)}
      <button type="button" class="add" data-action="add-expense"><span>+</span> Add an expense</button>`
  }
  if (state.step === 4) {
    return `<h2>What do you want left for everyday spending?</h2>
      <p class="muted">Food, entertainment, and anything else you want sitting in the account until next payday. Suggestions will try not to assign this money.</p>
      <div class="field"><label for="misc-buffer">Amount to keep</label>${moneyField('misc-buffer', form.miscBuffer, 'miscBuffer')}</div>`
  }
  if (state.step === 5) {
    return `<h2>Do you have a savings goal?</h2>
      <p class="muted">One target. The overview charts how close you get.</p>
      <div class="choices">
        <button type="button" class="choice ${state.wantsSavings === true ? 'is-selected' : ''}" data-action="savings-choice" data-value="yes">Yes</button>
        <button type="button" class="choice ${state.wantsSavings === false ? 'is-selected' : ''}" data-action="savings-choice" data-value="no">Not right now</button>
      </div>
      ${state.wantsSavings ? `<div class="field"><label for="savings-goal">Amount to save</label>${moneyField('savings-goal', form.savingsGoal, 'savingsGoal')}</div>` : ''}`
  }
  return `<h2>Do you have an investment goal?</h2>
    <p class="muted">One target. It charts under savings, and you can add to it each payday.</p>
    <div class="choices">
      <button type="button" class="choice ${state.wantsInvestments === true ? 'is-selected' : ''}" data-action="investments-choice" data-value="yes">Yes</button>
      <button type="button" class="choice ${state.wantsInvestments === false ? 'is-selected' : ''}" data-action="investments-choice" data-value="no">Not right now</button>
    </div>
    ${state.wantsInvestments ? `<div class="field"><label for="investment-goal">Amount to invest</label>${moneyField('investment-goal', form.investmentGoal, 'investmentGoal')}</div>` : ''}`
}

function renderEdit(state) {
  const form = state.form
  return `<div class="wrap">
    <header class="topbar">
      ${brandMark()}
      ${desktopActions('<button type="button" class="ghost" data-action="cancel-edit">Cancel</button>')}
    </header>
    <section>
      <h2>Pay schedule</h2>
      <div class="choices">
        ${choice('biweekly', 'Bi-weekly', form.payFrequency === 'biweekly')}
        ${choice('monthly', 'Monthly', form.payFrequency === 'monthly')}
      </div>
      <div class="field"><label for="typical-pay">Typical paycheck</label>${moneyField('typical-pay', form.typicalPay, 'typicalPay')}</div>
      <div class="field"><label for="misc-buffer">Everyday spending to keep</label>${moneyField('misc-buffer', form.miscBuffer, 'miscBuffer')}</div>
    </section>
    <section class="block">
      <h2>Debts</h2>
      ${debtEditor(form.debts)}
      <button type="button" class="add" data-action="add-debt"><span>+</span> Add a debt</button>
    </section>
    <section class="block">
      <h2>Expenses</h2>
      ${expenseEditor(form.expenses)}
      <button type="button" class="add" data-action="add-expense"><span>+</span> Add an expense</button>
    </section>
    <section class="block">
      <h2>Savings goal</h2>
      <p class="muted">Leave this blank if you don’t want a goal right now.</p>
      <div class="field"><label for="savings-goal">Amount</label>${moneyField('savings-goal', form.savingsGoal, 'savingsGoal')}</div>
    </section>
    <section class="block">
      <h2>Investment goal</h2>
      <p class="muted">Leave this blank if you don’t want a goal right now.</p>
      <div class="field"><label for="investment-goal">Amount</label>${moneyField('investment-goal', form.investmentGoal, 'investmentGoal')}</div>
    </section>
    ${errorHtml(state.error)}
    <div class="actions">
      <button type="button" class="primary" data-action="save-edit">Save</button>
    </div>
    <p class="reset-row"><button type="button" class="text-btn" data-action="reset">Erase this budget</button></p>
  </div>`
}

function renderDashboard(state, today) {
  const budget = state.budget
  const parsed = budget.draft ? parseDraft(budget) : null
  const allocations = parsed?.allocations || {}
  const view = project(budget, allocations)
  return `<div class="wrap">
    <header class="topbar">
      ${brandMark()}
      ${desktopActions(`${budget.draft ? '' : '<button type="button" class="primary" data-action="start-pay">I got paid</button>'}
        <button type="button" class="ghost" data-action="edit">Edit</button>`)}
    </header>
    ${overview(state, view, today)}
    ${budget.draft ? paycheckPanel(state, parsed, today) : typicalPlan(budget, today)}
  </div>`
}

function overview(state, view, today) {
  const budget = state.budget
  return `<section class="overview">
    <div class="funds-hero">
      ${fundsHero(state, view)}
      ${creditSection(state, today)}
      ${billSection(view.expenses, today)}
    </div>
    <div class="overview-side">
      ${debtSection(view.debts, state.dissolvingIds, state)}
      <div class="overview-goals">
        ${goalSection(state, {
          kind: 'savings',
          title: 'Savings',
          goal: budget.savingsGoal || 0,
          total: budget.savingsTotal || 0,
          draft: view.savingsDraft,
          noun: 'saved',
          color: '#0f7a45',
        })}
        ${goalSection(state, {
          kind: 'investments',
          title: 'Investments',
          goal: budget.investmentGoal || 0,
          total: budget.investmentTotal || 0,
          draft: view.investmentDraft,
          noun: 'invested',
          color: '#1565c0',
        })}
      </div>
    </div>
  </section>`
}

function fundsHero(state, view) {
  const budget = state.budget
  const remaining = budget.lastFundsRemaining
  const figure = formatMoney(remaining == null ? 0 : remaining)
  const totalExpenses = view.expenses.reduce(
    (sum, expense) => sum + Math.max(0, expense.amount - Math.min(expense.amount, expense.projectedPaid)),
    0,
  )
  const source = budget.fundsAdjusted
    ? 'You set this amount.'
    : budget.lastPayAmount == null
      ? 'This updates when you record a paycheck.'
      : `From a ${formatMoney(budget.lastPayAmount)} paycheck.`
  const editor = state.editingFunds
    ? `<div class="funds-edit">
        <label class="tiny" for="funds-remaining">Funds remaining</label>
        ${moneyField('funds-remaining', state.fundsDraft, 'funds-remaining')}
        ${state.fundsError ? `<p class="error" role="alert">${escapeHtml(state.fundsError)}</p>` : ''}
        <div class="actions">
          <button type="button" class="ghost" data-action="cancel-funds">Cancel</button>
          <button type="button" class="primary" data-action="save-funds">Save</button>
        </div>
      </div>`
    : `<button type="button" class="funds-figure" data-action="edit-funds">${figure}</button>`
  return `<div class="funds-block">
    ${editor}
    <div class="funds-caption">Funds remaining after last pay ${state.editingFunds ? '' : '<button type="button" class="text-btn funds-edit-link" data-action="edit-funds">Edit</button>'}</div>
    <p class="total-expenses">Total Expenses ${formatMoney(totalExpenses)}</p>
    <p class="hint">${escapeHtml(source)}</p>
  </div>`
}

function creditSection(state, today) {
  const budget = state.budget
  const score = budget.creditScore
  const due = score != null && creditCheckDue(budget.creditCheckedOn, today)
  const showForm = score == null || due || state.editingCredit
  const standing = score == null ? null : creditStanding(score)
  const checked = budget.creditCheckedOn ? parseISODate(budget.creditCheckedOn) : null
  const next = nextCreditCheck(budget.creditCheckedOn)
  const days = checked ? Math.round((startOfDay(today) - startOfDay(checked)) / 86400000) : 0
  const delta = score != null && budget.creditPrevious != null ? score - budget.creditPrevious : null
  const gauge = score == null
    ? ''
    : `<p class="credit-score-num">${score}</p>
      <p class="credit-note">${escapeHtml(standing.label)}</p>
      <div class="credit-line">${creditLine(score)}</div>
      <p class="credit-asof">As of ${escapeHtml(formatLongDate(checked))}</p>
      <p class="credit-next">Next update: ${escapeHtml(formatLongDate(next))}</p>
      ${delta == null ? '' : `<p class="credit-delta ${delta > 0 ? 'is-up' : ''}">Since last month ${delta > 0 ? `+${delta}` : delta}</p>`}`
  const reminder = due
    ? `<p class="credit-remind" role="status">It’s been ${days} days. A fresh check keeps this current.</p>`
    : ''
  const form = showForm
    ? `<div class="credit-form">
        <label class="tiny" for="credit-score">${score == null ? 'Your score' : 'New score'}</label>
        <input id="credit-score" data-bind="credit-score" inputmode="numeric" maxlength="3" autocomplete="off" placeholder="300–900" value="${escapeHtml(state.creditDraft)}" />
        ${state.creditError ? `<p class="error" role="alert">${escapeHtml(state.creditError)}</p>` : ''}
        <div class="actions">
          ${score != null && !due ? '<button type="button" class="ghost" data-action="cancel-credit">Cancel</button>' : ''}
          <button type="button" class="primary" data-action="save-credit">Save score</button>
        </div>
      </div>`
    : '<button type="button" class="text-btn" data-action="edit-credit">Update score</button>'
  const intro = score == null
    ? '<p class="muted">Enter your score from 300 to 900. You’ll get a reminder to check it again in 31 days.</p>'
    : ''
  return `<section class="credit">
    <h2>Credit Score</h2>
    ${intro}
    ${gauge}
    ${reminder}
    ${form}
  </section>`
}

function creditLine(score) {
  const min = 300
  const max = 900
  const marks = [
    { value: 700, label: '700' },
    { value: 750, label: '750' },
    { value: 800, label: '800+' },
  ]
  const width = 640
  const height = 52
  const left = 8
  const right = 8
  const axisY = 14
  const plotW = width - left - right
  const xOf = (value) => left + ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * plotW
  const mx = xOf(score)
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Credit score ${score}. Milestones at 700, 750, and 800+.">
    <line x1="${left}" y1="${axisY}" x2="${width - right}" y2="${axisY}" stroke="#ddd9d2" stroke-width="4" stroke-linecap="round" />
    <line x1="${left}" y1="${axisY}" x2="${mx.toFixed(1)}" y2="${axisY}" stroke="#0f7a45" stroke-width="4" stroke-linecap="round" />
    <circle cx="${mx.toFixed(1)}" cy="${axisY}" r="6" fill="#0f7a45" />
    ${marks.map((mark) => {
      const tx = xOf(mark.value).toFixed(1)
      const reached = score >= mark.value
      return `<line x1="${tx}" y1="${axisY + 10}" x2="${tx}" y2="${axisY + 16}" stroke="${reached ? '#0f7a45' : '#8a857c'}" />
        <text x="${tx}" y="${height - 4}" text-anchor="middle" fill="${reached ? '#0c6639' : '#5e5a54'}" font-size="13" font-weight="600" font-family="Avenir Next, Avenir, sans-serif">${mark.label}</text>`
    }).join('')}
  </svg>`
}

function paycheckPanel(state, parsed, today) {
  const budget = state.budget
  const showFunds = parsed.paycheckValid && !parsed.invalid
  const suggestions = showFunds ? buildSuggestions(budget, parsed.paycheck, today) : null
  const funds = showFunds ? parsed.paycheck - parsed.assigned : 0
  return `<section class="pay-panel">
    <h2>This paycheck</h2>
    <div class="field">
      <label for="pay-amount">How much did you get paid?</label>
      ${moneyField('pay-amount', budget.draft.amount, 'paycheck')}
    </div>
    ${showFunds ? `<div class="funds-bar ${funds < 0 ? 'is-short' : ''}">
      <span>Funds available</span>
      <strong>${formatMoney(funds)}</strong>
    </div>
    <p class="hint">${escapeHtml(fundsNote(funds, budget.miscBuffer))}</p>
    <p class="hint">${escapeHtml(suggestionNote(suggestions, budget))}</p>
    <button type="button" class="ghost wide" data-action="use-suggested">Use suggested amounts</button>
    <div class="sheet">
      ${allocRows(budget, parsed.allocations, suggestions, today)}
    </div>` : '<p class="hint">Funds available will show here, in green, and drop as you assign this check.</p>'}
    ${errorHtml(state.error || parsed.errors[0] || '')}
    <div class="actions">
      <button type="button" class="ghost" data-action="cancel-pay">Cancel</button>
      <button type="button" class="primary" data-action="record">Record payments</button>
    </div>
  </section>`
}

function allocRows(budget, allocations, suggestions, today) {
  const rows = []
  for (const expense of budget.expenses) {
    const draft = allocations[expense.id] || 0
    const left = Math.max(0, expense.amount - expense.paid - draft)
    const projected = { ...expense, paid: Math.min(expense.amount, expense.paid + draft) }
    const label = left > 0 ? `${dueLabel(projected, today)} · ${formatMoney(left)} left` : dueLabel(projected, today)
    if (expense.amount - expense.paid <= 0 && draft === 0) {
      rows.push(staticRow(expense.name, dueLabel(expense, today)))
      continue
    }
    rows.push(allocRow({
      id: expense.id,
      name: expense.name,
      value: budgetValue(budget, expense.id),
      meta: label,
      past: label.startsWith('Past due'),
      suggested: suggestions.amounts[expense.id] || 0,
    }))
  }
  for (const debt of budget.debts) {
    if (debt.remaining <= 0) continue
    const draft = allocations[debt.id] || 0
    const left = Math.max(0, debt.remaining - draft)
    rows.push(allocRow({
      id: debt.id,
      name: debt.name,
      value: budgetValue(budget, debt.id),
      meta: `${formatMoney(left)} left of ${formatMoney(debt.original)}${minimumLabel(debt) ? ` · ${minimumLabel(debt)}` : ''}`,
      suggested: suggestions.amounts[debt.id] || 0,
    }))
  }
  goalAllocRow(rows, budget, allocations, suggestions, 'savings', 'Savings', budget.savingsGoal, budget.savingsTotal)
  goalAllocRow(rows, budget, allocations, suggestions, 'investments', 'Investments', budget.investmentGoal, budget.investmentTotal)
  if (!rows.length) return '<p class="empty">Nothing to assign yet. Add a bill, debt, savings goal, or investment goal in Edit.</p>'
  return rows.join('')
}

function goalAllocRow(rows, budget, allocations, suggestions, id, name, goal, total) {
  if (!(goal > 0)) return
  const draft = allocations[id] || 0
  rows.push(allocRow({
    id,
    name,
    value: budgetValue(budget, id),
    meta: `${formatMoney((total || 0) + draft)} of ${formatMoney(goal)}`,
    suggested: suggestions.amounts[id] || 0,
  }))
}

function budgetValue(budget, id) {
  return budget.draft?.allocations?.[id] || ''
}

function allocRow({ id, name, value, meta, past = false, suggested }) {
  return `<div class="alloc">
    <label for="alloc-${escapeHtml(id)}">${escapeHtml(name)}</label>
    <p class="meta ${past ? 'is-past' : ''}">${escapeHtml(meta)}</p>
    ${moneyField(`alloc-${id}`, value, 'alloc', id)}
    <p class="hint">${suggested ? `Suggested ${formatMoney(suggested)}` : 'Nothing suggested from this check'}</p>
  </div>`
}

function staticRow(name, meta) {
  return `<div class="alloc">
    <p class="label">${escapeHtml(name)}</p>
    <p class="meta is-paid">${escapeHtml(meta)}</p>
  </div>`
}

function typicalPlan(budget, today) {
  const result = buildSuggestions(budget, budget.typicalPay, today)
  const rows = suggestionLines(budget, result, today)
  return `<section class="block">
    <h2>Suggested paycheck</h2>
    <p class="muted">On ${formatMoney(budget.typicalPay)}, from what’s still open. Minimums are set aside before extra payments. Your real check can be a different amount.</p>
    <ul class="sheet">
      ${rows.map((row) => `<li class="bill"><span>${escapeHtml(row.name)}</span><span class="bill-amt">${formatMoney(row.cents)}</span></li>`).join('')}
    </ul>
    <p class="hint">${escapeHtml(suggestionNote(result, budget))}</p>
  </section>`
}

function billSection(expenses, today) {
  const sorted = [...expenses].sort((a, b) => {
    const aLeft = a.amount - a.projectedPaid
    const bLeft = b.amount - b.projectedPaid
    if ((aLeft > 0) !== (bLeft > 0)) return aLeft > 0 ? -1 : 1
    const aDue = a.dueDate || '9999-99-99'
    const bDue = b.dueDate || '9999-99-99'
    return aDue < bDue ? -1 : aDue > bDue ? 1 : 0
  })
  const rows = sorted.length
    ? sorted.map((expense) => {
        const left = Math.max(0, expense.amount - expense.projectedPaid)
        const projected = { ...expense, paid: Math.min(expense.amount, expense.projectedPaid) }
        const label = dueLabel(projected, today)
        const past = label.startsWith('Past due')
        const minimum = minimumLabel(expense)
        return `<li class="expense-row">
          <div>
            <div class="bill-title">
              <p class="label">${escapeHtml(expense.name)}</p>
              ${duePicker(expense)}
            </div>
            <p class="meta ${past ? 'is-past' : ''} ${left <= 0 ? 'is-paid' : ''}">${escapeHtml(label)}</p>
            ${minimum ? `<p class="meta">${escapeHtml(minimum)}</p>` : ''}
          </div>
          <span class="expense-amt">${left > 0 ? formatMoney(left) : 'Paid'}</span>
        </li>`
      }).join('')
    : '<li class="empty">No expenses yet. Add them in Edit.</li>'
  return `<div class="expense-list">
    <h2>Expenses</h2>
    <ul>${rows}</ul>
  </div>`
}

function duePicker(expense) {
  return `<label class="cal-btn">
    <input type="date" data-bind="bill-due" data-id="${escapeHtml(expense.id)}" value="${escapeHtml(expense.dueDate || '')}" aria-label="Next due date for ${escapeHtml(expense.name)}" />
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"></rect>
      <path d="M1.5 6h13M5 1.2v2.4M11 1.2v2.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"></path>
    </svg>
  </label>`
}

const DEBT_COLORS = ['#2196f3', '#4caf50']

function debtSection(debts, dissolvingIds, state) {
  const active = debts.filter((debt) => debt.remaining > 0 || dissolvingIds.includes(debt.id))
  const paidOff = debts.filter((debt) => debt.remaining <= 0 && !dissolvingIds.includes(debt.id))
  const cards = active.filter((debt) => debt.kind === 'card' && debt.remaining > 0 && !dissolvingIds.includes(debt.id))
  return `<div class="overview-debts">
    <h2>Debts</h2>
    ${active.length ? debtChart(active, dissolvingIds) : '<p class="empty">No debts to pay down.</p>'}
    ${paidOff.length ? `<p class="meta is-paid">${paidOff.map((debt) => `${escapeHtml(debt.name)} cleared`).join(' · ')}</p>` : ''}
    ${debtUpdate(state, active, cards)}
  </div>`
}

function debtChart(debts, dissolvingIds) {
  const peak = Math.max(...debts.map((debt) => debt.original || 0), 1)
  return `<div class="debt-chart">
    <div class="debt-plot">
      <div class="debt-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="debt-columns">
        ${debts.map((debt, index) => debtColumn(debt, dissolvingIds.includes(debt.id), peak, DEBT_COLORS[index % DEBT_COLORS.length], index, debts.length)).join('')}
      </div>
    </div>
    <div class="debt-labels">
      ${debts.map((debt) => debtLabel(debt)).join('')}
    </div>
  </div>`
}

function debtColumn(debt, dissolving, peak, color, index, count) {
  const original = debt.original || 0
  const remaining = Math.max(0, debt.remaining)
  const projected = Math.max(0, Math.min(remaining, debt.projected ?? remaining))
  const paid = Math.max(0, original - projected)
  const height = original > 0 ? (original / peak) * 86 : 0
  const mark = original > 0 ? (paid / original) * 100 : 0
  const left = formatMoney(projected)
  const started = formatMoney(original)
  const plotBottom = peak > 0 ? (projected / peak) * 86 : 0
  const align = markerAlign(index, count, plotBottom)
  const nudge = markerNudge(mark, plotBottom)
  const ghost = paid > 0 ? `<div class="debt-ghost${projected > 0 ? '' : ' is-empty'}" style="flex:${paid} 1 0"></div>` : ''
  const solid = projected > 0 ? `<div class="debt-solid" style="flex:${projected} 1 0"></div>` : ''
  const card = debt.kind === 'card' && remaining > 0 && !dissolving
  const open = card ? ' type="button" data-action="edit-interest" data-id="' + escapeHtml(debt.id) + '"' : ''
  const label = `${escapeHtml(debt.name)} started at ${escapeHtml(started)} and is at ${escapeHtml(left)}.`
  return `<${card ? 'button' : 'div'} class="debt-col${dissolving ? ' is-dissolving' : ''}${card ? ' is-card' : ''}" style="--bar:${color}"${open} aria-label="${label}${card ? ' Add an interest charge.' : ''}">
    <div class="debt-bar" style="height:${height.toFixed(2)}%">
      <span class="debt-origin">${escapeHtml(started)}</span>
      ${ghost}${solid}
      <span class="debt-now" style="top:${mark.toFixed(2)}%"><i class="debt-now-line"></i></span>
    </div>
    <span class="debt-now-amt align-${align} nudge-${nudge}" style="bottom:${plotBottom.toFixed(2)}%">${escapeHtml(left)}</span>
  </${card ? 'button' : 'div'}>`
}

function markerAlign(index, count, plotBottom) {
  if (index === count - 1 && count > 1) return 'start'
  if (index === 0 || plotBottom < 14) return 'end'
  return 'center'
}

function markerNudge(mark, plotBottom) {
  if (plotBottom < 14) return 'stack'
  if (mark < 18) return 'below'
  if (mark > 82) return 'above'
  return 'center'
}

function debtLabel(debt) {
  const minimum = minimumLabel(debt)
  return `<div class="debt-label">
    <h3>${escapeHtml(debt.name)}</h3>
    ${debt.kind === 'card' ? '<p class="meta">Credit card</p>' : ''}
    ${minimum ? `<p class="meta">${escapeHtml(minimum)}</p>` : ''}
    ${debt.draft ? '<p class="meta">After this check</p>' : ''}
  </div>`
}

function debtUpdate(state, debts, cards) {
  const open = debts.filter((debt) => debt.remaining > 0)
  if (!open.length) return ''
  if (state?.editingInterest === 'choose') return interestChooser(cards.length ? cards : open, cards.length > 0)
  if (state?.editingInterest) return interestPanel(state, open)
  const only = cards.length === 1 ? cards[0].id : ''
  return `<button type="button" class="ghost debt-update" data-action="edit-interest" data-id="${escapeHtml(only)}">Update</button>`
}

function interestChooser(debts, marked) {
  return `<div class="interest-edit">
    <p class="tiny">${marked ? 'Which credit card?' : 'Which debt is the credit card?'}</p>
    <div class="debt-kind">
      ${debts.map((debt) => `<button type="button" class="choice" data-action="edit-interest" data-id="${escapeHtml(debt.id)}">${escapeHtml(debt.name)}</button>`).join('')}
    </div>
    <div class="actions">
      <button type="button" class="ghost" data-action="cancel-interest">Cancel</button>
    </div>
  </div>`
}

function interestPanel(state, debts) {
  const debt = debts.find((item) => item.id === state.editingInterest)
  if (!debt) return ''
  return `<div class="interest-edit">
    <label class="tiny" for="interest-${escapeHtml(debt.id)}">Interest on ${escapeHtml(debt.name)}</label>
    ${moneyField(`interest-${debt.id}`, state.interestDraft, 'interest', debt.id)}
    ${state.interestError ? `<p class="error" role="alert">${escapeHtml(state.interestError)}</p>` : ''}
    <div class="actions">
      <button type="button" class="ghost" data-action="cancel-interest">Cancel</button>
      <button type="button" class="primary" data-action="save-interest">Add interest</button>
    </div>
  </div>`
}

function goalSection(state, spec) {
  const shown = spec.total + spec.draft
  const goalName = spec.kind === 'savings' ? 'savings' : 'investment'
  let caption = `No ${goalName} goal yet. Add one in Edit.`
  if (spec.goal > 0) {
    const pct = Math.min(100, Math.floor((shown / spec.goal) * 100))
    caption = `${formatMoney(shown)} ${spec.noun} · ${pct}% of ${formatMoney(spec.goal)}${spec.draft ? ' after this check' : ''}`
  } else if (shown > 0) {
    caption = `${formatMoney(shown)} ${spec.noun}`
  }
  const chart = spec.goal > 0 ? `<div class="chart">${progressChart(spec.title, spec.goal, shown, spec.color)}</div>` : ''
  return `<div class="goal-block">
    <h2>${spec.title}</h2>
    ${chart}
    <p class="caption">${escapeHtml(caption)}</p>
    ${balanceControl(state, spec)}
  </div>`
}

function balanceControl(state, spec) {
  if (state.budget.draft) return ''
  if (state.editingBalance === spec.kind) {
    const label = spec.kind === 'savings' ? 'Amount saved' : 'Amount invested'
    return `<div class="balance-edit">
      <label class="tiny" for="balance-${spec.kind}">${label}</label>
      ${moneyField(`balance-${spec.kind}`, state.balanceDraft, 'balance', spec.kind)}
      ${state.balanceError ? `<p class="error" role="alert">${escapeHtml(state.balanceError)}</p>` : ''}
      <div class="actions">
        <button type="button" class="ghost" data-action="cancel-balance">Cancel</button>
        <button type="button" class="primary" data-action="save-balance">Save</button>
      </div>
    </div>`
  }
  return `<button type="button" class="ghost balance-update" data-action="edit-balance" data-id="${spec.kind}">Update amount</button>`
}

function progressChart(title, goal, shown, color) {
  const ticks = savingsTicks(goal)
  const width = 640
  const height = 132
  const left = 8
  const right = 8
  const axisY = 64
  const plotW = width - left - right
  const x = (value) => left + (Math.max(0, Math.min(goal, value)) / goal) * plotW
  const marker = Math.min(Math.max(shown, 0), goal)
  const mx = x(marker)
  const ratio = marker / goal
  const anchor = ratio < 0.16 ? 'start' : ratio > 0.84 ? 'end' : 'middle'
  const labelX = anchor === 'start' ? mx : anchor === 'end' ? mx : mx
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)} scale from $0 to ${escapeHtml(formatMoney(goal))}, currently ${escapeHtml(formatMoney(shown))}">
    <line x1="${left}" y1="${axisY}" x2="${width - right}" y2="${axisY}" stroke="#ddd9d2" stroke-width="3" stroke-linecap="round" />
    <line x1="${left}" y1="${axisY}" x2="${mx.toFixed(1)}" y2="${axisY}" stroke="${color}" stroke-width="3" stroke-linecap="round" />
    <circle cx="${mx.toFixed(1)}" cy="${axisY}" r="6" fill="${color}" />
    <text x="${labelX.toFixed(1)}" y="28" text-anchor="${anchor}" fill="${color}" font-size="14" font-weight="600">${escapeHtml(formatMoney(shown))}</text>
    ${ticks.map((value) => {
      const tx = x(value).toFixed(1)
      const tickAnchor = value === 0 ? 'start' : value === goal ? 'end' : 'middle'
      return `<line x1="${tx}" y1="${axisY + 8}" x2="${tx}" y2="${axisY + 14}" stroke="#8a857c" />
        <text x="${tx}" y="${axisY + 32}" text-anchor="${tickAnchor}" fill="#5e5a54" font-size="12">${escapeHtml(compactMoney(value))}</text>`
    }).join('')}
  </svg>`
}

function project(budget, allocations) {
  return {
    debts: budget.debts.map((debt) => ({
      ...debt,
      draft: allocations[debt.id] || 0,
      projected: Math.max(0, debt.remaining - (allocations[debt.id] || 0)),
    })),
    expenses: budget.expenses.map((expense) => ({
      ...expense,
      draft: allocations[expense.id] || 0,
      projectedPaid: expense.paid + (allocations[expense.id] || 0),
    })),
    savingsDraft: allocations.savings || 0,
    investmentDraft: allocations.investments || 0,
  }
}

function parseDraft(budget) {
  const draft = budget.draft
  const paycheck = parseMoney(draft.amount)
  const read = readAllocations(draft.allocations)
  const invalid = paycheck == null || !read.ok
  const allocations = read.ok ? read.allocations : {}
  const assigned = Object.values(allocations).reduce((sum, value) => sum + value, 0)
  const errors = !invalid && paycheck > 0 ? validateAllocations(budget, paycheck, allocations) : []
  return {
    paycheck: paycheck || 0,
    paycheckValid: paycheck != null && paycheck > 0,
    invalid,
    allocations,
    assigned,
    errors,
  }
}

function fundsNote(funds, misc) {
  if (funds < 0) return `That’s ${formatMoney(Math.abs(funds))} more than this paycheck.`
  if (misc <= 0) return 'Anything still here stays unassigned.'
  if (funds < misc) return `Under your ${formatMoney(misc)} everyday buffer by ${formatMoney(misc - funds)}.`
  if (funds === misc) return `That leaves your ${formatMoney(misc)} for everyday spending.`
  return `${formatMoney(misc)} of this is your everyday buffer. ${formatMoney(funds - misc)} is still unassigned.`
}

function debtEditor(debts) {
  return debts.map((debt) => {
    const showDue = String(debt.minimum ?? '').trim() !== '' || Boolean(debt.repeat)
    const kindChoices = `<div class="debt-kind">
        <button type="button" class="choice ${debt.kind === 'card' ? 'is-selected' : ''}" data-action="debt-kind" data-id="${debt.id}" data-value="card">Credit Card</button>
        <button type="button" class="choice ${debt.kind === 'loan' ? 'is-selected' : ''}" data-action="debt-kind" data-id="${debt.id}" data-value="loan">Loan</button>
      </div>`
    return `<div class="editor">
      ${debt.settled ? `<p class="label">${escapeHtml(debt.name)}</p><p class="meta is-paid">Paid off</p>` : `${kindChoices}<div class="row-2">
        <div><label class="tiny" for="debt-name-${debt.id}">Name</label><input id="debt-name-${debt.id}" data-bind="debt-name" data-id="${debt.id}" placeholder="Visa, loan…" value="${escapeHtml(debt.name)}" autocomplete="off" /></div>
        <div><label class="tiny" for="debt-amount-${debt.id}">Still owing</label>${moneyField(`debt-amount-${debt.id}`, debt.amount, 'debt-amount', debt.id)}</div>
      </div>
      <div class="row-amount-date">
        <div><label class="tiny" for="debt-minimum-${debt.id}">Minimum</label>${moneyField(`debt-minimum-${debt.id}`, debt.minimum || '', 'debt-minimum', debt.id)}</div>
        <div><label class="tiny" for="debt-repeat-${debt.id}">Repeats</label>${repeatField(`debt-repeat-${debt.id}`, 'debt-repeat', debt.id, debt.repeat || '', true)}</div>
      </div>
      ${showDue ? `<div class="field"><label class="tiny" for="debt-due-${debt.id}">Minimum due</label><input id="debt-due-${debt.id}" data-bind="debt-due" data-id="${debt.id}" type="date" value="${escapeHtml(debt.dueDate || '')}" /></div>` : ''}`}
      <button type="button" class="text-btn" data-action="remove-debt" data-id="${debt.id}">Remove</button>
    </div>`
  }).join('')
}

function expenseEditor(expenses) {
  return expenses.map((expense) => `<div class="editor">
    ${expense.preset ? `<p class="label">${escapeHtml(expense.name)}</p>` : `<div class="field"><input id="expense-name-${expense.id}" data-bind="expense-name" data-id="${expense.id}" placeholder="Expense name" value="${escapeHtml(expense.name)}" autocomplete="off" /></div>`}
    <div class="row-amount-date">
      <div><label class="tiny" for="expense-amount-${expense.id}">Cost</label>${moneyField(`expense-amount-${expense.id}`, expense.amount, 'expense-amount', expense.id)}</div>
      <div><label class="tiny" for="expense-due-${expense.id}">Next due</label><input id="expense-due-${expense.id}" data-bind="expense-due" data-id="${expense.id}" type="date" value="${escapeHtml(expense.dueDate)}" /></div>
    </div>
    <div class="row-amount-date">
      <div><label class="tiny" for="expense-minimum-${expense.id}">Minimum</label>${moneyField(`expense-minimum-${expense.id}`, expense.minimum || '', 'expense-minimum', expense.id)}</div>
      <div><label class="tiny" for="expense-repeat-${expense.id}">Repeats</label>${repeatField(`expense-repeat-${expense.id}`, 'expense-repeat', expense.id, expense.repeat || 'monthly', false)}</div>
    </div>
    ${expense.preset ? '' : `<button type="button" class="text-btn" data-action="remove-expense" data-id="${expense.id}">Remove</button>`}
  </div>`).join('')
}

function repeatField(id, bind, dataId, value, includeNone) {
  const options = [
    includeNone ? `<option value="" ${value === '' ? 'selected' : ''}>Doesn't repeat</option>` : '',
    `<option value="weekly" ${value === 'weekly' ? 'selected' : ''}>Every week</option>`,
    `<option value="biweekly" ${value === 'biweekly' ? 'selected' : ''}>Every 2 weeks</option>`,
    `<option value="monthly" ${value === 'monthly' ? 'selected' : ''}>Monthly</option>`,
  ].join('')
  return `<select id="${escapeHtml(id)}" data-bind="${bind}" data-id="${escapeHtml(dataId)}">${options}</select>`
}

function choice(value, label, selected) {
  return `<button type="button" class="choice ${selected ? 'is-selected' : ''}" data-action="frequency" data-value="${value}">${label}</button>`
}

function moneyField(id, value, bind, dataId = '') {
  const idAttr = dataId ? ` data-id="${escapeHtml(dataId)}"` : ''
  return `<div class="money-field"><span>$</span><input id="${escapeHtml(id)}" data-bind="${bind}"${idAttr} inputmode="decimal" autocomplete="off" value="${escapeHtml(value)}" /></div>`
}

function brand() {
  return `<header class="topbar">${brandMark()}${desktopActions('')}</header>`
}

function desktopActions(inner) {
  const menu = desktopFileMenu()
  if (!menu && !inner) return ''
  return `<div class="top-actions">${menu}${inner}</div>`
}

function desktopFileMenu() {
  if (!globalThis.simpleBudgetDesktop) return ''
  return `<details class="file-menu">
    <summary class="ghost">File</summary>
    <div class="file-menu-list">
      <button type="button" data-action="backup-budget">Backup Budget</button>
      <button type="button" data-action="import-budget">Import Budget</button>
      <button type="button" data-action="reset">Reset Budget</button>
    </div>
  </details>`
}

function brandMark() {
  return `<div class="brand"><span class="mark" aria-hidden="true"></span><h1>Simple Budget</h1></div>`
}

function errorHtml(message) {
  return message ? `<p class="error" role="alert">${escapeHtml(message)}</p>` : ''
}

function toaster(toasts) {
  if (!toasts.length) return ''
  return `<div class="toaster">${toasts.map((toast) => `<div class="toast" role="status">
    <p>${escapeHtml(toast.message)}</p>
    <button type="button" data-action="dismiss-toast" data-id="${toast.id}">Close</button>
  </div>`).join('')}</div>`
}

function confetti() {
  const colors = ['#1b1b1b', '#0f7a45', '#c4552a', '#e2d3a8', '#f4f1ea']
  const pieces = Array.from({ length: 46 }, (_, index) => {
    const left = (index * 37) % 100
    const delay = ((index % 8) * 0.07).toFixed(2)
    const duration = (1.7 + (index % 5) * 0.16).toFixed(2)
    const color = colors[index % colors.length]
    const size = index % 3 === 0 ? 12 : 8
    return `<i style="left:${left}%;background:${color};width:${size}px;animation-delay:${delay}s;animation-duration:${duration}s"></i>`
  }).join('')
  return `<div class="confetti" aria-hidden="true">${pieces}</div>`
}
