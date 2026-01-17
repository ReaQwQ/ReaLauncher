import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { useUIStore } from './stores/uiStore'
import './styles/index.css'
const t = useUIStore.getState().t
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 1000 * 60 * 5, // 5 minutes
        },
    },
})

const root = ReactDOM.createRoot(document.getElementById('root')!);
const renderApp = () => {
    root.render(
        <React.StrictMode>
            <QueryClientProvider client={queryClient}>
                <App />
            </QueryClientProvider>
        </React.StrictMode>
    );
};
let retryCount = 0;
const maxRetries = 200; // Wait up to 1 second (100 * 10ms)

const checkElectronAPI = setInterval(() => {
    retryCount++;
    if (window.electronAPI) {
        clearInterval(checkElectronAPI);
        renderApp();
    } else if (retryCount >= maxRetries) {
        clearInterval(checkElectronAPI);
        root.render(
            <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
                    <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-black text-white mb-4 tracking-tight">{t('app.denied.title')}</h1>
                <p className="text-dark-400 max-w-md mx-auto mb-8 font-medium">
                    {t('app.denied.desc')}
                </p>
                <div className="px-4 py-2 rounded-lg bg-dark-900 border border-white/5 text-dark-500 text-xs font-mono">
                    {t('app.denied.code')}
                </div>
            </div>
        );
    }
}, 10);