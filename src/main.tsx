import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import './index.css'

const PRELOAD_RELOAD_KEY = 'sdmo:preload-error-reloaded'

window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()

    if (sessionStorage.getItem(PRELOAD_RELOAD_KEY) === 'true') {
        return
    }

    sessionStorage.setItem(PRELOAD_RELOAD_KEY, 'true')
    window.location.reload()
})

window.addEventListener('load', () => {
    window.setTimeout(() => {
        sessionStorage.removeItem(PRELOAD_RELOAD_KEY)
    }, 1000)
})

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-v2">
                    <App />
                </ThemeProvider>
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>,
)
