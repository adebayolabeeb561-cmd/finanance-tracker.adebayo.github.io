// ---------- 1. Settings that describe the app's data ----------
// Categories depend on the type: income and expense offer different choices.
// Each entry is [value stored in the transaction, label shown to the user].
const CATEGORIES = {
  income: [["salary", "Salary"], ["freelance", "Freelance"], ["other-income", "Other income"]],
  expense: [["food", "Food"], ["transport", "Transport"], ["data", "Data"],
            ["bills", "Bills"], ["shopping", "Shopping"], ["others", "Others"]],
}
const ICONS = { salary: "💼", freelance: "💻", "other-income": "💰", food: "🍴",
                transport: "🚌", data: "📶", bills: "⚡", shopping: "🛍", others: "📦" }
const COLORS = { food: "#f59e0b", transport: "#3b82f6", data: "#22c55e",
                 bills: "#f87171", shopping: "#a855f7", others: "#94a3b8" }

// ---------- 2. Page elements ----------
const $ = function (id) { return document.getElementById(id) } // short helper: less repeated typing
const formEl = $("additional"), descriptionInEl = $("descriptionIn"), amountEl = $("input")
const categoryEl = $("category"), filterEl = $("filter"), errorEl = $("error")
const listEl = $("transactionList"), emptyEl = $("emptyMessage"), toggleEl = $("typeToggle")

// ---------- 3. State ----------
// `transactions` is the single source of truth: everything on screen is
// calculated from it. selectedType remembers which toggle button is active.
const STORAGE_KEY = "financeTrackerTransactions"
let transactions = loadTransactions()
let selectedType = "income"

// localStorage stores only strings: JSON.stringify array -> string, JSON.parse string -> array.
function saveTransactions() { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)) }
// Called once at startup, BEFORE any save, so a refresh never overwrites saved data with [].
function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(saved) ? saved : []
  } catch (error) { return [] }
}

// ---------- 4. Helpers reused in many places ----------
function formatMoney(n) { return "₦" + n.toLocaleString("en-NG") }
function formatDate(t) { // older saved items have no date, so fall back to a dash
  return t.date ? new Date(t.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"
}
function getTotal(type) { // filter keeps one type, reduce adds the amounts up
  return transactions.filter(function (t) { return t.type === type })
    .reduce(function (sum, t) { return sum + t.amount }, 0)
}
function label(value) { // "other-income" -> "Other income", looked up from CATEGORIES
  const all = CATEGORIES.income.concat(CATEGORIES.expense)
  const found = all.find(function (pair) { return pair[0] === value })
  return found ? found[1] : value
}

// ---------- 5. Dropdowns ----------
// Fills a <select> from a list of [value, label] pairs. Reused by the form and the filter.
function fillSelect(selectEl, pairs) {
  selectEl.innerHTML = ""
  pairs.forEach(function (pair) {
    const option = document.createElement("option")
    option.value = pair[0]
    option.textContent = pair[1]
    selectEl.appendChild(option)
  })
}

// ---------- 6. Drawing each part of the page from the array ----------
function renderHeader() {
  const hour = new Date().getHours()
  $("greeting").textContent = (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening") + ", Adebayo"
  $("today").textContent = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
}

function renderSummary() {
  const income = getTotal("income"), expenses = getTotal("expense")
  $("incomeAmount").textContent = formatMoney(income)
  $("expenseAmount").textContent = formatMoney(expenses)
  $("balanceAmount").textContent = formatMoney(income - expenses) // balance = income - expenses
  const now = new Date()
  const thisMonth = transactions.filter(function (t) {
    const d = t.date ? new Date(t.date) : now // old items without a date count as this month
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  $("transact").textContent = thisMonth + (thisMonth === 1 ? " transaction" : " transactions")
}

function renderTransactions() {
  listEl.innerHTML = "" // clear then rebuild: duplicates are impossible
  const shown = transactions.filter(function (t) { return filterEl.value === "all" || t.category === filterEl.value })
  emptyEl.hidden = shown.length > 0
  shown.slice().reverse().forEach(function (t) { // slice() copies so reverse() doesn't change the real array
    const row = document.createElement("tr")
    // textContent (not innerHTML) so typed text can never run as HTML
    function cell(text, cls) {
      const td = document.createElement("td")
      td.textContent = text
      if (cls) td.className = cls
      row.appendChild(td)
      return td
    }
    cell(formatDate(t))
    cell((ICONS[t.category] || "") + " " + t.description)
    cell(label(t.category))
    const badge = document.createElement("span")
    badge.className = "badge " + t.type
    badge.textContent = t.type === "income" ? "Income" : "Expense"
    cell("").appendChild(badge)
    cell((t.type === "income" ? "+" : "-") + formatMoney(t.amount), t.type) // sign + colour: not colour-only
    const del = document.createElement("button")
    del.type = "button"; del.className = "del"; del.textContent = "🗑"
    del.setAttribute("aria-label", "Delete " + t.description)
    del.dataset.id = t.id // the unique id tells us WHICH transaction to delete
    cell("").appendChild(del)
    listEl.appendChild(row)
  })
}

function renderDonut() {
  const spent = {} // e.g. { food: 15000, transport: 5000 }
  transactions.filter(function (t) { return t.type === "expense" }).forEach(function (t) {
    spent[t.category] = (spent[t.category] || 0) + t.amount
  })
  const total = getTotal("expense")
  $("donutTotal").textContent = formatMoney(total)
  const legend = $("spendingTotal")
  legend.innerHTML = ""
  let start = 0, stops = []
  Object.keys(spent).forEach(function (cat) {
    const pct = (spent[cat] / total) * 100
    stops.push((COLORS[cat] || "#94a3b8") + " " + start + "% " + (start + pct) + "%") // one coloured slice
    start += pct
    const li = document.createElement("li")
    li.textContent = label(cat) + "  " + Math.round(pct) + "%"
    li.style.borderLeft = "4px solid " + (COLORS[cat] || "#94a3b8")
    li.style.paddingLeft = "8px"
    legend.appendChild(li)
  })
  // conic-gradient paints the slices around a circle; with no data we keep the grey default
  $("donut").style.background = total > 0 ? "conic-gradient(" + stops.join(",") + ")" : ""
}

// Totals per day for the last 7 days, oldest first.
function dailyTotals(type) {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const day = new Date()
    day.setDate(day.getDate() - i)
    days.push(transactions.filter(function (t) {
      return t.type === type && t.date && new Date(t.date).toDateString() === day.toDateString()
    }).reduce(function (sum, t) { return sum + t.amount }, 0))
  }
  return days
}
function renderChart() {
  const inc = dailyTotals("income"), exp = dailyTotals("expense")
  const max = Math.max(1, ...inc, ...exp) // at least 1 so we never divide by zero
  // Turn each value into an x,y point: x spreads over the width, y flips because SVG's 0 is the TOP.
  function line(values, colour) {
    const pts = values.map(function (v, i) { return Math.round(i * (380 / 6) + 10) + "," + Math.round(150 - (v / max) * 130) })
    return '<polyline fill="none" stroke="' + colour + '" stroke-width="3" points="' + pts.join(" ") + '"/>'
  }
  $("lineChart").innerHTML = '<line x1="10" y1="150" x2="390" y2="150" stroke="#1c2a40"/>' + line(inc, "#22c55e") + line(exp, "#ef4444")
}

function render() { // one function redraws everything, so the page can never disagree with the data
  renderSummary(); renderTransactions(); renderDonut(); renderChart()
}

// ---------- 7. Toggle + dropdowns ----------
toggleEl.addEventListener("click", function (event) {
  const btn = event.target.closest("button")
  if (!btn) return
  selectedType = btn.dataset.type
  toggleEl.querySelectorAll("button").forEach(function (b) {
    const active = b === btn
    b.classList.toggle("on", active)
    b.setAttribute("aria-pressed", active)
  })
  fillSelect(categoryEl, CATEGORIES[selectedType]) // categories change with the type
})

// ---------- 8. Adding ----------
formEl.addEventListener("submit", function (event) {
  event.preventDefault() // stop the browser reloading the page
  const description = descriptionInEl.value.trim()
  const amount = Number(amountEl.value)
  // Validate BEFORE touching the array so bad input is never stored
  if (description === "" && amountEl.value === "") { errorEl.textContent = "Enter a description and an amount"; return }
  if (description === "") { errorEl.textContent = "Enter a description"; return }
  if (amountEl.value === "" || !Number.isFinite(amount) || amount <= 0) { errorEl.textContent = "Enter an amount greater than zero"; return }

  transactions.push({
    id: Date.now(), // unique id, used later to delete exactly this item
    description: description,
    type: selectedType,
    category: categoryEl.value, // the selected category goes straight into the object
    amount: amount,
    date: new Date().toISOString(), // a text date that JSON can save
  })
  saveTransactions()
  render()
  descriptionInEl.value = ""; amountEl.value = ""; errorEl.textContent = "" // empty fields also block double-submits
  descriptionInEl.focus()
})

// ---------- 9. Deleting ----------
// EVENT DELEGATION: one listener on the table body. Rows are rebuilt on every render,
// so per-button listeners would pile up and double-count. Clicks bubble up to here.
listEl.addEventListener("click", function (event) {
  const btn = event.target.closest(".del")
  if (!btn) return
  const id = Number(btn.dataset.id)
  transactions = transactions.filter(function (t) { return t.id !== id }) // keep everything EXCEPT this id
  saveTransactions()
  render() // the page only changes when we redraw from the smaller array
})

filterEl.addEventListener("change", renderTransactions)

// ---------- 10. Start-up ----------
fillSelect(categoryEl, CATEGORIES.income)
fillSelect(filterEl, [["all", "All Categories"]].concat(CATEGORIES.income, CATEGORIES.expense))
renderHeader()
render()
