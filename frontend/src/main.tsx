import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ToastProvider } from './components/ui/Toast'
import { ThemeProvider } from './hooks/ThemeContext'
import './index.css'

// Set the theme attribute before React mounts so light-mode users don't see
// a flash of the dark theme on load.
try {
  if (localStorage.getItem('goat_theme') === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  }
} catch { /* ignore */ }

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
