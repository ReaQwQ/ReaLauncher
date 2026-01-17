import { ReactNode, useEffect } from 'react'
import Titlebar from './Titlebar'
import Sidebar from './Sidebar'
import DeviceCodeModal from '../modals/DeviceCodeModal'

import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import { useLogListener } from '../../hooks/useLogListener'
import NotificationContainer from '../ui/NotificationContainer'
import bgImage from '../../assets/bg.png'

interface LayoutProps {
    children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
    const { setDeviceCode } = useAuthStore()
    const {
        incrementRunningInstances,
        decrementRunningInstances,
        font,
        theme,
        mode
    } = useUIStore()

    // Apply Appearance Settings
    useEffect(() => {
        const root = document.documentElement
        root.setAttribute('data-theme', theme)
        root.setAttribute('data-font', font)

        if (mode === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            root.setAttribute('data-mode', isDark ? 'dark' : 'light')
        } else {
            root.setAttribute('data-mode', mode)
        }
    }, [theme, font, mode])

    // Listen for logs from Electron
    useLogListener()

    useEffect(() => {
        const unsubscribeDeviceCode = window.electronAPI.auth.onDeviceCode((data) => {
            setDeviceCode(data)
        })

        const unsubscribeGameStarted = window.electronAPI.eml.onGameStarted(() => {
            incrementRunningInstances()
        })

        const unsubscribeGameClosed = window.electronAPI.eml.onGameClosed(() => {
            decrementRunningInstances()
        })

        return () => {
            unsubscribeDeviceCode()
            unsubscribeGameStarted()
            unsubscribeGameClosed()
        }
    }, [setDeviceCode, incrementRunningInstances, decrementRunningInstances])

    return (
        <div className="h-screen flex flex-col overflow-hidden relative">
            {/* Background Image - Clear */}
            <div className="fixed inset-0 z-[-1] overflow-hidden">
                <img
                    src={bgImage}
                    className="w-full h-full object-cover opacity-60"
                    alt="background"
                />
                <div className="absolute inset-0 bg-dark-950/70" />
            </div>

            <Titlebar />
            <div className="flex-1 flex overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-auto p-6">
                    {children}
                </main>
            </div>
            <NotificationContainer />
            <DeviceCodeModal />
            <NotificationContainer />
            <DeviceCodeModal />

        </div>
    )
}
