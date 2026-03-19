import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles/globals.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

registerSW({ immediate: true })

createRoot(root).render(
  <BrowserRouter>
    <LanguageProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LanguageProvider>
  </BrowserRouter>
)
