import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface LogEntry {
    timestamp: number
    level: 'info' | 'warn' | 'error' | 'debug' | 'success'
    message: string
    instanceId?: string
}

interface LogStore {
    logs: LogEntry[]
    maxLogs: number
    addLog: (level: LogEntry['level'], message: string, instanceId?: string) => void
    clearLogs: (instanceId?: string) => void
}

export const useLogStore = create<LogStore>()(
    persist(
        (set) => ({
            logs: [],
            maxLogs: 1000, // Keep only last 1000 logs

            addLog: (level, message, instanceId) => set((state) => {
                const newLog: LogEntry = {
                    timestamp: Date.now(),
                    level,
                    message,
                    instanceId
                }

                // Keep only the most recent logs
                const newLogs = [...state.logs, newLog]
                if (newLogs.length > state.maxLogs) {
                    newLogs.shift()
                }

                return { logs: newLogs }
            }),

            clearLogs: (instanceId) => set((state) => ({
                logs: instanceId
                    ? state.logs.filter(log => log.instanceId !== instanceId)
                    : []
            }))
        }),
        {
            name: 'realauncher-logs',
            // Only persist the last 100 logs to avoid localStorage bloat
            partialize: (state) => ({
                logs: state.logs.slice(-100)
            })
        }
    )
)
