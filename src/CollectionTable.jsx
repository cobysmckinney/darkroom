import React from 'react'
import { ArrowRight } from 'lucide-react'
import { displayDate } from './format.js'

export default function CollectionTable({ page, items, onOpen }) {
  const headings = { Projects: ['PROJECT', 'CLIENT', 'DATE', 'STATUS'], Clients: ['CLIENT', 'EMAIL', 'PHONE', 'PROJECTS'], Galleries: ['GALLERY', 'CLIENT', 'PHOTOS', 'STATUS'], Invoices: ['INVOICE', 'CLIENT', 'AMOUNT', 'STATUS'], Contracts: ['CONTRACT', 'CLIENT', 'SENT', 'STATUS'], Email: ['SUBJECT', 'RECIPIENT', 'DATE', 'STATUS'], Templates: ['TEMPLATE', 'TYPE', 'CREATED', 'SCOPE'] }
  const cells = (item) => {
    if (page === 'Projects') return [item.name, item.client, displayDate(item.date), item.status]
    if (page === 'Clients') return [item.name, item.email, item.phone, `${item.projects} project${item.projects === 1 ? '' : 's'}`]
    if (page === 'Galleries') return [item.title, item.client, `${item.count} photos`, item.status]
    if (page === 'Invoices') return [item.title, item.client, item.amount, item.status]
    if (page === 'Contracts') return [item.title, item.client, item.sent, item.status]
    if (page === 'Templates') return [item.title, item.type, item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—', 'General']
    return [item.subject, item.recipient, item.date, item.status]
  }
  return <div className="table-scroll"><table className="collection-table"><thead><tr>{headings[page].map(h => <th key={h}>{h}</th>)}<th className="align-right">&nbsp;</th></tr></thead><tbody>{items.length ? items.map(item => <tr key={item.id} onClick={() => onOpen(item)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen(item)}>{cells(item).map((cell, index) => <td key={index} data-label={headings[page][index]} className={index === 0 ? 'item-title' : ''}>{cell}</td>)}<td className="align-right"><ArrowRight size={17}/></td></tr>) : <tr><td colSpan={5} className="empty">No matching {page.toLowerCase()} found.</td></tr>}</tbody></table></div>
}
