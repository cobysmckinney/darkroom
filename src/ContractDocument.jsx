import React from 'react'

function renderNodes(nodes) {
  return (nodes || []).map((node, index) => {
    const key = `${node.type}-${index}`
    if (node.type === 'text') {
      let content = node.text || ''
      if (node.marks?.some(mark => mark.type === 'bold')) content = <strong>{content}</strong>
      if (node.marks?.some(mark => mark.type === 'italic')) content = <em>{content}</em>
      return <React.Fragment key={key}>{content}</React.Fragment>
    }
    if (node.type === 'hardBreak') return <br key={key}/>
    const children = renderNodes(node.content)
    if (node.type === 'paragraph') return <p key={key}>{children}</p>
    if (node.type === 'heading') return node.attrs?.level === 3 ? <h3 key={key}>{children}</h3> : <h2 key={key}>{children}</h2>
    if (node.type === 'bulletList') return <ul key={key}>{children}</ul>
    if (node.type === 'orderedList') return <ol key={key}>{children}</ol>
    if (node.type === 'listItem') return <li key={key}>{children}</li>
    if (node.type === 'blockquote') return <blockquote key={key}>{children}</blockquote>
    return <React.Fragment key={key}>{children}</React.Fragment>
  })
}

export default function ContractDocument({ content, legacyTerms, emptyText = 'Services and deliverables will be confirmed by the photographer and client.' }) {
  return <div className="contract-document">{content?.content ? renderNodes(content.content) : <p>{legacyTerms || emptyText}</p>}</div>
}
