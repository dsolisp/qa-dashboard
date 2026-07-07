import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

// Apply saved theme before first paint to avoid flash
;(function () {
  try {
    const t = localStorage.getItem('qa-dashboard-theme')
    document.documentElement.dataset.theme = t === 'dark' ? 'dark' : 'light'
  } catch {}
})()

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
