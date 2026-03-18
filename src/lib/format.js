export function formatCurrency(amount){
  const num = Number(amount || 0)
  const formatted = num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `Php ${formatted}`
}
