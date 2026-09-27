// Shared by the browser (editor, detail, PDF) and the server (online payments), so every place agrees on the balance.
const roundCents = value => Math.round((Number(value) || 0) * 100) / 100
const legacyAmount = amount => Number(String(amount || '0').replace(/[^\d.]/g, '')) || 0

export const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value) || 0)

export function invoiceLines(invoice) {
  if (invoice?.lineItems?.length) return invoice.lineItems
  return [{ description: invoice?.service || 'Photography services', quantity: 1, unitPrice: legacyAmount(invoice?.amount) }]
}

export function invoiceTotals(invoice, fallbackCurrency = 'USD') {
  const currency = invoice?.currency || fallbackCurrency
  const lines = invoiceLines(invoice)
  const subtotal = roundCents(lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0))
  const discount = roundCents(invoice?.discount)
  const taxRate = Number(invoice?.taxRate) || 0
  const tax = roundCents(Math.max(0, subtotal - discount) * taxRate / 100)
  const total = roundCents(Math.max(0, subtotal - discount + tax))
  const manualPaid = roundCents(invoice?.amountPaid)
  const onlinePaid = roundCents((invoice?.onlinePayments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0))
  const paid = roundCents(manualPaid + onlinePaid)
  return { currency, lines, subtotal, discount, taxRate, tax, total, manualPaid, onlinePaid, paid, balance: roundCents(Math.max(0, total - paid)) }
}
