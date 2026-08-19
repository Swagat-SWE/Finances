const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const hiddenCurrency = '$••••••'

let numbersHidden = typeof window !== 'undefined' && window.localStorage.getItem('finances.hideNumbers') === 'true'

export function areNumbersHidden() {
  return numbersHidden
}

export function setNumbersHidden(hidden: boolean) {
  numbersHidden = hidden
  if (typeof window !== 'undefined') window.localStorage.setItem('finances.hideNumbers', String(hidden))
}

export function formatMoney(value: number) {
  return numbersHidden ? hiddenCurrency : currency.format(value)
}
