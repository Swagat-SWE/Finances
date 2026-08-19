const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const hiddenCurrency = '$••••••'

// Financial amounts are private by default for every new login/page session.
// The toggle still updates this in-memory value immediately, but we intentionally
// do not persist an "unhidden" choice so a later login starts protected again.
let numbersHidden = true

export function areNumbersHidden() {
  return numbersHidden
}

export function setNumbersHidden(hidden: boolean) {
  numbersHidden = hidden
}

export function formatMoney(value: number) {
  return numbersHidden ? hiddenCurrency : currency.format(value)
}
