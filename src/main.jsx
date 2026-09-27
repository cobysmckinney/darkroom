import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import SharedGallery from './SharedGallery.jsx'
import SignContract from './SignContract.jsx'
import PayInvoice from './PayInvoice.jsx'
import './styles.css'

const publicPages = { share: SharedGallery, sign: SignContract, pay: PayInvoice }
const Page = publicPages[window.location.pathname.split('/')[1]] || App

createRoot(document.getElementById('root')).render(<Page />)
