import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import SharedGallery from './SharedGallery.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(window.location.pathname.startsWith('/share/') ? <SharedGallery /> : <App />)
