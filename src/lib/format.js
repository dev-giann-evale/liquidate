export function formatCurrency(amount, locale = 'en-US', currency = 'USD'){
  const num = Number(amount || 0)
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(num)
}
