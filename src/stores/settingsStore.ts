import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
    javaPath: string // Generic path (legacy)
    java8Path: string
    java17Path: string
    java21Path: string
    java25Path: string
    memory: {
        min: number
        max: number
    }
    closeOnLaunch: boolean
    rpcEnabled: boolean
    instancePath: string

    // Advanced
    maxConcurrentDownloads: number
    maxConcurrentWrites: number
    launcherPath: string

    // Actions
    fetchLauncherPath: () => Promise<void>

    setJavaPath: (path: string) => void
    setJavaVersionPath: (version: 8 | 17 | 21 | 25, path: string) => void
    setMemory: (min: number, max: number) => void
    setCloseOnLaunch: (value: boolean) => void
    setRpcEnabled: (value: boolean) => void
    setInstancePath: (path: string) => void

    setMaxConcurrentDownloads: (val: number) => void
    setMaxConcurrentWrites: (val: number) => void
    setLauncherPath: (path: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            javaPath: '',
            java8Path: '',
            java17Path: '',
            java21Path: '',
            java25Path: '',
            memory: {
                min: 2048,
                max: 4096
            },
            closeOnLaunch: false,
            rpcEnabled: true,
            instancePath: '',

            // Advanced
            maxConcurrentDownloads: 10,
            maxConcurrentWrites: 50,
            launcherPath: '', // Empty = default

            fetchLauncherPath: async () => {
                try {
                    const path = await window.electronAPI.eml.getLauncherPath()
                    set({ launcherPath: path })
                } catch (e) {
                    console.error('Failed to fetch launcher path', e)
                }
            },

            setJavaPath: (path) => set({ javaPath: path }),
            setJavaVersionPath: (version, path) => {
                const key = `java${version}Path` as keyof SettingsState
                set({ [key]: path } as any)
            },
            setMemory: (min, max) => set({ memory: { min, max } }),
            setCloseOnLaunch: (value) => set({ closeOnLaunch: value }),
            setRpcEnabled: (value) => set({ rpcEnabled: value }),
            setInstancePath: (path) => set({ instancePath: path }),

            // Advanced Actions
            setMaxConcurrentDownloads: (val) => set({ maxConcurrentDownloads: val }),
            setMaxConcurrentWrites: (val) => set({ maxConcurrentWrites: val }),
            setLauncherPath: async (path) => {
                set({ launcherPath: path })
                try {
                    await window.electronAPI.eml.setLauncherPath(path)
                } catch (e) {
                    console.error('Failed to set launcher path', e)
                }
            }
        }),
        {
            name: 'realauncher-settings-storage'
        }
    )
)
