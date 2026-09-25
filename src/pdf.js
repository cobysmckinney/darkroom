const ink = { r: 0.13, g: 0.14, b: 0.13 }
const muted = { r: 0.43, g: 0.44, b: 0.41 }
const olive = { r: 0.47, g: 0.46, b: 0.35 }
const printable = value => String(value ?? '').replace(/[\u0000-\u0008\u000B-\u001F]/g, '')
const dateText = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : value || 'Not set'
const money = (value, currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(Number(value) || 0)

export function documentFilename(type, item) {
  const base = type === 'Invoices' ? item.title : `${item.client}-${item.title}`
  return `${String(base).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`
}

function documentBlocks(document, legacyTerms) {
  if (!document?.content) return [{ type: 'paragraph', runs: [{ text: legacyTerms || 'Services and deliverables will be confirmed by the photographer and client.' }] }]
  const blocks = []
  const walk = (nodes, prefix = '') => {
    for (const node of nodes || []) {
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        ;(node.content || []).forEach((item, index) => walk(item.content, node.type === 'orderedList' ? `${index + 1}. ` : '• '))
      } else if (node.type === 'paragraph' || node.type === 'heading') {
        const collect = children => (children || []).flatMap(child => child.type === 'text' ? [{ text: child.text || '', bold: child.marks?.some(mark => mark.type === 'bold'), italic: child.marks?.some(mark => mark.type === 'italic') }] : child.type === 'hardBreak' ? [{ text: '\n' }] : collect(child.content))
        blocks.push({ type: node.type, level: node.attrs?.level || 2, runs: [{ text: prefix }, ...collect(node.content)] })
      } else if (node.content) walk(node.content, prefix)
    }
  }
  walk(document.content)
  return blocks
}

export async function generateDocumentPdf(type, item, studioName = 'Studio', settings = {}) {
  const [{ PDFDocument, rgb }, { default: fontkit }] = await Promise.all([import('pdf-lib'), import('@pdf-lib/fontkit')])
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const [regularBytes, boldBytes, italicBytes, boldItalicBytes] = await Promise.all(['Regular', 'Bold', 'Italic', 'BoldItalic'].map(style => fetch(`/fonts/NotoSans-${style}.ttf`).then(response => response.arrayBuffer())))
  const regular = await pdf.embedFont(regularBytes)
  const bold = await pdf.embedFont(boldBytes)
  const italic = await pdf.embedFont(italicBytes)
  const boldItalic = await pdf.embedFont(boldItalicBytes)
  const color = tone => rgb(tone.r, tone.g, tone.b)
  let page = pdf.addPage([612, 792])
  let y = 740
  const text = (value, x, posY, size = 10, font = regular, tone = ink) => page.drawText(printable(value), { x, y: posY, size, font, color: color(tone) })
  const line = posY => page.drawLine({ start: { x: 48, y: posY }, end: { x: 564, y: posY }, thickness: .7, color: rgb(.82, .82, .79) })
  const nextPage = () => { page = pdf.addPage([612, 792]); y = 710; text(studioName.slice(0, 35), 48, 745, 15, bold); line(725) }
  const ensure = height => { if (y - height < 100) nextPage() }
  const wrap = (value, width, size = 10, font = regular) => {
    const lines = []
    for (const paragraph of printable(value).split('\n')) {
      let current = ''
      for (const word of paragraph.split(/\s+/)) {
        const candidate = current ? `${current} ${word}` : word
        if (font.widthOfTextAtSize(candidate, size) > width && current) { lines.push(current); current = word } else current = candidate
      }
      lines.push(current || ' ')
    }
    return lines
  }
  const block = (value, x = 48, width = 516, size = 10, leading = 16, font = regular, tone = ink) => {
    for (const entry of wrap(value, width, size, font)) { ensure(leading); text(entry, x, y, size, font, tone); y -= leading }
  }
  const richBlock = (runs, size = 10, leading = 16, heading = false) => {
    let x = 48
    ensure(leading)
    for (const run of runs) {
      const font = heading ? bold : run.bold && run.italic ? boldItalic : run.bold ? bold : run.italic ? italic : regular
      for (const part of printable(run.text).split(/(\s+)/)) {
        if (!part) continue
        if (part.includes('\n')) { y -= leading; x = 48; ensure(leading); continue }
        const width = font.widthOfTextAtSize(part, size)
        if (x > 48 && x + width > 558 && part.trim()) { y -= leading; x = 48; ensure(leading) }
        if (!part.trim() && x === 48) continue
        text(part, x, y, size, font)
        x += width
      }
    }
    y -= leading
  }
  text(studioName.slice(0, 38), 48, 740, 24, bold)
  text(type === 'Invoices' ? 'INVOICE' : 'AGREEMENT', 480, 740, 10, bold, olive)
  y = 712
  for (const value of [settings.businessAddress, settings.businessEmail, settings.phone, settings.website, settings.taxId ? `Tax ID: ${settings.taxId}` : ''].filter(Boolean)) block(value, 48, 320, 9, 13, regular, muted)
  y -= 11; line(y); y -= 37
  block(item.title, 48, 510, 22, 29, bold)
  y -= 9
  text(type === 'Invoices' ? 'BILL TO' : 'PREPARED FOR', 48, y, 9, bold, olive)
  text(type === 'Invoices' ? 'ISSUED / DUE' : 'EVENT DATE', 385, y, 9, bold, olive)
  y -= 21
  text(item.client || '', 48, y, 11, bold)
  text(type === 'Invoices' ? `${dateText(item.issued)} / ${dateText(item.due)}` : dateText(item.eventDate), 385, y, 9)
  y -= 18
  if (item.email) { text(item.email, 48, y, 9, regular, muted); y -= 16 }
  if (item.clientAddress) { block(item.clientAddress, 48, 310, 9, 14, regular, muted) }
  y -= 16; line(y); y -= 29

  if (type === 'Invoices') {
    const currency = item.currency || settings.currency || 'USD'
    const items = item.lineItems?.length ? item.lineItems : [{ description: item.service || 'Photography services', quantity: 1, unitPrice: Number(String(item.amount || '0').replace(/[^\d.]/g, '')) }]
    text('DESCRIPTION', 48, y, 9, bold, olive); text('QTY', 393, y, 9, bold, olive); text('RATE', 445, y, 9, bold, olive); text('TOTAL', 520, y, 9, bold, olive)
    y -= 18; line(y); y -= 22
    let subtotal = 0
    for (const row of items) {
      const quantity = Number(row.quantity) || 0, unitPrice = Number(row.unitPrice) || 0
      const amount = quantity * unitPrice; subtotal += amount
      const lines = wrap(row.description, 310, 10)
      ensure(Math.max(31, lines.length * 15 + 12))
      const startY = y
      lines.forEach(entry => { text(entry, 48, y, 10); y -= 15 })
      text(String(quantity), 393, startY, 9)
      text(money(unitPrice, currency), 445, startY, 9)
      text(money(amount, currency), 520, startY, 9, bold)
      y -= 13; line(y); y -= 20
    }
    const discount = Number(item.discount) || 0
    const tax = Math.max(0, subtotal - discount) * (Number(item.taxRate) || 0) / 100
    const total = Math.max(0, subtotal - discount + tax)
    for (const [label, value] of [['Subtotal', subtotal], ['Discount', -discount], [`Tax (${Number(item.taxRate) || 0}%)`, tax], ['Total', total], ['Paid', -(Number(item.amountPaid) || 0)]]) {
      ensure(23); text(label, 403, y, 10, label === 'Total' ? bold : regular); text(money(value, currency), 490, y, 10, label === 'Total' ? bold : regular); y -= 22
    }
    ensure(40); line(y + 3); y -= 23; text('BALANCE DUE', 376, y, 11, bold, olive); text(money(Math.max(0, total - (Number(item.amountPaid) || 0)), currency), 485, y, 13, bold); y -= 35
    for (const [label, value] of [['PAYMENT TERMS', item.paymentTerms || settings.paymentTerms], ['NOTES', item.notes || settings.invoiceNotes]]) {
      if (!value) continue
      ensure(45); text(label, 48, y, 9, bold, olive); y -= 20; block(value); y -= 12
    }
  } else {
    text('SERVICES', 48, y, 9, bold, olive); y -= 20; block(item.service || 'Photography services'); y -= 10
    ensure(40); text('FEE', 48, y, 9, bold, olive); y -= 20; text(item.fee ? money(item.fee, settings.currency || 'USD') : 'To be agreed', 48, y, 11, bold); y -= 36
    ensure(40); text('AGREEMENT', 48, y, 9, bold, olive); y -= 26
    for (const section of documentBlocks(item.document, item.terms)) {
      const heading = section.type === 'heading'
      const size = heading ? section.level === 2 ? 15 : 13 : 10
      ensure(heading ? 34 : 23)
      richBlock(section.runs || [{ text: ' ' }], size, heading ? 21 : 16, heading)
      y -= heading ? 12 : 9
    }
    ensure(145); y -= 30; line(y); line(y - 50)
    text('CLIENT SIGNATURE', 48, y - 14, 8, bold, muted); text('PHOTOGRAPHER SIGNATURE', 315, y - 14, 8, bold, muted)
    text('DATE', 48, y - 64, 8, bold, muted); text('DATE', 315, y - 64, 8, bold, muted)
  }
  pdf.getPages().forEach((current, index, pages) => {
    current.drawLine({ start: { x: 48, y: 73 }, end: { x: 564, y: 73 }, thickness: .7, color: rgb(.82, .82, .79) })
    current.drawText(`${printable(studioName).toUpperCase().slice(0, 38)}  /  ${type === 'Invoices' ? 'INVOICE' : 'AGREEMENT'}`, { x: 48, y: 55, size: 8, font: bold, color: color(muted) })
    current.drawText(`${index + 1} / ${pages.length}`, { x: 535, y: 55, size: 8, font: regular, color: color(muted) })
  })
  return pdf.save()
}

export async function downloadDocument(type, item, studioName, settings) {
  const bytes = await generateDocumentPdf(type, item, studioName, settings)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = documentFilename(type, item); anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function pdfAttachment(type, item, studioName, settings) {
  const bytes = await generateDocumentPdf(type, item, studioName, settings)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return { filename: documentFilename(type, item), content: btoa(binary), contentType: 'application/pdf' }
}
