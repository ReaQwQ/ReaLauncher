import { useEffect } from 'react'
import { useLogStore } from '../stores/logStore'

export function useLogListener() {
    const addLog = useLogStore((state) => state.addLog)

    useEffect(() => {
        if (!window.electronAPI) return

        // Listen for log events from Electron
        const handleLog = (_: any, data: { level: 'info' | 'warn' | 'error' | 'debug', message: string }) => {
            console.log(`[${data.level.toUpperCase()}] ${data.message}`)
            addLog(data.level, data.message)
        }

        // @ts-ignore - electronAPI type might not include ipcRenderer
        window.electronAPI.ipcRenderer?.on('launcher:log', handleLog)

        return () => {
            // @ts-ignore
            window.electronAPI.ipcRenderer?.removeListener('launcher:log', handleLog)
        }
    }, [addLog])
}
