import React, { useMemo } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Heading2, Italic, List, ListOrdered, Redo2, Undo2 } from 'lucide-react'
import { normalizeDocument } from './richText.js'

export default function RichTextEditor({ initial, onChange, minHeight = 250 }) {
  const content = useMemo(() => normalizeDocument(initial), [initial])
  const editor = useEditor({ extensions: [StarterKit], content, onUpdate: ({ editor }) => onChange(editor.getJSON()) })
  const commands = editor ? [
    ['Heading', Heading2, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'heading'],
    ['Bold', Bold, () => editor.chain().focus().toggleBold().run(), 'bold'],
    ['Italic', Italic, () => editor.chain().focus().toggleItalic().run(), 'italic'],
    ['Bulleted list', List, () => editor.chain().focus().toggleBulletList().run(), 'bulletList'],
    ['Numbered list', ListOrdered, () => editor.chain().focus().toggleOrderedList().run(), 'orderedList'],
    ['Undo', Undo2, () => editor.chain().focus().undo().run(), null],
    ['Redo', Redo2, () => editor.chain().focus().redo().run(), null],
  ] : []
  return <div className="rich-editor"><div className="rich-toolbar">{commands.map(([label, Icon, action, mark]) => <button type="button" key={label} title={label} aria-label={label} className={mark && editor.isActive(mark) ? 'active' : ''} onClick={action}><Icon size={17}/></button>)}</div><div style={{ '--editor-min-height': `${minHeight}px` }}><EditorContent editor={editor}/></div></div>
}
