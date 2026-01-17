/// <reference types="vite/client" />

interface Window {
    electronAPI: import('../electron/preload').ElectronAPI
    electron: import('../electron/preload').ElectronAPI
}
