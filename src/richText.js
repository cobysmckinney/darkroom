const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

export function plainText(document) {
  if (!document?.content) return ''
  const walk = nodes => (nodes || []).map(node => {
    if (node.type === 'text') return node.text || ''
    if (node.type === 'hardBreak') return '\n'
    if (node.type === 'bulletList') return (node.content || []).map(child => `• ${walk(child.content)}`).join('\n') + '\n'
    if (node.type === 'orderedList') return (node.content || []).map((child, index) => `${index + 1}. ${walk(child.content)}`).join('\n') + '\n'
    return walk(node.content) + (['paragraph', 'heading', 'blockquote'].includes(node.type) ? '\n\n' : '')
  }).join('')
  return walk(document.content).trim()
}

export function emailHtml(document) {
  if (!document?.content) return ''
  const walk = nodes => (nodes || []).map(node => {
    if (node.type === 'text') {
      let value = escape(node.text)
      if (node.marks?.some(mark => mark.type === 'bold')) value = `<strong>${value}</strong>`
      if (node.marks?.some(mark => mark.type === 'italic')) value = `<em>${value}</em>`
      return value
    }
    if (node.type === 'hardBreak') return '<br>'
    const children = walk(node.content)
    if (node.type === 'paragraph') return `<p>${children || '&nbsp;'}</p>`
    if (node.type === 'heading') return `<h${node.attrs?.level === 3 ? 3 : 2}>${children}</h${node.attrs?.level === 3 ? 3 : 2}>`
    if (node.type === 'bulletList') return `<ul>${children}</ul>`
    if (node.type === 'orderedList') return `<ol>${children}</ol>`
    if (node.type === 'listItem') return `<li>${children}</li>`
    if (node.type === 'blockquote') return `<blockquote>${children}</blockquote>`
    return children
  }).join('')
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#242724">${walk(document.content)}</div>`
}

export function textDocument(value) {
  return { type: 'doc', content: String(value || '').split(/\n\n+/).map(paragraph => paragraph ? { type: 'paragraph', content: [{ type: 'text', text: paragraph }] } : { type: 'paragraph' }) }
}

export function normalizeDocument(document) {
  if (!document || typeof document !== 'object') return { type: 'doc', content: [{ type: 'paragraph' }] }
  const clean = node => {
    if (node.type === 'text') return node.text ? node : null
    const content = node.content?.map(clean).filter(Boolean)
    return content?.length ? { ...node, content } : { ...node, content: undefined }
  }
  const normalized = clean(document)
  return normalized.type === 'doc' && !normalized.content?.length ? { ...normalized, content: [{ type: 'paragraph' }] } : normalized
}
