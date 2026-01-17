import { exec, spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { app, ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { promisify } from 'util'
import { downloadVanillaVersion, prepareCustomVersion } from './eml-handler'

const execAsync = promisify(exec)

export interface JavaInstallation {
    path: string
    version: string
    is64Bit: boolean
    vendor: string
}

export interface MinecraftInstance {
    id: string
    name: string
    version: string
    loader?: {
        type: 'forge' | 'fabric' | 'neoforge' | 'quilt'
        version: string
    }
    javaPath?: string
    memory: {
        min: number
        max: number
    }
    mods: any[]
    lastPlayed?: string
    lastUse?: string
    created: string
    // Settings
    windowSettings?: {
        fullscreen: boolean
        width: number
        height: number
    }
    javaArgs?: string
    envVars?: string
    launchHooks?: {
        preLaunch?: string
        wrapper?: string
        postExit?: string
    }
    resourcepacks?: any[]
    shaderpacks?: any[]
    path?: string // Transient property, not saved to DB
}

interface LaunchOptions {
    instance: MinecraftInstance
    profile: {
        id: string
        name: string
        accessToken: string
    }
    javaPath: string
}

class MinecraftLauncher {
    private instancesPath: string
    private versionsPath: string
    private assetsPath: string
    private librariesPath: string
    private mainWindow: BrowserWindow | null = null

    constructor() {
        // Consolidate all Minecraft data into the meta directory
        const lPath = path.join(app.getPath('appData'), 'realauncher')
        const metaPath = path.join(lPath, 'meta')

        this.instancesPath = path.join(lPath, 'instances')
        this.versionsPath = path.join(metaPath, 'versions')
        this.assetsPath = path.join(metaPath, 'assets')
        this.librariesPath = path.join(metaPath, 'libraries')

        // Ensure directories exist
        this.ensureDirectories()
    }

    private ensureDirectories(): void {
        const dirs = [this.instancesPath, this.versionsPath, this.assetsPath, this.librariesPath]
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
            }
        })
    }

    public setMainWindow(window: BrowserWindow): void {
        this.mainWindow = window
    }

    // Sanitize instance name for filesystem
    public sanitizeInstanceName(name: string): string {
        // Replace invalid filesystem characters with underscores
        return name
            .replace(/[<>:"/\\|?*]/g, '_')  // Windows invalid chars
            .replace(/\s+/g, '_')             // Spaces to underscores
            .replace(/_{2,}/g, '_')           // Multiple underscores to single
            .replace(/^_|_$/g, '')            // Trim underscores from start/end
            .toLowerCase()                    // Lowercase for consistency
    }

    async detectJavaInstallations(): Promise<JavaInstallation[]> {
        const installations: JavaInstallation[] = []

        // Common Java installation paths on Windows
        const searchPaths = [
            process.env.JAVA_HOME,
            'C:\\Program Files\\Java',
            'C:\\Program Files (x86)\\Java',
            'C:\\Program Files\\Eclipse Adoptium',
            'C:\\Program Files\\Microsoft',
            'C:\\Program Files\\Zulu',
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Eclipse Adoptium'),
        ].filter(Boolean) as string[]

        for (const searchPath of searchPaths) {
            try {
                if (!fs.existsSync(searchPath)) continue

                // If it's a direct Java home
                const directJavaExe = path.join(searchPath, 'bin', 'java.exe')
                if (fs.existsSync(directJavaExe)) {
                    const info = await this.getJavaInfo(directJavaExe)
                    if (info) installations.push(info)
                    continue
                }

                // Search subdirectories
                const entries = fs.readdirSync(searchPath, { withFileTypes: true })
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const javaExe = path.join(searchPath, entry.name, 'bin', 'java.exe')
                        if (fs.existsSync(javaExe)) {
                            const info = await this.getJavaInfo(javaExe)
                            if (info) installations.push(info)
                        }
                    }
                }
            } catch (error) {
                console.error(`Error searching ${searchPath}:`, error)
            }
        }

        // Also check PATH
        try {
            const { stdout } = await execAsync('where java')
            const paths = stdout.trim().split('\n').map(p => p.trim())
            for (const javaPath of paths) {
                if (!installations.some(i => i.path === javaPath)) {
                    const info = await this.getJavaInfo(javaPath)
                    if (info) installations.push(info)
                }
            }
        } catch (error) {
            // java not in PATH
        }

        return installations
    }

    private async getJavaInfo(javaPath: string): Promise<JavaInstallation | null> {
        try {
            const { stderr } = await execAsync(`"${javaPath}" -version`, { encoding: 'utf8' })
            const output = stderr || ''

            // Parse version
            const versionMatch = output.match(/version "(.+?)"/)
            const version = versionMatch ? versionMatch[1] : 'unknown'

            // Check if 64-bit
            const is64Bit = output.includes('64-Bit')

            // Get vendor
            let vendor = 'Unknown'
            if (output.includes('OpenJDK')) vendor = 'OpenJDK'
            else if (output.includes('Oracle')) vendor = 'Oracle'
            else if (output.includes('Temurin')) vendor = 'Eclipse Temurin'
            else if (output.includes('Zulu')) vendor = 'Azul Zulu'
            else if (output.includes('Microsoft')) vendor = 'Microsoft'

            return {
                path: javaPath,
                version,
                is64Bit,
                vendor
            }
        } catch (error) {
            console.error(`Error getting Java info for ${javaPath}:`, error)
            return null
        }
    }

    async getInstances(): Promise<MinecraftInstance[]> {
        const instances: MinecraftInstance[] = []
        const instancesFile = path.join(this.instancesPath, 'instances.json')

        try {
            if (fs.existsSync(instancesFile)) {
                const data = fs.readFileSync(instancesFile, 'utf-8')
                const parsed: MinecraftInstance[] = JSON.parse(data)

                // attach calculated path to each instance
                return parsed.map(inst => ({
                    ...inst,
                    mods: inst.mods || [],
                    resourcepacks: inst.resourcepacks || [],
                    shaderpacks: inst.shaderpacks || [],
                    path: path.join(this.instancesPath, this.sanitizeInstanceName(inst.name))
                }))
            }
        } catch (error) {
            console.error('Error loading instances:', error)
        }

        return instances
    }

    async saveInstances(instances: MinecraftInstance[]): Promise<void> {
        const instancesFile = path.join(this.instancesPath, 'instances.json')
        // Don't save the transient 'path' property to JSON
        const toSave = instances.map(({ path: _, ...rest }) => rest)
        fs.writeFileSync(instancesFile, JSON.stringify(toSave, null, 2))
    }

    async createInstance(options: {
        name: string
        version: string
        loader?: { type: 'forge' | 'fabric' | 'neoforge' | 'quilt'; version: string }
        memory?: { min: number; max: number }
    }): Promise<MinecraftInstance> {
        const instances = await this.getInstances()

        // Check for duplicate names and add number suffix if needed
        let finalName = options.name
        let counter = 2
        while (instances.some(i => i.name === finalName)) {
            finalName = `${options.name} (${counter})`
            counter++
        }

        const instance: MinecraftInstance = {
            id: `instance-${Date.now()}`,
            name: finalName,
            version: options.version,
            loader: options.loader,
            memory: options.memory || { min: 2048, max: 4096 },
            mods: [],
            resourcepacks: [],
            shaderpacks: [],
            created: new Date().toISOString(),
            lastUse: new Date().toISOString()
        }

        // Create instance directory using sanitized name
        const sanitizedName = this.sanitizeInstanceName(instance.name)
        const instanceDir = path.join(this.instancesPath, sanitizedName)
        fs.mkdirSync(instanceDir, { recursive: true })

        // Create all necessary subdirectories
        fs.mkdirSync(path.join(instanceDir, 'mods'), { recursive: true })
        fs.mkdirSync(path.join(instanceDir, 'config'), { recursive: true })
        fs.mkdirSync(path.join(instanceDir, 'shaderpacks'), { recursive: true })
        fs.mkdirSync(path.join(instanceDir, 'resourcepacks'), { recursive: true })
        fs.mkdirSync(path.join(instanceDir, 'datapacks'), { recursive: true })

        instances.push(instance)
        await this.saveInstances(instances)

        // Trigger download/preparation in background
        if (instance.loader) {
            prepareCustomVersion({ version: instance.version, loader: instance.loader } as any)
                .then(id => console.log(`[Instance] Prepared custom version: ${id}`))
                .catch(err => console.error('[Instance] Failed to prepare custom version:', err))
        } else {
            downloadVanillaVersion(instance.version)
                .then(() => console.log(`[Instance] Prepared vanilla version: ${instance.version}`))
                .catch(err => console.error('[Instance] Failed to prepare vanilla version:', err))
        }

        return instance
    }

    async deleteInstance(instanceId: string): Promise<void> {
        const instances = await this.getInstances()
        const instance = instances.find(i => i.id === instanceId)
        const filtered = instances.filter(i => i.id !== instanceId)
        await this.saveInstances(filtered)

        // Delete instance directory using sanitized name
        if (instance) {
            const sanitizedName = this.sanitizeInstanceName(instance.name)
            const instanceDir = path.join(this.instancesPath, sanitizedName)
            if (fs.existsSync(instanceDir)) {
                fs.rmSync(instanceDir, { recursive: true })
            }
        }
    }

    async updateInstance(updatedInstance: MinecraftInstance): Promise<void> {
        const instances = await this.getInstances()
        const idx = instances.findIndex(i => i.id === updatedInstance.id)
        if (idx !== -1) {
            const oldInstance = instances[idx]
            instances[idx] = { ...instances[idx], ...updatedInstance }
            await this.saveInstances(instances)

            // efficient check: if version or loader changed, trigger preparation
            const versionChanged = oldInstance.version !== updatedInstance.version
            const loaderChanged = JSON.stringify(oldInstance.loader) !== JSON.stringify(updatedInstance.loader)

            if (versionChanged || loaderChanged) {
                console.log('[Instance] Version/Loader updated, preparing files...')
                if (updatedInstance.loader) {
                    prepareCustomVersion({ version: updatedInstance.version, loader: updatedInstance.loader } as any)
                        .then(id => console.log(`[Instance] Prepared custom version: ${id}`))
                        .catch(err => console.error('[Instance] Failed to prepare custom version:', err))
                } else {
                    downloadVanillaVersion(updatedInstance.version)
                        .then(() => console.log(`[Instance] Prepared vanilla version: ${updatedInstance.version}`))
                        .catch(err => console.error('[Instance] Failed to prepare vanilla version:', err))
                }
            }
        }
    }

    async getWorlds(instanceId: string): Promise<any[]> {
        const instances = await this.getInstances()
        const instance = instances.find(i => i.id === instanceId)
        if (!instance) return []

        const sanitizedName = this.sanitizeInstanceName(instance.name)
        const worldsPath = path.join(this.instancesPath, sanitizedName, 'saves')

        if (!fs.existsSync(worldsPath)) return []

        try {
            const entries = fs.readdirSync(worldsPath, { withFileTypes: true })
            return entries
                .filter(entry => entry.isDirectory())
                .map(entry => {
                    const worldPath = path.join(worldsPath, entry.name)
                    const stats = fs.statSync(worldPath)
                    return {
                        name: entry.name,
                        lastPlayed: stats.mtime.toISOString(),
                        path: worldPath
                    }
                })
                .sort((a, b) => new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime())
        } catch (error) {
            console.error('Error getting worlds:', error)
            return []
        }
    }

    async getLogs(instanceId: string): Promise<string> {
        const instances = await this.getInstances()
        const instance = instances.find(i => i.id === instanceId)
        if (!instance) return 'Instance not found'

        const sanitizedName = this.sanitizeInstanceName(instance.name)
        const latestLogPath = path.join(this.instancesPath, sanitizedName, 'logs', 'latest.log')

        if (!fs.existsSync(latestLogPath)) return 'No logs found'

        try {
            return fs.readFileSync(latestLogPath, 'utf-8')
        } catch (error) {
            console.error('Error reading logs:', error)
            return 'Error reading log file'
        }
    }

    async getCrashReports(instanceId: string): Promise<string[]> {
        const instances = await this.getInstances()
        const instance = instances.find(i => i.id === instanceId)
        if (!instance) return []

        const sanitizedName = this.sanitizeInstanceName(instance.name)
        const crashReportsPath = path.join(this.instancesPath, sanitizedName, 'crash-reports')

        if (!fs.existsSync(crashReportsPath)) return []

        try {
            const files = fs.readdirSync(crashReportsPath)
            return files.filter(f => f.endsWith('.txt') || f.endsWith('.log')).reverse()
        } catch (error) {
            console.error('Error listing crash reports:', error)
            return []
        }
    }

    async getCrashReportContent(instanceId: string, reportName: string): Promise<string> {
        const instances = await this.getInstances()
        const instance = instances.find(i => i.id === instanceId)
        if (!instance) return 'Instance not found'

        const sanitizedName = this.sanitizeInstanceName(instance.name)
        const reportPath = path.join(this.instancesPath, sanitizedName, 'crash-reports', reportName)

        if (!fs.existsSync(reportPath)) return 'Report not found'

        try {
            return fs.readFileSync(reportPath, 'utf-8')
        } catch (error) {
            console.error('Error reading crash report:', error)
            return 'Error reading crash report'
        }
    }

    async launch(options: LaunchOptions): Promise<{ success: boolean; error?: string }> {
        // This is a simplified launch implementation
        const { instance, profile, javaPath } = options

        console.log('Launching Minecraft:', {
            instance: instance.name,
            version: instance.version,
            player: profile.name,
            java: javaPath
        })

        // Minimize window on launch
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.minimize()
        }

        // Simulate launch delay
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Update last played
        const instances = await this.getInstances()
        const idx = instances.findIndex(i => i.id === instance.id)
        if (idx !== -1) {
            instances[idx].lastPlayed = new Date().toISOString()
            await this.saveInstances(instances)
        }

        // Restore window after delay (In a real implementation, this would be on process exit)
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            // For now we just restore after the delay to demo
            // In real app, we would listen to the child process exit
            this.mainWindow.restore()
            this.mainWindow.focus()
        }

        return {
            success: true
        }
    }
}

export const minecraftLauncher = new MinecraftLauncher()

// Register IPC handlers
export function registerLauncherHandlers(): void {
    ipcMain.handle('launcher:detect-java', async () => {
        return await minecraftLauncher.detectJavaInstallations()
    })

    ipcMain.handle('launcher:get-instances', async () => {
        return await minecraftLauncher.getInstances()
    })

    ipcMain.handle('launcher:create-instance', async (_, options) => {
        return await minecraftLauncher.createInstance(options)
    })

    ipcMain.handle('launcher:delete-instance', async (_, instanceId: string) => {
        return await minecraftLauncher.deleteInstance(instanceId)
    })

    ipcMain.handle('launcher:update-instance', async (_, instance: MinecraftInstance) => {
        return await minecraftLauncher.updateInstance(instance)
    })

    ipcMain.handle('launcher:launch', async (_, options) => {
        return await minecraftLauncher.launch(options)
    })

    ipcMain.handle('launcher:get-worlds', async (_, instanceId: string) => {
        return await minecraftLauncher.getWorlds(instanceId)
    })

    ipcMain.handle('launcher:get-logs', async (_, instanceId: string) => {
        return await minecraftLauncher.getLogs(instanceId)
    })

    ipcMain.handle('launcher:get-crash-reports', async (_, instanceId: string) => {
        return await minecraftLauncher.getCrashReports(instanceId)
    })

    ipcMain.handle('launcher:get-crash-report-content', async (_, instanceId: string, reportName: string) => {
        return await minecraftLauncher.getCrashReportContent(instanceId, reportName)
    })

    ipcMain.handle('launcher:open-folder', async (_, instancePath: string) => {
        try {
            await shell.openPath(instancePath)
            return { success: true }
        } catch (error) {
            console.error('Failed to open folder:', error)
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
    })
    ipcMain.handle('launcher:read-image', async (_, filePath: string) => {
        try {
            if (!filePath || typeof filePath !== 'string') return null

            const ext = path.extname(filePath).toLowerCase().substring(1)
            const mimeType = ext === 'jpg' ? 'jpeg' : ext
            const data = fs.readFileSync(filePath)
            const base64 = data.toString('base64')
            return `data:image/${mimeType};base64,${base64}`
        } catch (error) {
            console.error('Failed to read image file:', error)
            return null
        }
    })
}
