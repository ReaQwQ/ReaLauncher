import { app, BrowserWindow, ipcMain, shell, dialog, Menu } from 'electron'
import 'dotenv/config'
import * as path from 'path'
import * as fs from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as dns from 'dns'

import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Set custom paths for Electron internal data to keep it organized
const userDataPath = app.getPath('userData')
const electronDataPath = path.join(userDataPath, 'electron')
if (!fs.existsSync(electronDataPath)) {
    fs.mkdirSync(electronDataPath, { recursive: true })
}
app.setPath('userData', electronDataPath)


import { microsoftAuth, setAuthWindow } from './auth/microsoft'
import { registerLauncherHandlers, minecraftLauncher } from './minecraft/launcher'
import { registerEMLHandlers, setMainWindow } from './minecraft/eml-handler'

const ORIGINAL_USER_DATA = userDataPath

const execAsync = promisify(exec)

const isDev = !app.isPackaged


let mainWindow: BrowserWindow | null = null

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 700,
        frame: false,
        backgroundColor: '#0f172a',
        webPreferences: {
            preload: (() => {
                const p = path.join(__dirname, 'preload.cjs');
                console.log('Configuring preload path:', p);
                if (!fs.existsSync(p)) console.error('PRELOAD FILE NOT FOUND AT:', p);
                else console.log('Preload file found.');
                return p;
            })(),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: false,
            sandbox: false
        }
    })

    // Conclusively disable DevTools and Menu for production
    // Conclusively disable DevTools and Menu for production
    if (!isDev) {
        Menu.setApplicationMenu(null)
        mainWindow.setMenuBarVisibility(false)

        /* TEMPORARY DEBUGGING: ENABLE DEVTOOLS
        mainWindow.webContents.on('devtools-opened', () => {
            mainWindow?.webContents.closeDevTools()
        })
        */

        mainWindow.webContents.on('before-input-event', (event, input) => {
            if (
                (input.control && input.shift && input.key === 'I') ||
                (input.control && input.shift && input.key === 'J') ||
                (input.control && input.shift && input.key === 'C') ||
                (input.control && input.key === 'r') ||
                (input.control && input.shift && input.key === 'R') ||
                input.key === 'F12' ||
                input.key === 'F11'
            ) {
                event.preventDefault()
            }
        })

        // Prevent external navigation
        mainWindow.webContents.on('will-navigate', (event, url) => {
            if (url !== mainWindow?.webContents.getURL()) {
                event.preventDefault()
                shell.openExternal(url)
            }
        })

        // Block context menu (Inspect Element)
        mainWindow.webContents.on('context-menu', (e) => {
            e.preventDefault()
        })
    }

    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
        if (isDev) mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }

    // Start maximized (fullscreen)
    mainWindow.maximize()

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url)
        return { action: 'deny' }
    })

    mainWindow.on('closed', () => { mainWindow = null })
    mainWindow.on('maximize', () => mainWindow?.webContents.send('window-maximize-changed', true))
    mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window-maximize-changed', false))
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })
    app.whenReady().then(async () => {
        // Set About panel
        app.setAboutPanelOptions({
            applicationName: 'ReaLauncher',
            applicationVersion: app.getVersion(),
            copyright: 'Copyright © 2024-2026 ReaLauncher',
            authors: ['ReaLauncher Team'],
            website: 'https://realauncher.app'
        })

        createWindow()
        if (mainWindow) {
            setMainWindow(mainWindow)
            setAuthWindow(mainWindow)
            minecraftLauncher.setMainWindow(mainWindow)
        }
        registerLauncherHandlers()
        registerEMLHandlers()

        // Non-blocking startup network check
        dns.lookup('api.modrinth.com', (err) => {
            const online = !err || err.code !== 'ENOTFOUND'
            if (!online) {
                dialog.showErrorBox(
                    'Network Connection Error',
                    'ReaLauncher requires an internet connection to start. Please check your connection and try again.'
                )
                app.quit()
            }
        })
    })
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (mainWindow === null) createWindow() })

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize())
ipcMain.on('window-close', () => mainWindow?.close())
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false)

// FS handlers
ipcMain.handle('fs:select-file', async (_, title: string, filters?: { name: string, extensions: string[] }[]) => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
        title,
        filters,
        properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('fs:select-directory', async (_, title: string) => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
        title,
        properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
})

// Custom FS handlers for Custom File Browser
ipcMain.handle('fs:list-contents', async (_, targetPath: string) => {
    try {
        const fullPath = path.resolve(targetPath)
        if (!fs.existsSync(fullPath)) return { error: 'Path does not exist' }

        const stats = fs.statSync(fullPath)
        if (!stats.isDirectory()) return { error: 'Not a directory' }

        const entries = fs.readdirSync(fullPath, { withFileTypes: true })
        const results = entries.map(entry => {
            const entryPath = path.join(fullPath, entry.name)
            let size = 0
            let mtime = new Date()

            try {
                const s = fs.statSync(entryPath)
                size = s.size
                mtime = s.mtime
            } catch (e) {
                // Ignore permission errors for individual files
            }

            return {
                name: entry.name,
                path: entryPath,
                isDirectory: entry.isDirectory(),
                size,
                mtime
            }
        })

        return {
            currentPath: fullPath,
            parentPath: path.dirname(fullPath) === fullPath ? null : path.dirname(fullPath),
            entries: results
        }
    } catch (error: any) {
        return { error: error.message }
    }
})

ipcMain.handle('fs:get-drives', async () => {
    if (process.platform === 'win32') {
        try {
            // Use PowerShell to get logical drives, which is more reliable than wmic
            const { stdout } = await execAsync('powershell -Command "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Name"')
            return stdout.split(/\r?\n/)
                .filter(line => line.trim())
                .map(line => line.trim() + ':\\')
        } catch (e) {
            console.error('Failed to get drives via PowerShell:', e)
            return ['C:\\']
        }
    } else {
        return ['/']
    }
})

ipcMain.handle('fs:get-home', async () => {
    return app.getPath('home')
})

// Auth handlers
ipcMain.handle('auth:login', async () => await microsoftAuth.login())
ipcMain.handle('auth:logout', async () => await microsoftAuth.logout())
ipcMain.handle('auth:get-profile', async () => await microsoftAuth.getProfile())

// App handlers
ipcMain.handle('app:clear-cache', async () => {
    if (mainWindow) {
        await mainWindow.webContents.session.clearCache()
        mainWindow.reload()
    }
})

ipcMain.handle('app:open-external', async (_, url: string) => {
    try {
        await shell.openExternal(url)
        return { success: true }
    } catch (error: any) {
        console.error('Failed to open external URL:', error)
        return { success: false, error: error.message }
    }
})
