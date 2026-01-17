/**
 * EML Lib Handler - Minecraft Download & Launch Integration
 * Uses EML Lib for downloading and launching Minecraft while preserving existing auth
 */

import { ipcMain, app, BrowserWindow, shell, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import EMLLib from 'eml-lib'
import { exec, spawn } from 'child_process'
import axios from 'axios'
import AdmZip from 'adm-zip'
import { microsoftAuth, setAuthWindow } from '../auth/microsoft'
import { registerLauncherHandlers, minecraftLauncher } from './launcher'
import * as crypto from 'crypto'
import * as dns from 'dns'



interface DownloadProgress {
    type: 'java' | 'minecraft' | 'assets' | 'libraries' | 'loader' | 'modpack' | 'hash' | 'detect' | 'game'
    current: number
    total: number
    filename?: string
    percentage: number
}

var mainWindow: BrowserWindow | null = null

export function setMainWindow(window: BrowserWindow) {
    mainWindow = window
    Logger.info(`[Paths] lPath (Root): ${APP_DATA_PATH}`)
    Logger.info(`[Paths] Minecraft Meta Path: ${MINECRAFT_PATH}`)
    Logger.info(`[Paths] Java Versions Storage: ${JAVA_STORAGE_PATH}`)
}

function sendProgress(progress: DownloadProgress) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('launcher:download-progress', progress)
    }
}

function sendLog(level: 'info' | 'warn' | 'error' | 'debug' | 'success', message: string, instanceId?: string) {
    // Determine if we should send this log
    const isDebug = !app.isPackaged || process.env.DEBUG === 'true'

    // Skip debug logs if not in debug mode
    if (level === 'debug' && !isDebug) return

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('launcher:log', { level, message, instanceId })
    }

    // Always log to console for debugging purposes, but format it nicely
    if (isDebug) {
        console.log(`[${instanceId || 'GLOBAL'}] [${level.toUpperCase()}] ${message}`)
    }
}

export class Logger {
    static info(message: string) { sendLog('info', message) }
    static warn(message: string) { sendLog('warn', message) }
    static error(message: string) { sendLog('error', message) }
    static debug(message: string) { sendLog('debug', message) }
    static success(message: string) { sendLog('success', message) }
}

const USER_DATA = app.getPath('userData')
const CONFIG_FILE = path.join(USER_DATA, 'launcher-config.json')

// Load config or default
let config = {
    rootPath: path.join(app.getPath('appData'), 'realauncher')
}

try {
    if (fs.existsSync(CONFIG_FILE)) {
        const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
        if (saved.rootPath) config.rootPath = saved.rootPath
    }
} catch (e) {
    Logger.error(`Failed to load launcher config: ${e}`)
}


// Exported variables for paths (now mutable/re-computable if needed, but usually static per session)
export let LPATH = config.rootPath
export let APP_DATA_PATH = LPATH
export let META_PATH = path.join(APP_DATA_PATH, 'meta')
export let MINECRAFT_PATH = META_PATH
export let VERSIONS_PATH = path.join(META_PATH, 'versions')
export let ASSETS_PATH = path.join(META_PATH, 'assets')
export let LIBRARIES_PATH = path.join(META_PATH, 'libraries')
export let JAVA_STORAGE_PATH = path.join(META_PATH, 'java_versions')
export let TEMP_PATH = path.join(META_PATH, 'temp')

// Re-calculate paths (helper for switching roots)
function updatePaths(newRoot: string) {
    LPATH = newRoot
    APP_DATA_PATH = LPATH
    META_PATH = path.join(APP_DATA_PATH, 'meta')
    MINECRAFT_PATH = META_PATH
    VERSIONS_PATH = path.join(META_PATH, 'versions')
    ASSETS_PATH = path.join(META_PATH, 'assets')
    LIBRARIES_PATH = path.join(META_PATH, 'libraries')
    JAVA_STORAGE_PATH = path.join(META_PATH, 'java_versions')
    TEMP_PATH = path.join(META_PATH, 'temp')

    Logger.info(`[Paths] Updated Root: ${LPATH}`)
    ensureDirectories()
}

/**
 * Check if the instance has a network connection
 */
async function isOnline(): Promise<boolean> {
    return new Promise((resolve) => {
        dns.lookup('api.modrinth.com', (err) => {
            if (err && err.code === 'ENOTFOUND') {
                resolve(false)
            } else {
                resolve(true)
            }
        })
    })
}


// Ensure directories exist
function ensureDirectories() {
    const dirs = [MINECRAFT_PATH, VERSIONS_PATH, ASSETS_PATH, LIBRARIES_PATH, JAVA_STORAGE_PATH, TEMP_PATH]
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
    })
}

ensureDirectories()

// Cleanup legacy top-level folders if they exist (moved to meta)
function cleanupLegacyFolders() {
    const legacyFolders = [
        path.join(APP_DATA_PATH, 'assets'),
        path.join(APP_DATA_PATH, 'libraries'),
        path.join(APP_DATA_PATH, 'versions'),
        path.join(APP_DATA_PATH, 'instances'),
        path.join(APP_DATA_PATH, 'installer')
    ]
    legacyFolders.forEach(folder => {
        if (fs.existsSync(folder) && fs.readdirSync(folder).length === 0) {
            try {
                fs.rmdirSync(folder)
                Logger.info(`[Cleanup] Removed empty legacy folder: ${folder}`)
            } catch (e) {
                Logger.warn(`[Cleanup] Failed to remove folder ${folder}: ${e}`)
            }
        }
    })
}

cleanupLegacyFolders()

interface LaunchConfig {
    version: string
    loader?: {
        type: 'forge' | 'fabric' | 'neoforge' | 'quilt' | 'legacy-fabric'
        version: string
    }
    memory: {
        min: number
        max: number
    }
    profile: {
        id: string
        name: string
        accessToken: string
    }
    instancePath?: string
    javaPath?: string
    instanceId?: string
    instanceName?: string
}





/**
 * Search content on Modrinth
 */
async function searchContent(options: {
    query?: string
    facets?: string[][]
    index?: 'relevance' | 'downloads' | 'newest' | 'updated'
    offset?: number
    limit?: number
}) {
    try {
        const { query = "", facets = [], index = "relevance", offset = 0, limit = 20 } = options

        const params: any = {
            query,
            index,
            offset,
            limit
        }

        if (facets.length > 0) {
            params.facets = JSON.stringify(facets)
        }

        const response = await axios.get('https://api.modrinth.com/v2/search', { params })
        return response.data
    } catch (error) {
        Logger.error(`Search failed: ${error}`)
        throw error
    }
}

/**
 * Helper to get SHA1 hash of a file
 */
async function getFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha1')
        const stream = fs.createReadStream(filePath)
        stream.on('data', data => hash.update(data))
        stream.on('end', () => resolve(hash.digest('hex')))
        stream.on('error', reject)
    })
}

/**
 * Helper to get SHA512 hash of a file
 */
async function getFileHashSha512(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha512')
        const stream = fs.createReadStream(filePath)
        stream.on('data', data => hash.update(data))
        stream.on('end', () => resolve(hash.digest('hex')))
        stream.on('error', reject)
    })
}

/**
 * Helper to update instances.json metadata
 */
function updateInstanceMetadata(instanceId: string, projectType: string, entry: any) {
    const instancesJsonPath = path.join(LPATH, 'instances', 'instances.json')
    if (!fs.existsSync(instancesJsonPath)) return

    try {
        const content = fs.readFileSync(instancesJsonPath, 'utf-8')
        const instances = JSON.parse(content)
        const instanceIndex = instances.findIndex((i: any) => i.id === instanceId)

        if (instanceIndex !== -1) {
            let targetList = 'mods'
            if (projectType === 'resourcepack') targetList = 'resourcepacks'
            else if (projectType === 'shader' || projectType === 'shaderpack') targetList = 'shaderpacks'
            else if (projectType === 'datapack') targetList = 'datapacks'

            if (!instances[instanceIndex][targetList]) {
                instances[instanceIndex][targetList] = []
            }

            // Remove from other lists to prevent duplication (e.g., detecting a zip as resourcepack when it was previously in mods)
            const allLists = ['mods', 'resourcepacks', 'shaderpacks', 'datapacks']
            allLists.forEach(listName => {
                if (listName !== targetList && instances[instanceIndex][listName]) {
                    const originalLength = instances[instanceIndex][listName].length
                    instances[instanceIndex][listName] = instances[instanceIndex][listName].filter((m: any) =>
                        m.fileName !== entry.fileName && m.id !== entry.id
                    )
                    if (instances[instanceIndex][listName].length !== originalLength) {
                        Logger.debug(`[Metadata] Removed ${entry.fileName} from ${listName} (moving to ${targetList})`)
                    }
                }
            })

            const existingIndex = instances[instanceIndex][targetList].findIndex((m: any) =>
                m.id === entry.id || m.fileName === entry.fileName
            )

            if (existingIndex !== -1) {
                instances[instanceIndex][targetList][existingIndex] = {
                    ...instances[instanceIndex][targetList][existingIndex],
                    ...entry
                }
            } else {
                instances[instanceIndex][targetList].push(entry)
            }

            fs.writeFileSync(instancesJsonPath, JSON.stringify(instances, null, 2), 'utf-8')
            Logger.debug(`[Metadata] Updated ${targetList} for instance ${instanceId}: ${entry.name}`)
        }
    } catch (error) {
        Logger.error(`[Metadata] Failed to update instances.json: ${error}`)
    }
}

/**
 * Get metadata for a local file
 */
async function getLocalMetadata(filePath: string, fileName: string, projectType: string): Promise<any> {
    try {
        // 1. Try Modrinth API via Hash
        if (fileName.endsWith('.jar')) {
            try {
                const hash = await getFileHash(filePath)
                Logger.info(`[Metadata] Checking Modrinth for hash: ${hash} (${fileName})`)
                const response = await axios.get(`https://api.modrinth.com/v2/version_file/${hash}`)
                if (response.data) {
                    const versionData = response.data as any
                    const projectResponse = await axios.get(`https://api.modrinth.com/v2/project/${versionData.project_id}`)
                    const project = projectResponse.data as any

                    // Fetch team members to get all authors
                    let authors: { name: string, id: string }[] = []
                    try {
                        const teamResponse = await axios.get(`https://api.modrinth.com/v2/team/${project.team}/members`)
                        const teamData = teamResponse.data as any[]
                        authors = teamData.map((m: any) => ({
                            name: m.user.username,
                            id: m.user.username || m.user.id
                        }))
                    } catch (teamErr) {
                        authors = [{ name: 'Unknown', id: 'Unknown' }]
                    }

                    return {
                        id: project.id,
                        name: project.title,
                        author: authors.map(a => a.name).join(', '),
                        authors: authors,
                        iconUrl: project.icon_url,
                        version: versionData.version_number,
                        fileName: fileName,
                        source: 'modrinth',
                        slug: project.slug,
                        authorId: authors[0]?.id || 'Unknown',
                        categories: project.categories,
                        projectType: project.project_type
                    }
                }
            } catch (e) {
                // Not on Modrinth or network error, continue to local parsing
            }
        }

        // 2. Local JAR parsing (Fabric, Forge, Quilt)
        if (fileName.endsWith('.jar')) {
            try {
                const zip = new AdmZip(filePath)

                // Try Fabric
                const fabricJson = zip.getEntry('fabric.mod.json')
                if (fabricJson) {
                    try {
                        const data = JSON.parse(zip.readAsText(fabricJson))
                        let iconPath = ''

                        // Icon extraction
                        if (data.icon) {
                            const iconEntryName = data.icon
                            const iconEntry = zip.getEntry(iconEntryName)
                            if (iconEntry) {
                                const iconsDir = path.join(LPATH, 'meta', 'icons')
                                if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })
                                const ext = path.extname(iconEntryName) || '.png'
                                const targetIconPath = path.join(iconsDir, `${data.id}${ext}`)
                                zip.extractEntryTo(iconEntry, iconsDir, false, true)
                                // Rename to consistent name if needed
                                const extractedPath = path.join(iconsDir, path.basename(iconEntryName))
                                if (extractedPath !== targetIconPath && fs.existsSync(extractedPath)) {
                                    fs.renameSync(extractedPath, targetIconPath)
                                }
                                iconPath = targetIconPath
                            }
                        }

                        return {
                            id: data.id,
                            name: data.name || data.id,
                            author: Array.isArray(data.authors) ? data.authors.map((a: any) => typeof a === 'string' ? a : (a.name || a)).join(', ') : 'Unknown',
                            version: data.version,
                            fileName: fileName,
                            source: 'local (fabric)',
                            iconUrl: iconPath ? `file://${iconPath}` : undefined,
                            description: data.description
                        }
                    } catch (e) {
                        Logger.warn(`[Metadata] Fabric JSON parse error for ${fileName}: ${e}`)
                    }
                }

                // Try Quilt
                const quiltJson = zip.getEntry('quilt.mod.json')
                if (quiltJson) {
                    const data = JSON.parse(zip.readAsText(quiltJson))
                    const metadata = data.quilt_loader?.metadata || {}
                    return {
                        id: data.quilt_loader?.id || fileName,
                        name: metadata.name || data.quilt_loader?.id || fileName,
                        author: Array.isArray(metadata.contributors) ? Object.keys(metadata.contributors).join(', ') : 'Unknown',
                        version: data.quilt_loader?.version || 'local',
                        fileName: fileName,
                        source: 'local (quilt)'
                    }
                }

                // Try Forge/NeoForge (mods.toml)
                const modsToml = zip.getEntry('META-INF/mods.toml')
                if (modsToml) {
                    const content = zip.readAsText(modsToml)
                    const idMatch = content.match(/modId\s*=\s*["'](.+?)["']/)
                    const nameMatch = content.match(/displayName\s*=\s*["'](.+?)["']/)
                    const versionMatch = content.match(/version\s*=\s*["'](.+?)["']/)
                    const authorMatch = content.match(/authors\s*=\s*["'](.+?)["']/)
                    const logoMatch = content.match(/logoFile\s*=\s*["'](.+?)["']/)

                    const modId = idMatch ? idMatch[1] : fileName.replace('.jar', '')
                    let iconPath = ''

                    if (logoMatch && logoMatch[1]) {
                        const logoFile = logoMatch[1]
                        const iconEntry = zip.getEntry(logoFile)
                        if (iconEntry) {
                            const iconsDir = path.join(LPATH, 'meta', 'icons')
                            if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })
                            const ext = path.extname(logoFile) || '.png'
                            const targetIconPath = path.join(iconsDir, `${modId}${ext}`)
                            zip.extractEntryTo(iconEntry, iconsDir, false, true)
                            const extractedPath = path.join(iconsDir, path.basename(logoFile))
                            if (extractedPath !== targetIconPath && fs.existsSync(extractedPath)) {
                                fs.renameSync(extractedPath, targetIconPath)
                            }
                            iconPath = targetIconPath
                        }
                    }

                    return {
                        id: modId,
                        name: nameMatch ? nameMatch[1] : modId,
                        author: authorMatch ? authorMatch[1] : 'Unknown',
                        version: versionMatch ? versionMatch[1] : 'local',
                        fileName: fileName,
                        source: 'local (forge)',
                        iconUrl: iconPath ? `file://${iconPath}` : undefined
                    }
                }

                // Try Legacy Forge (mcmod.info)
                const mcmodInfo = zip.getEntry('mcmod.info')
                if (mcmodInfo) {
                    try {
                        const info = JSON.parse(zip.readAsText(mcmodInfo))
                        const data = Array.isArray(info) ? info[0] : (info.modList ? info.modList[0] : info)
                        if (data) {
                            return {
                                id: data.modid || fileName,
                                name: data.name || data.modid || fileName,
                                author: Array.isArray(data.authorList) ? data.authorList.join(', ') : (data.authors || 'Unknown'),
                                version: data.version || 'local',
                                fileName: fileName,
                                source: 'local (legacy forge)',
                                description: data.description
                            }
                        }
                    } catch (e) {
                        Logger.warn(`[Metadata] mcmod.info parse error for ${fileName}: ${e}`)
                    }
                }
            } catch (zipError) {
                Logger.error(`[Metadata] Failed to parse zip for ${fileName}: ${zipError}`)
            }
        }

        // 4. Check for Zip/Folder (Resourcepacks, Datapacks, Shaderpacks)
        const isZip = fileName.endsWith('.zip')
        const isDirectory = fs.statSync(filePath).isDirectory()

        if (isZip || isDirectory) {
            try {
                // Try to read pack.mcmeta (Resourcepack / Datapack)
                let packMcmeta: any = null

                if (isZip) {
                    const zip = new AdmZip(filePath)
                    const entry = zip.getEntry('pack.mcmeta')
                    if (entry) {
                        packMcmeta = JSON.parse(zip.readAsText(entry))
                    }
                } else if (isDirectory) {
                    const mcmetaPath = path.join(filePath, 'pack.mcmeta')
                    if (fs.existsSync(mcmetaPath)) {
                        packMcmeta = JSON.parse(fs.readFileSync(mcmetaPath, 'utf-8'))
                    }
                }

                if (packMcmeta && packMcmeta.pack) {
                    return {
                        id: fileName,
                        name: fileName.replace(/\.zip$/, ''),
                        description: packMcmeta.pack.description,
                        pack_format: packMcmeta.pack.pack_format,
                        author: 'Unknown',
                        version: 'local',
                        fileName: fileName,
                        enabled: true,
                        source: 'local',
                        projectType: (projectType && projectType !== 'mod') ? projectType : (fileName.includes('data') ? 'datapack' : 'resourcepack')
                    }
                }

                // Try to read shaders.properties or check folder name for Shaders
                // Try to read shaders.properties or check filename for Shaders
                if (projectType === 'shader' || fileName.includes('shader')) {
                    return {
                        id: fileName,
                        name: fileName.replace(/\.zip$/, '').replace(/_/g, ' '),
                        author: 'Unknown',
                        version: 'local',
                        fileName: fileName,
                        enabled: true,
                        source: 'local',
                        projectType: 'shader'
                    }
                }
            } catch (readErr) {
                Logger.warn(`[Metadata] Failed to read specifics for ${fileName}: ${readErr}`)
            }
        }

        // 5. Final Fallback
        return {
            id: `local-${fileName}`,
            name: fileName.replace(/\.(jar|zip)$/, '').replace(/[_-]/g, ' '),
            author: 'Unknown',
            version: 'local',
            fileName: fileName,
            enabled: true,
            source: 'local',
            projectType: projectType
        }
    } catch (err) {
        Logger.error(`[Metadata] General error in getLocalMetadata for ${fileName}: ${err}`)
        return {
            id: `local-${fileName}`,
            name: fileName,
            author: 'Unknown',
            version: 'local',
            fileName: fileName,
            enabled: true,
            source: 'local',
            projectType: projectType
        }
    }
}

/**
 * Helper to scan a folder and update metadata
 */
/**
 * Helper to scan a folder and update metadata
 */
async function scanFolderForContent(instanceId: string, instancePath: string, folderName: string, projectType: string) {
    const targetDir = path.join(instancePath, folderName)
    if (!fs.existsSync(targetDir)) return

    const files = fs.readdirSync(targetDir)
    const validFiles = files.filter(fileName => {
        const filePath = path.join(targetDir, fileName)
        if (fs.statSync(filePath).isDirectory()) return false
        if (fileName === 'desktop.ini' || fileName === '.DS_Store') return false
        return true
    })

    Logger.info(`[Detect] Scanning ${validFiles.length} files in ${folderName} with 2-concurrency...`)

    const concurrency = 2
    const queue = [...validFiles]
    const totalFiles = queue.length
    let processed = 0
    const results: any[] = []

    // Reset progress for this folder
    sendProgress({
        type: 'detect',
        current: 0,
        total: totalFiles,
        percentage: 0,
        filename: `Starting scan for ${folderName}...`
    })

    const workers = Array(Math.min(concurrency, queue.length)).fill(null).map(async () => {
        while (queue.length > 0) {
            const fileName = queue.shift()!
            const filePath = path.join(targetDir, fileName)

            try {
                const metadata = await getLocalMetadata(filePath, fileName, projectType)
                results.push(metadata)
            } catch (err) {
                Logger.error(`[Detect] Error scanning ${fileName}: ${err}`)
            } finally {
                processed++
                sendProgress({
                    type: 'detect',
                    current: processed,
                    total: totalFiles,
                    percentage: Math.round((processed / totalFiles) * 100),
                    filename: `Scanned ${fileName} (${processed}/${totalFiles})`
                })
            }
        }
    })

    await Promise.all(workers)

    // Requested log: mod IDs joined
    if (folderName === 'mods' && results.length > 0) {
        Logger.info(`[Detect] Found mod IDs: ${results.filter(m => m.id).map(m => m.id).join(', ')}`)
    }

    // Batch update metadata
    Logger.info(`[Detect] Batch updating ${results.length} metadata entries for ${folderName}...`)
    for (const metadata of results) {
        const finalType = metadata.projectType || projectType
        updateInstanceMetadata(instanceId, finalType, {
            ...metadata,
            enabled: true
        })
    }

    // Notify UI to refresh
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('launcher:instance-updated', { instanceId })
    }
}

/**
 * Detect all installed content for an instance
 */
async function detectInstalledContent(instance: any) {
    const instancePath = instance.path
    if (!instancePath || !fs.existsSync(instancePath)) {
        throw new Error('Instance path does not exist')
    }

    Logger.info(`[Detect] Scanning instance: ${instance.name} (${instancePath})`)

    await scanFolderForContent(instance.id, instancePath, 'mods', 'mod')
    await scanFolderForContent(instance.id, instancePath, 'resourcepacks', 'resourcepack')
    await scanFolderForContent(instance.id, instancePath, 'shaderpacks', 'shader')
    await scanFolderForContent(instance.id, instancePath, 'datapacks', 'datapack')

    return { success: true }
}

/**
 * Toggle content (Mod, Resource Pack, etc.) by moving files
 */
async function toggleContent(instanceId: string, filePath: string, enable: boolean) {
    try {
        const instancesJsonPath = path.join(LPATH, 'instances', 'instances.json')
        if (!fs.existsSync(instancesJsonPath)) throw new Error('instances.json not found')

        const content = fs.readFileSync(instancesJsonPath, 'utf-8')
        const instances = JSON.parse(content)
        const instance = instances.find((i: any) => i.id === instanceId)
        if (!instance) throw new Error('Instance not found')

        const instancePath = instance.path
        if (!instancePath || !fs.existsSync(instancePath)) throw new Error('Instance path not found')

        // Resolve folders
        const modsDir = path.join(instancePath, 'mods')
        const disabledModsDir = path.join(instancePath, 'disabledmods')

        const fileName = path.basename(filePath)

        // Only handle mods for now as requested
        let sourcePath: string
        let destPath: string

        if (enable) {
            // Moving from disabled to enabled
            sourcePath = path.join(disabledModsDir, fileName)
            destPath = path.join(modsDir, fileName)
            if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true })
        } else {
            // Moving from enabled to disabled
            sourcePath = path.join(modsDir, fileName)
            destPath = path.join(disabledModsDir, fileName)
            if (!fs.existsSync(disabledModsDir)) fs.mkdirSync(disabledModsDir, { recursive: true })
        }

        if (fs.existsSync(sourcePath)) {
            fs.renameSync(sourcePath, destPath)
            Logger.success(`[Toggle] Managed file: ${fileName} -> ${enable ? 'Enabled' : 'Disabled'}`)

            // Update instances.json metadata to reflect state
            const allLists = ['mods', 'resourcepacks', 'shaderpacks', 'datapacks']
            allLists.forEach(listName => {
                if (instance[listName]) {
                    const mod = instance[listName].find((m: any) => m.fileName === fileName)
                    if (mod) {
                        mod.enabled = enable
                    }
                }
            })

            fs.writeFileSync(instancesJsonPath, JSON.stringify(instances, null, 2), 'utf-8')
            return { success: true }
        } else {
            // Check if it's already in the destination?
            if (fs.existsSync(destPath)) {
                Logger.info(`[Toggle] File already in target location: ${fileName}`)
                return { success: true }
            }
            throw new Error(`Source file not found: ${sourcePath}`)
        }
    } catch (error) {
        Logger.error(`[Toggle] Failed: ${error}`)
        throw error
    }
}

/**
 * Export instance to .mrpack
 */
async function exportInstance(instanceId: string) {
    try {
        const instancesJsonPath = path.join(LPATH, 'instances', 'instances.json')
        if (!fs.existsSync(instancesJsonPath)) throw new Error('instances.json not found')

        const instances = JSON.parse(fs.readFileSync(instancesJsonPath, 'utf-8'))
        const instance = instances.find((i: any) => i.id === instanceId)
        if (!instance) throw new Error('Instance not found')

        const instancePath = instance.path
        if (!instancePath || !fs.existsSync(instancePath)) throw new Error('Instance path not found')

        // 1. Prompt for save location
        // Note: Using await with dialog.showSaveDialog which returns a promise in Electron
        const { filePath: savePath } = await dialog.showSaveDialog({
            title: 'Export instance as .mrpack',
            defaultPath: path.join(app.getPath('downloads'), `${instance.name}.mrpack`),
            filters: [{ name: 'Modrinth Modpack', extensions: ['mrpack'] }]
        })

        if (!savePath) return { success: false, error: 'Export cancelled' }

        Logger.info(`[Export] Starting export for ${instance.name}...`)

        const zip = new AdmZip()
        const manifest: any = {
            formatVersion: 1,
            game: 'minecraft',
            versionId: `1.0.0-${Date.now()}`,
            name: instance.name,
            summary: instance.description || `Exported from ReaLauncher`,
            files: [],
            dependencies: {
                minecraft: instance.version
            }
        }

        // Add loader dependency
        if (instance.loader) {
            const loaderIdMap: Record<string, string> = {
                'fabric': 'fabric-loader',
                'forge': 'forge',
                'neoforge': 'neoforge',
                'quilt': 'quilt-loader'
            }
            const loaderId = loaderIdMap[instance.loader.type] || instance.loader.type
            manifest.dependencies[loaderId] = instance.loader.version
        }

        // 2. Process mods and other files
        const modsDir = path.join(instancePath, 'mods')
        if (fs.existsSync(modsDir)) {
            const files = fs.readdirSync(modsDir)
            for (const file of files) {
                const filePath = path.join(modsDir, file)
                if (fs.statSync(filePath).isDirectory()) continue

                // Find metadata if available
                const metadata = (instance.mods || []).find((m: any) => m.fileName === file)

                if (metadata && metadata.source === 'modrinth' && metadata.id) {
                    // It's a Modrinth mod, add to files array for downloading
                    try {
                        const sha1 = await getFileHash(filePath)
                        const sha512 = await getFileHashSha512(filePath)
                        const fileSize = fs.statSync(filePath).size

                        // We need the download URL. If we don't have it, we put it in overrides.
                        if (metadata.downloadUrl) {
                            manifest.files.push({
                                path: `mods/${file}`,
                                hashes: { sha1, sha512 },
                                downloads: [metadata.downloadUrl],
                                fileSize
                            })
                            continue
                        }
                    } catch (e) {
                        Logger.warn(`[Export] Failed to add mod ${file} to files list, adding to overrides: ${e}`)
                    }
                }

                // If not added to files, add to overrides
                zip.addLocalFile(filePath, 'overrides/mods')
            }
        }

        // Also check disabled mods
        const disabledModsDir = path.join(instancePath, 'disabledmods')
        if (fs.existsSync(disabledModsDir)) {
            const files = fs.readdirSync(disabledModsDir)
            for (const file of files) {
                const filePath = path.join(disabledModsDir, file)
                if (fs.statSync(filePath).isDirectory()) continue
                // Disabled mods always go to overrides
                zip.addLocalFile(filePath, 'overrides/disabledmods')
            }
        }

        // 3. Add other important folders to overrides
        const foldersToOverride = ['config', 'resourcepacks', 'shaderpacks', 'scripts']
        for (const folder of foldersToOverride) {
            const folderPath = path.join(instancePath, folder)
            if (fs.existsSync(folderPath)) {
                zip.addLocalFolder(folderPath, `overrides/${folder}`)
            }
        }

        // 4. Add manifest and save
        zip.addFile('modrinth.index.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'))
        zip.writeZip(savePath)

        Logger.success(`[Export] Instance exported to ${savePath}`)
        return { success: true, path: savePath }
    } catch (error) {
        Logger.error(`[Export] Failed: ${error}`)
        return { success: false, error: String(error) }
    }
}


/**
 * Install content (Mod, Resource Pack, Shader)
 */
async function installContent(project: any, instance: any) {
    try {
        const projectId = project.project_id
        const projectType = project.project_type
        const gameVersion = instance.version
        const loader = instance.loader?.type

        Logger.info(`[Install] Installing ${project.title} (${projectType}) for ${gameVersion} ${loader || ''}`)

        // Special handling for modpacks
        if (projectType === 'modpack') {
            return await installModpack(projectId, project.title, instance)
        }

        let bestVersion: any
        let file: any
        let source = project.source || (project.project_id.startsWith('cf-') ? 'curseforge' : 'modrinth')
        const cleanId = projectId.replace(/^(cf|mr)-/, '')

        if (source === 'curseforge') {
            throw new Error('CurseForge single content install not yet implemented in backend')
        } else {
            const params: any = {
                game_versions: JSON.stringify([gameVersion])
            }
            if (projectType === 'mod' && loader) {
                params.loaders = JSON.stringify([loader])
            }

            const versionsResponse = await axios.get(`https://api.modrinth.com/v2/project/${cleanId}/version`, { params })
            const versions = versionsResponse.data as any[]

            if (!versions || versions.length === 0) {
                throw new Error(`No compatible version found for Minecraft ${gameVersion}${loader ? ' and ' + loader : ''}`)
            }

            bestVersion = versions[0]
            file = bestVersion.files.find((f: any) => f.primary) || bestVersion.files[0]
        }

        if (!file) {
            throw new Error('No file found for the selected version')
        }

        let instancePath = instance.path
        if (!instancePath) {
            const sanitizedName = minecraftLauncher.sanitizeInstanceName(instance.name)
            instancePath = path.join(LPATH, 'instances', sanitizedName)
        }

        let targetFolder = 'mods'
        if (projectType === 'resourcepack') targetFolder = 'resourcepacks'
        else if (projectType === 'shader') targetFolder = 'shaderpacks'

        const downloadDir = path.join(instancePath, targetFolder)
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true })
        }

        const filePath = path.join(downloadDir, file.filename)

        Logger.info(`[Install] Downloading to ${filePath}`)
        const response = await axios({
            method: 'GET',
            url: file.url,
            responseType: 'stream'
        })

        const writer = fs.createWriteStream(filePath)
            ; (response.data as any).pipe(writer)

        return new Promise((resolve, reject) => {
            writer.on('finish', async () => {
                try {
                    // Hash Verification
                    if (file.hashes && file.hashes.sha1) {
                        sendProgress({ type: 'hash', current: 0, total: 100, percentage: 0, filename: file.filename })

                        // Fake progress for small files to show the bar
                        sendProgress({ type: 'hash', current: 50, total: 100, percentage: 50, filename: file.filename })

                        const calculatedHash = await getFileHash(filePath)
                        if (calculatedHash !== file.hashes.sha1) {
                            sendProgress({ type: 'hash', current: 100, total: 100, percentage: 100, filename: `Mismatch: ${file.filename}` }) // Error state?
                            Logger.error(`[Install] Hash mismatch for ${file.filename}. Expected: ${file.hashes.sha1}, Got: ${calculatedHash}`)
                            throw new Error(`Hash mismatch for ${file.filename}`)
                        }
                        Logger.info(`[Install] Hash for ${file.filename}//${calculatedHash}`)
                        Logger.success(`[Install] Verified ${file.filename}`)
                        sendProgress({ type: 'hash', current: 100, total: 100, percentage: 100, filename: file.filename })
                    }

                    updateInstanceMetadata(instance.id, projectType, {
                        id: projectId,
                        name: project.title,
                        author: project.author || 'Unknown',
                        authors: [{ name: project.author || 'Unknown', id: project.author || 'Unknown' }],
                        version: bestVersion.version_number,
                        fileName: file.filename,
                        enabled: true,
                        source: source,
                        slug: project.slug,
                        authorId: project.author,
                        iconUrl: project.icon_url,
                        categories: project.categories,
                        projectType: project.project_type
                    })
                    resolve({ success: true, path: filePath, version: bestVersion.version_number })
                } catch (err) {
                    Logger.error(`[Install] Failed to update metadata: ${err}`)
                    resolve({ success: true, path: filePath, version: bestVersion.version_number, warning: 'Failed to update metadata' })
                }
            })
            writer.on('error', reject)
        })
    } catch (error) {
        Logger.error(`Install failed: ${error}`)
        throw error
    }
}

/**
 * Install a modpack (.mrpack file)
 */
async function installModpack(projectId: string, projectTitle: string, instance: any) {
    try {
        const sanitizedName = minecraftLauncher.sanitizeInstanceName(instance.name)
        const instancePath = instance.path || path.join(LPATH, 'instances', sanitizedName)

        if (!fs.existsSync(TEMP_PATH)) {
            fs.mkdirSync(TEMP_PATH, { recursive: true })
        }

        const versionsResponse = await axios.get(`https://api.modrinth.com/v2/project/${projectId}/version`)
        const versions = versionsResponse.data as any[]

        if (!versions || versions.length === 0) {
            throw new Error('No versions found for this modpack')
        }

        const latestVersion = versions[0]
        const mrpackFile = latestVersion.files.find((f: any) => f.filename.endsWith('.mrpack'))

        if (!mrpackFile) {
            throw new Error('No .mrpack file found in the version')
        }

        const mrpackPath = path.join(TEMP_PATH, `${projectId}.mrpack`)
        Logger.info(`[Modpack] Downloading ${mrpackFile.filename}...`)

        const response = await axios({
            method: 'GET',
            url: mrpackFile.url,
            responseType: 'stream'
        })

        const writer = fs.createWriteStream(mrpackPath)
        const totalSize = parseInt(response.headers['content-length'] || '0', 10)
        let downloaded = 0

        await new Promise<void>((resolve, reject) => {
            const stream = response.data as any
            stream.on('data', (chunk: any) => {
                downloaded += chunk.length
                if (totalSize > 0) {
                    const pct = Math.round((downloaded / totalSize) * 100)
                    sendProgress({ type: 'modpack', current: downloaded, total: totalSize, percentage: pct, filename: 'Downloading .mrpack' })
                }
            })
            stream.pipe(writer)
            writer.on('finish', () => resolve())
            writer.on('error', reject)
        })

        const zip = new AdmZip(mrpackPath)
        const extractPath = path.join(TEMP_PATH, `extract_${projectId}`)
        zip.extractAllTo(extractPath, true)

        const manifestPath = path.join(extractPath, 'modrinth.index.json')
        if (!fs.existsSync(manifestPath)) {
            throw new Error('modrinth.index.json not found in modpack')
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        Logger.info(`[Modpack] Manifest loaded. ${manifest.files?.length || 0} files to download`)

        try {
            const projectResponse = await axios.get(`https://api.modrinth.com/v2/project/${projectId}`)
            const project = projectResponse.data as any
            const instancesJsonPath = path.join(LPATH, 'instances', 'instances.json')
            if (fs.existsSync(instancesJsonPath) && project) {
                const instances = JSON.parse(fs.readFileSync(instancesJsonPath, 'utf-8'))
                const idx = instances.findIndex((i: any) => i.id === instance.id)
                if (idx !== -1) {
                    instances[idx].name = project.title || projectTitle
                    instances[idx].iconUrl = project.icon_url

                    // Parse dependencies from manifest to set Game Version and Loader
                    if (manifest.dependencies) {
                        const gameVersion = manifest.dependencies.minecraft
                        const fabricVersion = manifest.dependencies['fabric-loader']
                        const forgeVersion = manifest.dependencies['forge'] || manifest.dependencies['neoforge']
                        const quiltVersion = manifest.dependencies['quilt-loader']

                        if (gameVersion) {
                            instances[idx].version = gameVersion
                        }

                        if (fabricVersion) {
                            instances[idx].loader = { type: 'fabric', version: fabricVersion }
                        } else if (forgeVersion) {
                            instances[idx].loader = { type: 'forge', version: forgeVersion }
                        } else if (quiltVersion) {
                            instances[idx].loader = { type: 'quilt', version: quiltVersion }
                        }
                    }

                    fs.writeFileSync(instancesJsonPath, JSON.stringify(instances, null, 2), 'utf-8')
                }
            }
        } catch (nameErr) {
            Logger.warn(`[Modpack] Failed to update instance name/icon: ${nameErr}`)
        }

        const files = manifest.files || []
        // SERIAL INSTALLATION: processing 1 file at a time to ensure metadata updates don't race
        const chunkSize = 1
        const modsDir = path.join(instancePath, 'mods')
        fs.mkdirSync(modsDir, { recursive: true })

        for (let i = 0; i < files.length; i += chunkSize) {
            const chunk = files.slice(i, i + chunkSize)
            // Even though chunk size is 1, keeping the structure generic
            await Promise.all(chunk.map(async (file: any) => {
                try {
                    // Overall Modpack Progress (using 'hash' type as requested for "Checking Hash" phase)
                    // The loop handles both download and verification, so we use this as the main progress
                    const pct = Math.round(((i + 1) / files.length) * 100)
                    const filename = file.path.split('/').pop()

                    sendProgress({ type: 'hash', current: i + 1, total: files.length, percentage: pct, filename: `Verifying ${filename}` })

                    const downloadUrl = file.downloads?.[0]
                    if (!downloadUrl) return


                    const relativeDir = file.path.split('/').slice(0, -1).join('/')
                    const targetDir = path.join(instancePath, relativeDir) // relativeDir might be empty, effectively modsDir if path is just filename

                    // Correctly handle subdirectories if specified in file.path (common in some packs)
                    // If file.path starts with 'mods/', relativeDir handles it. 
                    // However, we want to ensure everything goes into the right place.
                    // The manifest paths usually conform to the root of the instance.

                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true })
                    }

                    const targetPath = path.join(targetDir, filename)

                    const modResponse = await axios({
                        method: 'GET',
                        url: downloadUrl,
                        responseType: 'stream'
                    })

                    const modWriter = fs.createWriteStream(targetPath)
                    await new Promise<void>((resolve, reject) => {
                        (modResponse.data as any).pipe(modWriter)
                        modWriter.on('finish', () => resolve())
                        modWriter.on('error', reject)
                    })

                    // Hash Verification
                    if (file.hashes && file.hashes.sha1) {
                        const calculatedHash = await getFileHash(targetPath)
                        if (calculatedHash !== file.hashes.sha1) {
                            sendProgress({ type: 'hash', current: 100, total: 100, percentage: 100, filename: `Mismatch: ${filename}` })
                            throw new Error(`Hash mismatch for ${filename}. Expected: ${file.hashes.sha1}, Got: ${calculatedHash}`)
                        }
                        Logger.debug(`[Modpack] Verified ${filename}`)
                    }

                    // Determine projectType from path
                    const projectType = file.path.startsWith('resourcepacks/') ? 'resourcepack' :
                        file.path.startsWith('shaderpacks/') ? 'shader' :
                            file.path.startsWith('datapacks/') ? 'datapack' : 'mod'

                    // Use getLocalMetadata to fetch rich metadata using the hash/file we just verified
                    // This ensures consistency with the detection system (user request)
                    const metadata = await getLocalMetadata(targetPath, filename, projectType)

                    // Update Metadata with the rich info
                    updateInstanceMetadata(instance.id, projectType || 'mod', {
                        ...metadata, // Use properties from getLocalMetadata (id, name, author, etc.)
                        id: file.projectID || metadata.id || filename, // Prefer projectID if available from manifest
                        enabled: true,
                        source: 'modpack'
                    })

                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('launcher:instance-updated', { instanceId: instance.id })
                    }
                } catch (error) {
                    Logger.error(`[Modpack] File download failed: ${file.path} ${error}`)
                }
            }))
        }

        // Handle Overrides (Configs, Scripts, etc.)
        const overridesPath = path.join(extractPath, 'overrides')
        if (fs.existsSync(overridesPath)) {
            Logger.info(`[Modpack] Copying overrides...`)
            copyFolderRecursive(overridesPath, instancePath)
            Logger.info(`[Modpack] Overrides copied successfully.`)
        } else {
            // Some modpacks might use 'client-overrides' or similar, but standard is 'overrides'
            Logger.debug(`[Modpack] No overrides folder found.`)
        }

        return { success: true, modCount: files.length }

    } catch (error) {
        Logger.error(`[Modpack] Installation failed: ${error}`)
        throw error
    }
}

/**
 * Recursively copy folder contents
 */
function copyFolderRecursive(source: string, target: string) {
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true })
    }

    const items = fs.readdirSync(source, { withFileTypes: true })
    for (const item of items) {
        const sourcePath = path.join(source, item.name)
        const targetPath = path.join(target, item.name)

        if (item.isDirectory()) {
            copyFolderRecursive(sourcePath, targetPath)
        } else {
            fs.copyFileSync(sourcePath, targetPath)
        }
    }
}

/**
 * Download and install Java using the "Modrinth Flow" (Zulu ZIP)
 */
async function installSpecificJava(majorVersion: number): Promise<string> {
    const zuluVersions: Record<number, string> = {
        8: 'zulu8.90.0.19-ca-jre8.0.472-win_x64',
        17: 'zulu17.62.17-ca-jre17.0.17-win_x64',
        21: 'zulu21.46.19-ca-jre21.0.9-win_x64',
        25: 'zulu25.30.17-ca-jre25.0.1-win_x64'
    }

    const versionString = zuluVersions[majorVersion] || zuluVersions[21]
    const installTargetDir = path.join(JAVA_STORAGE_PATH, versionString)
    const javaExePath = path.join(installTargetDir, 'bin', 'java.exe')

    if (fs.existsSync(javaExePath)) {
        return javaExePath
    }

    sendProgress({ type: 'java', current: 0, total: 100, percentage: 0, filename: `Downloading Java ${majorVersion} (Zulu)...` })

    try {
        const downloadUrl = `https://cdn.azul.com/zulu/bin/${versionString}.zip`
        if (!fs.existsSync(TEMP_PATH)) {
            fs.mkdirSync(TEMP_PATH, { recursive: true })
        }
        const zipFile = path.join(TEMP_PATH, `${versionString}.zip`)

        // 1. Download Zulu ZIP
        const response = await axios.get<any>(downloadUrl, {
            responseType: 'stream'
        })

        const totalLength = parseInt(response.headers['content-length'] || '0', 10)
        let downloadedLength = 0

        const writer = fs.createWriteStream(zipFile)

        await new Promise((resolve, reject) => {
            response.data.on('data', (chunk: Buffer) => {
                downloadedLength += chunk.length
                if (totalLength > 0) {
                    const percentCompleted = Math.round((downloadedLength * 100) / totalLength)
                    sendProgress({
                        type: 'java',
                        current: downloadedLength,
                        total: totalLength,
                        percentage: percentCompleted,
                        filename: `Downloading ${versionString}.zip`
                    })
                }
            })

            response.data.pipe(writer)
            let error: any = null
            writer.on('error', err => { error = err; writer.close(); reject(err) })
            writer.on('close', () => { if (!error) resolve(true) })
        })

        // 2. Extract ZIP
        sendProgress({ type: 'java', current: 0, total: 100, percentage: 90, filename: `Extracting Java ${majorVersion}...` })

        const zip = new AdmZip(zipFile)
        zip.extractAllTo(JAVA_STORAGE_PATH, true)

        if (!fs.existsSync(javaExePath)) {
            throw new Error(`Extraction completed but java.exe was not found at ${javaExePath}.`)
        }

        sendProgress({ type: 'java', current: 100, total: 100, percentage: 100, filename: 'Java installed successfully' })
        return javaExePath
    } catch (error) {
        console.error('Java installation failed:', error)
        throw error
    }
}

/**
 * Get recommended Java version for Minecraft version
 */
function getJavaVersionForMinecraft(mcVersion: string): number {
    const parts = mcVersion.split('.').map(Number)
    const [_, minor] = parts[0] === 1 ? [parts[0], parts[1] || 0] : [parts[0], 0]

    if (minor >= 21) return 21
    if (minor >= 17) return 17
    return 8
}

/**
 * Prepare custom version directory and manifest
 * Returns the version ID to use for launch
 */
export async function prepareCustomVersion(config: LaunchConfig): Promise<string> {
    const { version, loader } = config

    if (!loader) return version

    const customId = `${version}-${loader.type}-${loader.version}`
    const versionDir = path.join(VERSIONS_PATH, customId)
    const versionJsonPath = path.join(versionDir, `${customId}.json`)

    if (fs.existsSync(versionJsonPath)) {
        return customId
    }

    console.log(`[Version] Preparing custom version: ${customId}`)
    ensureDirectories()

    try {
        await downloadVanillaVersion(version)
    } catch (e) {
        console.error(`[Version] Failed to download base vanilla version ${version}:`, e)
    }

    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })

    try {
        let manifest: any = null

        if (loader.type === 'neoforge') {
            return await installNeoForge(version, loader.version)
        }

        if (loader.type === 'forge') {
            return await installForge(version, loader.version)
        }

        if (loader.type === 'fabric') {
            sendProgress({ type: 'loader', current: 0, total: 100, percentage: 0, filename: `Preparing Fabric ${loader.version}...` })
            const url = `https://meta.fabricmc.net/v2/versions/loader/${version}/${loader.version}/profile/json`
            const res = await axios.get(url)
            manifest = res.data
            sendProgress({ type: 'loader', current: 50, total: 100, percentage: 50, filename: `Downloaded Fabric Manifest` })
        } else if (loader.type === 'quilt') {
            sendProgress({ type: 'loader', current: 0, total: 100, percentage: 0, filename: `Preparing Quilt ${loader.version}...` })
            const url = `https://meta.quiltmc.org/v3/versions/loader/${version}/${loader.version}/profile/json`
            const res = await axios.get(url)
            manifest = res.data
            sendProgress({ type: 'loader', current: 50, total: 100, percentage: 50, filename: `Downloaded Quilt Manifest` })
        } else if (loader.type === 'legacy-fabric') {
            sendProgress({ type: 'loader', current: 0, total: 100, percentage: 0, filename: `Preparing Legacy Fabric ${loader.version}...` })
            const url = `https://meta.legacyfabric.net/v2/versions/loader/${version}/${loader.version}/profile/json`
            const res = await axios.get(url)
            manifest = res.data
            sendProgress({ type: 'loader', current: 50, total: 100, percentage: 50, filename: `Downloaded Legacy Fabric Manifest` })
        }

        if (!manifest) {
            console.warn('[Version] Custom version generation not supported for this loader type, falling back to version.')
            return version
        }

        if (manifest.id) manifest.id = customId
        fs.writeFileSync(versionJsonPath, JSON.stringify(manifest, null, 2))

        const customJarPath = path.join(versionDir, `${customId}.jar`)
        if (!fs.existsSync(customJarPath)) {
            let loaderLib: any = null
            if (loader.type === 'fabric') loaderLib = manifest.libraries.find((l: any) => l.name.startsWith('net.fabricmc:fabric-loader'))
            else if (loader.type === 'quilt') loaderLib = manifest.libraries.find((l: any) => l.name.startsWith('org.quiltmc:quilt-loader'))
            else if (loader.type === 'legacy-fabric') loaderLib = manifest.libraries.find((l: any) => l.name.startsWith('net.legacyfabric:fabric-loader'))

            if (loaderLib) {
                const parts = loaderLib.name.split(':')
                const [group, artifact, ver] = parts
                const mavenPath = `${group.replace(/\./g, '/')}/${artifact}/${ver}/${artifact}-${ver}.jar`
                const baseUrl = loaderLib.url || (loader.type === 'quilt' ? 'https://maven.quiltmc.org/repository/release/' : 'https://maven.fabricmc.net/')
                try {
                    sendProgress({ type: 'loader', current: 75, total: 100, percentage: 75, filename: `Downloading Loader JAR...` })
                    const res = await axios.get(`${baseUrl}${mavenPath}`, { responseType: 'arraybuffer' })
                    fs.writeFileSync(customJarPath, Buffer.from(res.data as any))
                    sendProgress({ type: 'loader', current: 100, total: 100, percentage: 100, filename: `Loader installed successfully` })
                } catch (e) {
                    const baseJarPath = path.join(VERSIONS_PATH, version, `${version}.jar`)
                    if (fs.existsSync(baseJarPath)) fs.copyFileSync(baseJarPath, customJarPath)
                    sendProgress({ type: 'loader', current: 100, total: 100, percentage: 100, filename: `Loader prepared (fallback)` })
                }
            } else {
                const baseJarPath = path.join(VERSIONS_PATH, version, `${version}.jar`)
                if (fs.existsSync(baseJarPath)) fs.copyFileSync(baseJarPath, customJarPath)
            }
        }
        return customId
    } catch (error) {
        console.error('[Version] Failed to prepare custom version:', error)
        return version
    }
}

async function installNeoForge(minecraftVersion: string, neoforgeVersion: string): Promise<string> {
    console.log(`[NeoForge] Installing NeoForge ${neoforgeVersion} for MC ${minecraftVersion}...`)
    const javaVersion = getJavaVersionForMinecraft(minecraftVersion)
    const javaPath = await installSpecificJava(javaVersion)

    const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoforgeVersion}/neoforge-${neoforgeVersion}-installer.jar`
    const installerPath = path.join(TEMP_PATH, `neoforge-${neoforgeVersion}-installer.jar`)

    console.log(`[NeoForge] Downloading installer from ${installerUrl}`)
    sendProgress({ type: 'loader', current: 0, total: 100, percentage: 0, filename: `Downloading NeoForge Installer ${neoforgeVersion}` })

    try {
        const response = await axios({
            method: 'GET',
            url: installerUrl,
            responseType: 'stream'
        })

        const totalLength = parseInt(response.headers['content-length'] || '0', 10)
        let downloadedLength = 0

        const writer = fs.createWriteStream(installerPath)
        await new Promise((resolve, reject) => {
            const stream = response.data as any
            stream.on('data', (chunk: any) => {
                downloadedLength += chunk.length
                if (totalLength > 0) {
                    const percentage = Math.round((downloadedLength / totalLength) * 50) // 0-50%
                    sendProgress({ type: 'loader', current: downloadedLength, total: totalLength, percentage, filename: `Downloading Installer...` })
                }
            })
            stream.pipe(writer)
            writer.on('close', () => resolve(true))
            writer.on('error', reject)
        })
    } catch (error) {
        throw new Error(`Failed to download NeoForge installer: ${error}`)
    }

    sendProgress({ type: 'loader', current: 0, total: 100, percentage: 50, filename: `Running NeoForge Installer...` })

    // Ensure launcher_profiles.json exists (required by installer)
    const profilesPath = path.join(META_PATH, 'launcher_profiles.json')
    if (!fs.existsSync(profilesPath)) {
        fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {} }))
    }

    const versionsBefore = fs.readdirSync(VERSIONS_PATH)

    await new Promise((resolve, reject) => {
        const proc = spawn(javaPath, ['-jar', installerPath, '--installClient', META_PATH])

        proc.stdout.on('data', (data) => {
            const line = data.toString()
            console.log(`[NeoForge Install] ${line}`)

            // Parse progress from logs if possible
            if (line.includes('Processor')) {
                const match = line.match(/Processor (\d+)\/(\d+)/)
                if (match) {
                    const current = parseInt(match[1])
                    const total = parseInt(match[2])
                    const percentage = 50 + Math.round((current / total) * 50)
                    sendProgress({ type: 'loader', current, total, percentage, filename: `Installing (Processor ${current}/${total})...` })
                }
            } else if (line.includes('Downloading libraries')) {
                sendProgress({ type: 'loader', current: 0, total: 100, percentage: 55, filename: `Installing Libraries...` })
            }
        })

        proc.stderr.on('data', (data) => console.error(`[NeoForge Install Error] ${data}`))
        proc.on('close', (code) => {
            if (code === 0) resolve(true)
            else reject(new Error(`NeoForge installer exited with code ${code}`))
        })
    })

    const versionsAfter = fs.readdirSync(VERSIONS_PATH)
    const newVersion = versionsAfter.find(v => !versionsBefore.includes(v) && v.includes('neoforge'))
    if (newVersion) return newVersion

    const found = versionsAfter.find(v => v.includes('neoforge') && v.includes(neoforgeVersion))
    return found || `neoforge-${neoforgeVersion}`
}

async function installForge(minecraftVersion: string, forgeVersion: string): Promise<string> {
    console.log(`[Forge] Installing Forge ${forgeVersion} for MC ${minecraftVersion}...`)
    const javaVersion = getJavaVersionForMinecraft(minecraftVersion)
    const javaPath = await installSpecificJava(javaVersion)

    // Ensure version string includes MC version (standard Forge format: MC-Forge)
    const fullVersion = forgeVersion.startsWith(minecraftVersion)
        ? forgeVersion
        : `${minecraftVersion}-${forgeVersion}`

    const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-installer.jar`
    const installerPath = path.join(TEMP_PATH, `forge-${fullVersion}-installer.jar`)

    console.log(`[Forge] Downloading installer from ${installerUrl}`)
    sendProgress({ type: 'loader', current: 0, total: 100, percentage: 0, filename: `Downloading Forge Installer ${fullVersion}` })

    try {
        const response = await axios({ method: 'GET', url: installerUrl, responseType: 'stream' })

        const totalLength = parseInt(response.headers['content-length'] || '0', 10)
        let downloadedLength = 0

        const writer = fs.createWriteStream(installerPath)
        await new Promise((resolve, reject) => {
            const stream = response.data as any
            stream.on('data', (chunk: any) => {
                downloadedLength += chunk.length
                if (totalLength > 0) {
                    const percentage = Math.round((downloadedLength / totalLength) * 50) // 0-50%
                    sendProgress({ type: 'loader', current: downloadedLength, total: totalLength, percentage, filename: `Downloading Installer...` })
                }
            })
            stream.pipe(writer)
            writer.on('close', () => resolve(true))
            writer.on('error', reject)
        })
    } catch (error) {
        throw new Error(`Failed to download Forge installer: ${error}`)
    }

    sendProgress({ type: 'loader', current: 0, total: 100, percentage: 50, filename: `Running Forge Installer...` })

    // Ensure launcher_profiles.json exists (required by installer)
    const profilesPath = path.join(META_PATH, 'launcher_profiles.json')
    if (!fs.existsSync(profilesPath)) {
        fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {} }))
    }

    const versionsBefore = fs.readdirSync(VERSIONS_PATH)

    await new Promise((resolve, reject) => {
        const proc = spawn(javaPath, ['-jar', installerPath, '--installClient', META_PATH])
        proc.stdout.on('data', (data) => {
            const line = data.toString()
            if (line.includes('Processor')) {
                const match = line.match(/Processor (\d+)\/(\d+)/)
                if (match) {
                    const cur = parseInt(match[1]), tot = parseInt(match[2])
                    sendProgress({ type: 'loader', current: cur, total: tot, percentage: 50 + Math.round((cur / tot) * 50), filename: `Installing Forge...` })
                }
            }
        })
        proc.on('close', (code) => code === 0 ? resolve(true) : reject(new Error(`Exit ${code}`)))
    })

    const versionsAfter = fs.readdirSync(VERSIONS_PATH)
    const newVersion = versionsAfter.find(v => !versionsBefore.includes(v) && v.includes('forge'))
    if (newVersion) return newVersion

    const found = versionsAfter.find(v => v.includes('forge') && v.includes(forgeVersion))
    return found || fullVersion.replace('-', '-forge-')
}

/**
 * Ensure vanilla version JSON and JAR are present
 */
export async function downloadVanillaVersion(versionId: string) {
    const versionDir = path.join(VERSIONS_PATH, versionId)
    const jsonPath = path.join(versionDir, `${versionId}.json`)
    const jarPath = path.join(versionDir, `${versionId}.jar`)

    if (fs.existsSync(jsonPath) && fs.existsSync(jarPath)) return

    const manifestUrl = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'
    const manifestRes = await axios.get(manifestUrl)
    const versionEntry = (manifestRes.data as any).versions.find((v: any) => v.id === versionId)

    if (!versionEntry) throw new Error(`Vanilla version ${versionId} not found`)

    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })

    if (!fs.existsSync(jsonPath)) {
        const jsonRes = await axios.get(versionEntry.url)
        fs.writeFileSync(jsonPath, JSON.stringify(jsonRes.data, null, 2))
    }

    if (!fs.existsSync(jarPath)) {
        const versionJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
        const clientDownload = versionJson.downloads?.client

        if (clientDownload?.url) {
            sendProgress({ type: 'minecraft', current: 0, total: 100, percentage: 0, filename: `Downloading Minecraft ${versionId}` })
            const response = await axios({ method: 'GET', url: clientDownload.url, responseType: 'stream' })
            const totalLength = parseInt(response.headers['content-length'] || '0', 10)
            let downloadedLength = 0
            const writer = fs.createWriteStream(jarPath)

            await new Promise((resolve, reject) => {
                const stream = response.data as any
                stream.on('data', (chunk: Buffer) => {
                    downloadedLength += chunk.length
                    if (totalLength > 0) {
                        sendProgress({
                            type: 'minecraft',
                            current: downloadedLength,
                            total: totalLength,
                            percentage: Math.round((downloadedLength * 100) / totalLength),
                            filename: `Downloading Minecraft ${versionId} jar`
                        })
                    }
                })
                stream.pipe(writer)
                writer.on('close', () => resolve(true))
                writer.on('error', reject)
            })
            sendProgress({ type: 'minecraft', current: 100, total: 100, percentage: 100, filename: `Ready` })
        }
    }
}

/**
 * Merge custom version manifest with its inherited base version
 */
async function mergeVersionManifests(customVersionId: string): Promise<any> {
    const customManifestPath = path.join(VERSIONS_PATH, customVersionId, `${customVersionId}.json`)
    if (!fs.existsSync(customManifestPath)) throw new Error(`Manifest not found: ${customVersionId}`)

    const customManifest = JSON.parse(fs.readFileSync(customManifestPath, 'utf-8'))
    if (!customManifest.inheritsFrom) return customManifest

    const baseManifestPath = path.join(VERSIONS_PATH, customManifest.inheritsFrom, `${customManifest.inheritsFrom}.json`)
    if (!fs.existsSync(baseManifestPath)) throw new Error(`Base manifest not found: ${customManifest.inheritsFrom}`)

    const baseManifest = JSON.parse(fs.readFileSync(baseManifestPath, 'utf-8'))
    const merged = { ...baseManifest, ...customManifest }
    merged.libraries = [...(baseManifest.libraries || []), ...(customManifest.libraries || [])]

    if (baseManifest.arguments || customManifest.arguments) {
        merged.arguments = {
            game: [...(baseManifest.arguments?.game || []), ...(customManifest.arguments?.game || [])],
            jvm: [...(baseManifest.arguments?.jvm || []), ...(customManifest.arguments?.jvm || [])]
        }
    }

    if (customManifest.mainClass) merged.mainClass = customManifest.mainClass
    return merged
}

/**
 * Launch Minecraft with complete custom implementation
 */
export async function launchMinecraftCustom(config: LaunchConfig): Promise<{ success: boolean; error?: string }> {
    try {
        const launchVersion = await prepareCustomVersion(config)
        const manifest = await mergeVersionManifests(launchVersion)

        let javaPath = config.javaPath
        if (!javaPath) {
            const javaVersion = getJavaVersionForMinecraft(config.version)
            javaPath = await installSpecificJava(javaVersion)
        }

        await downloadMissingLibraries(manifest)
        await downloadMissingAssets(manifest)

        const classpath = buildClasspathFromManifest(manifest, launchVersion)
        const nativesDir = path.join(META_PATH, 'bin', 'natives')

        const jvmArgs = buildJvmArgsFromManifest(manifest, nativesDir, classpath, config.memory, config.instancePath || META_PATH, config.instanceName)
        const gameArgs = buildGameArgsFromManifest(manifest, config, config.instancePath || META_PATH)
        const allArgs = [...jvmArgs, manifest.mainClass, ...gameArgs]

        // Clear natives directory before extraction to avoid conflicts
        if (fs.existsSync(nativesDir)) {
            const files = fs.readdirSync(nativesDir)
            for (const file of files) {
                try { fs.unlinkSync(path.join(nativesDir, file)) } catch (e) { }
            }
        } else {
            fs.mkdirSync(nativesDir, { recursive: true })
        }
        await extractNativesFromLibraries(manifest, nativesDir)

        // Final fallback for LWJGL 3.1.6 on Windows (Legacy Fabric fix)
        if (config.version.includes('1.13') || config.version.includes('1.12')) {
            await downloadLwjglNatives(nativesDir)
        }

        // Check natives directory for critical files
        if (fs.existsSync(nativesDir)) {
            const extractedFiles = fs.readdirSync(nativesDir)
            if (!extractedFiles.some(f => f.toLowerCase().includes('lwjgl.dll'))) {
                Logger.error(`[Launch] lwjgl.dll was NOT found in natives directory!`)
            }
        }

        const minecraftProcess = spawn(javaPath, allArgs, {
            cwd: config.instancePath || META_PATH,
            detached: true,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
        })

        minecraftProcess.unref()

        Logger.info(`[Launch] Starting Minecraft with ${allArgs.length} arguments`)
        console.log(`[Minecraft:${config.instanceId || 'unknown'}] Launching with command: ${javaPath} ${allArgs.join(' ')}`)

        minecraftProcess.stdout?.on('data', (data) => {
            const output = data.toString()
            const trimmed = output.trim()
            if (!trimmed) return

            console.log(`[Minecraft:${config.instanceId || 'unknown'}]`, trimmed)
            if (trimmed.includes('---- Minecraft Crash Report ----') || trimmed.includes('Crash report saved to:')) {
                sendLog('error', trimmed, config.instanceId)
            } else if (trimmed.includes('ERROR') || trimmed.includes('FATAL') || (trimmed.includes('Exception') && !trimmed.includes('Exception: 0'))) {
                sendLog('error', trimmed, config.instanceId)
            } else if (trimmed.includes('WARN')) {
                sendLog('warn', trimmed, config.instanceId)
            } else {
                sendLog('info', trimmed, config.instanceId)
            }

            // Progress detection from logs
            const lines = trimmed.split(/\r?\n/)
            for (const line of lines) {
                // Percentage pattern
                const percentMatch = line.match(/(?:Loading|Progress|Status|Task):\s*(\d{1,3})%/i)
                if (percentMatch) {
                    const percentage = parseInt(percentMatch[1])
                    sendProgress({ type: 'game', current: percentage, total: 100, percentage, filename: line.trim() })
                    continue
                }

                // Step pattern
                const stepMatch = line.match(/Loading\s*\((\d+)\/(\d+)\)/i)
                if (stepMatch) {
                    const current = parseInt(stepMatch[1]), total = parseInt(stepMatch[2])
                    const percentage = Math.round((current / total) * 100)
                    sendProgress({ type: 'game', current, total, percentage, filename: line.trim() })
                }
            }
        })

        minecraftProcess.stderr?.on('data', (data) => {
            const output = data.toString()
            const trimmed = output.trim()
            if (!trimmed) return
            console.error(`[Minecraft Error:${config.instanceId || 'unknown'}]`, trimmed)
            sendLog('error', trimmed, config.instanceId)
        })

        minecraftProcess.on('close', (code) => {
            const msg = `Process closed with code ${code}. Instance: ${config.instanceId || 'unknown'}`
            console.log(`[Minecraft] ${msg}`)
            sendLog(code === 0 ? 'info' : 'error', msg, config.instanceId)
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('launcher:game-closed', {
                    exitCode: code,
                    instanceId: config.instanceId
                })
            }
        })

        if (config.instanceId) {
            console.log(`[Minecraft] Started instance: ${config.instanceId} (${config.instanceName || 'unnamed'})`)
        }

        return { success: true }
    } catch (error) {
        console.error('[CustomLaunch] Launch failed:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown launch error' }
    }
}

/**
 * Download missing libraries to meta/libraries
 */
async function downloadMissingLibraries(manifest: any): Promise<void> {
    if (!manifest.libraries) return
    for (const lib of manifest.libraries) {
        if (lib.rules && !checkRules(lib.rules)) continue

        // Standard artifact
        if (lib.downloads?.artifact) {
            await ensureLibraryDownloaded(path.join(LIBRARIES_PATH, lib.downloads.artifact.path), lib.downloads.artifact.url)
        } else if (lib.name && lib.url) {
            const parts = lib.name.split(':')
            if (parts.length >= 3) {
                const [group, artifact, version] = parts
                const mavenPath = `${group.replace(/\./g, '/')}/${artifact}/${version}/${artifact}-${version}.jar`
                await ensureLibraryDownloaded(path.join(LIBRARIES_PATH, mavenPath), `${lib.url}${mavenPath}`)
            }
        }

        // Native Classifiers
        if (lib.downloads?.classifiers) {
            const osKey = process.platform === 'win32' ? 'windows' :
                process.platform === 'darwin' ? 'osx' : 'linux'

            let nativeKey = lib.natives?.[osKey]
            if (!nativeKey) {
                if (osKey === 'windows' && lib.downloads.classifiers['natives-windows']) nativeKey = 'natives-windows'
                else if (osKey === 'osx' && lib.downloads.classifiers['natives-macos']) nativeKey = 'natives-macos'
                else if (osKey === 'osx' && lib.downloads.classifiers['natives-osx']) nativeKey = 'natives-osx'
                else if (osKey === 'linux' && lib.downloads.classifiers['natives-linux']) nativeKey = 'natives-linux'
            }

            if (nativeKey && lib.downloads.classifiers[nativeKey]) {
                const native = lib.downloads.classifiers[nativeKey]
                await ensureLibraryDownloaded(path.join(LIBRARIES_PATH, native.path), native.url)
            }
        }
    }
}

/**
 * Downloads a library if it doesn't exist
 */
async function ensureLibraryDownloaded(libPath: string, libUrl: string) {
    if (fs.existsSync(libPath) || !libUrl) return

    try {
        const dir = path.dirname(libPath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

        Logger.info(`[Download] Downloading library: ${path.basename(libPath)}`)
        const response = await axios({
            method: 'GET',
            url: libUrl,
            responseType: 'stream'
        })

        const writer = fs.createWriteStream(libPath)
            ; (response.data as any).pipe(writer)

        return new Promise<void>((resolve, reject) => {
            writer.on('finish', () => resolve())
            writer.on('error', (err) => reject(err))
        })
    } catch (err) {
        Logger.error(`[Download] Failed to download library ${path.basename(libPath)}: ${err}`)
    }
}

/**
 * Hard-coded fallback for LWJGL 3.1.6 natives (Windows x64) as requested by user
 */
async function downloadLwjglNatives(nativesDir: string) {
    if (process.platform !== 'win32') return

    const natives = [
        { name: 'lwjgl.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl.dll' },
        { name: 'lwjgl_lmdb.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_lmdb.dll' },
        { name: 'lwjgl_lz4.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_lz4.dll' },
        { name: 'lwjgl_nanovg.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_nanovg.dll' },
        { name: 'lwjgl_nfd.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_nfd.dll' },
        { name: 'lwjgl_nuklear.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_nuklear.dll' },
        { name: 'lwjgl_opengl.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_opengl.dll' },
        { name: 'lwjgl_opengles.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_opengles.dll' },
        { name: 'lwjgl_openvr.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_openvr.dll' },
        { name: 'lwjgl_ovr.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_ovr.dll' },
        { name: 'lwjgl_par.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_par.dll' },
        { name: 'lwjgl_remotery.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_remotery.dll' },
        { name: 'lwjgl_rpmalloc.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_rpmalloc.dll' },
        { name: 'lwjgl_sse.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_sse.dll' },
        { name: 'lwjgl_stb.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_stb.dll' },
        { name: 'lwjgl_tinyexr.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_tinyexr.dll' },
        { name: 'lwjgl_tinyfd.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_tinyfd.dll' },
        { name: 'lwjgl_tootle.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_tootle.dll' },
        { name: 'lwjgl_xxhash.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_xxhash.dll' },
        { name: 'lwjgl_yoga.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_yoga.dll' },
        { name: 'lwjgl_zstd.dll', url: 'https://build.lwjgl.org/release/3.1.6/windows/x64/lwjgl_zstd.dll' }
    ]

    for (const native of natives) {
        const targetPath = path.join(nativesDir, native.name)
        if (!fs.existsSync(targetPath)) {
            Logger.info(`[Launch] Downloading LWJGL fallback native: ${native.name}`)
            try {
                const response = await axios({ method: 'GET', url: native.url, responseType: 'stream' })
                const writer = fs.createWriteStream(targetPath)
                    ; (response.data as any).pipe(writer)
                await new Promise<void>((res, rej) => {
                    writer.on('finish', () => res())
                    writer.on('error', (err) => rej(err))
                })
            } catch (err) {
                Logger.error(`[Launch] Failed to download native fallback ${native.name}: ${err}`)
            }
        }
    }
}

/**
 * Download missing assets to meta/assets
 */
async function downloadMissingAssets(manifest: any): Promise<void> {
    const assetIndex = manifest.assetIndex
    if (!assetIndex) return

    const indexPath = path.join(ASSETS_PATH, 'indexes', `${manifest.assets || assetIndex.id}.json`)
    if (!fs.existsSync(path.dirname(indexPath))) fs.mkdirSync(path.dirname(indexPath), { recursive: true })

    if (!fs.existsSync(indexPath)) {
        const res = await axios.get(assetIndex.url)
        fs.writeFileSync(indexPath, JSON.stringify(res.data))
    }

    const objects = JSON.parse(fs.readFileSync(indexPath, 'utf-8')).objects
    const queue = Object.keys(objects)
    const total = queue.length
    let done = 0

    const workers = Array(10).fill(null).map(async () => {
        while (queue.length > 0) {
            const key = queue.shift()!
            const hash = objects[key].hash
            const subDir = hash.substring(0, 2)
            const assetDir = path.join(ASSETS_PATH, 'objects', subDir)
            const assetPath = path.join(assetDir, hash)

            if (!fs.existsSync(assetPath)) {
                if (!fs.existsSync(assetDir)) fs.mkdirSync(assetDir, { recursive: true })
                try {
                    const res = await axios({ method: 'GET', url: `https://resources.download.minecraft.net/${subDir}/${hash}`, responseType: 'stream' })
                    const writer = fs.createWriteStream(assetPath)
                    const stream = res.data as any
                    stream.pipe(writer)
                    await new Promise<void>((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject) })
                } catch (e) { }
            }
            done++
            if (done % 50 === 0 || done === total) sendProgress({ type: 'assets', current: done, total, percentage: Math.round((done / total) * 100), filename: `Assets (${done}/${total})` })
        }
    })
    await Promise.all(workers)
    // Final progress call to ensure UI reaches 100%
    sendProgress({ type: 'assets', current: total, total, percentage: 100, filename: `Assets (${total}/${total})` })
}

/**
 * Extract native libraries to natives directory
 */
async function extractNativesFromLibraries(manifest: any, nativesDir: string): Promise<void> {
    if (!manifest.libraries) return

    console.log(`[CustomLaunch] Starting natives extraction for ${manifest.libraries?.length || 0} libraries`)
    Logger.info(`[Launch] Starting natives extraction for ${manifest.libraries?.length || 0} libraries`)
    for (const lib of manifest.libraries) {
        Logger.info(`[Launch] Checking lib for natives: ${lib.name}`)
        // Skip if library has rules that don't apply
        if (lib.rules && !checkRules(lib.rules)) {
            Logger.info(`[Launch]   - Skipped by rules`)
            continue
        }

        const osKey = process.platform === 'win32' ? 'windows' :
            process.platform === 'darwin' ? 'osx' : 'linux'

        let nativeKey = lib.natives?.[osKey]
        Logger.info(`[Launch]   - osKey: ${osKey}, initial nativeKey: ${nativeKey}`)

        // Fallback for some manifests that don't have the 'natives' map but have 'classifiers'
        if (!nativeKey && lib.downloads?.classifiers) {
            if (osKey === 'windows' && lib.downloads.classifiers['natives-windows']) nativeKey = 'natives-windows'
            else if (osKey === 'osx' && lib.downloads.classifiers['natives-macos']) nativeKey = 'natives-macos'
            else if (osKey === 'osx' && lib.downloads.classifiers['natives-osx']) nativeKey = 'natives-osx'
            else if (osKey === 'linux' && lib.downloads.classifiers['natives-linux']) nativeKey = 'natives-linux'

            if (nativeKey) Logger.info(`[Launch]   - Used classifier fallback: ${nativeKey}`)
        }

        if (nativeKey && lib.downloads?.classifiers?.[nativeKey]) {
            const nativePath = path.join(LIBRARIES_PATH, lib.downloads.classifiers[nativeKey].path)
            Logger.info(`[Launch] Found native library: ${lib.name} (${nativeKey})`)

            if (fs.existsSync(nativePath)) {
                try {
                    const zip = new AdmZip(nativePath)
                    zip.extractAllTo(nativesDir, true)
                    Logger.info(`[Launch] Extracted natives from ${lib.name}`)
                } catch (error) {
                    Logger.error(`[Launch] Failed to extract native: ${lib.name}`)
                }
            } else {
                Logger.warn(`[Launch] Native jar not found: ${nativePath} for ${lib.name}`)
            }
        }
    }
}

/**
 * Build classpath from manifest libraries
 */
function buildClasspathFromManifest(manifest: any, versionId: string): string {
    const classpathEntries: string[] = []

    // Add all libraries
    if (manifest.libraries) {
        for (const lib of manifest.libraries) {
            // Skip if library has rules that don't apply
            if (lib.rules && !checkRules(lib.rules)) {
                continue
            }

            // Get library path
            let libPath = ''

            if (lib.downloads?.artifact) {
                // Standard format (Mojang libraries)
                libPath = path.join(LIBRARIES_PATH, lib.downloads.artifact.path)
            } else if (lib.name && lib.url) {
                // Maven format (Fabric, Forge, etc.)
                const parts = lib.name.split(':')
                if (parts.length >= 3) {
                    const [group, artifact, version] = parts
                    const groupPath = group.replace(/\./g, '/')
                    const fileName = `${artifact}-${version}.jar`
                    const mavenPath = `${groupPath}/${artifact}/${version}/${fileName}`

                    libPath = path.join(LIBRARIES_PATH, mavenPath)
                }
            }

            if (libPath) {
                classpathEntries.push(libPath)
            }

            // Also add natives jars to classpath for LWJGL 3 compatibility
            if (lib.downloads?.classifiers) {
                const osKey = process.platform === 'win32' ? 'windows' :
                    process.platform === 'darwin' ? 'osx' : 'linux'

                let nativeKey = lib.natives?.[osKey]

                // Fallback for some manifests that don't have the 'natives' map but have 'classifiers'
                if (!nativeKey) {
                    if (osKey === 'windows' && lib.downloads.classifiers['natives-windows']) nativeKey = 'natives-windows'
                    else if (osKey === 'osx' && lib.downloads.classifiers['natives-macos']) nativeKey = 'natives-macos'
                    else if (osKey === 'osx' && lib.downloads.classifiers['natives-osx']) nativeKey = 'natives-osx'
                    else if (osKey === 'linux' && lib.downloads.classifiers['natives-linux']) nativeKey = 'natives-linux'
                }

                if (nativeKey && lib.downloads.classifiers[nativeKey]) {
                    const nativeJarPath = path.join(LIBRARIES_PATH, lib.downloads.classifiers[nativeKey].path)
                    if (fs.existsSync(nativeJarPath)) {
                        classpathEntries.push(nativeJarPath)
                    }
                }
            }
        }
    }

    // Add main version JAR (use inheritsFrom if specified)
    const baseVersion = manifest.inheritsFrom || versionId
    const versionJar = path.join(VERSIONS_PATH, baseVersion, `${baseVersion}.jar`)
    classpathEntries.push(versionJar)

    console.log('[CustomLaunch] Classpath entries:', classpathEntries.length)
    return classpathEntries.join(path.delimiter)
}

/**
 * Build JVM arguments from manifest
 */
function buildJvmArgsFromManifest(
    manifest: any,
    nativesDir: string,
    classpath: string,
    memory: { min: number; max: number },
    gameDir: string,
    instanceName?: string
): string[] {
    const args: string[] = []

    // Memory settings
    args.push(`-Xmx${memory.max}M`)
    args.push(`-Xms${memory.min}M`)

    // Process JVM arguments from manifest
    if (manifest.arguments?.jvm) {
        for (const arg of manifest.arguments.jvm) {
            if (typeof arg === 'string') {
                args.push(arg)
            } else if (arg.rules && checkRules(arg.rules)) {
                if (Array.isArray(arg.value)) {
                    args.push(...arg.value)
                } else {
                    args.push(arg.value)
                }
            }
        }
    } else {
        // Legacy format
        args.push(`-Djava.library.path=${nativesDir}`)
        args.push(`-Dminecraft.launcher.brand=ReaLauncher`)
        args.push(`-Dminecraft.launcher.version=1.0`)
        args.push('-cp')
        args.push(classpath)
    }

    // Additional required args
    args.push('-Dfml.ignoreInvalidMinecraftCertificates=true')

    // Explicitly set library paths for LWJGL
    args.push('-Djava.library.path=${natives_directory}')
    args.push('-Dorg.lwjgl.librarypath=${natives_directory}')

    // Encoding and Locale fixes
    args.push('-Dfile.encoding=UTF-8')
    args.push('-Dstdout.encoding=UTF-8')
    args.push('-Dstderr.encoding=UTF-8')
    args.push('-Duser.language=ja')
    args.push('-Duser.country=JP')

    if (instanceName) {
        args.push(`-Dminecraft.launcher.version=${instanceName}`)
    }

    // Replace placeholders
    return args.map(arg => arg
        .replace(/\$\{natives_directory\}/g, nativesDir)
        .replace(/\$\{launcher_name\}/g, 'ReaLauncher')
        .replace(/\$\{launcher_version\}/g, '1.0')
        .replace(/\$\{classpath\}/g, classpath)
        .replace(/\$\{library_directory\}/g, LIBRARIES_PATH)
        .replace(/\$\{classpath_separator\}/g, path.delimiter)
        .replace(/\$\{version_name\}/g, manifest.id)
    )
}

/**
 * Build game arguments from manifest
 */
function buildGameArgsFromManifest(manifest: any, config: LaunchConfig, gameDir: string): string[] {
    const args: string[] = []

    // Process game arguments from manifest
    if (manifest.arguments?.game) {
        for (const arg of manifest.arguments.game) {
            if (typeof arg === 'string') {
                args.push(arg)
            } else if (arg.rules && checkRules(arg.rules)) {
                if (Array.isArray(arg.value)) {
                    args.push(...arg.value)
                } else {
                    args.push(arg.value)
                }
            }
        }
    } else if (manifest.minecraftArguments) {
        // Legacy format
        args.push(...manifest.minecraftArguments.split(' '))
    }

    // If no arguments, add defaults
    if (args.length === 0) {
        args.push('--username', '${auth_player_name}')
        args.push('--version', '${version_name}')
        args.push('--gameDir', '${game_directory}')
        args.push('--assetsDir', '${assets_root}')
        args.push('--assetIndex', '${assets_index_name}')
        args.push('--uuid', '${auth_uuid}')
        args.push('--accessToken', '${auth_access_token}')
        args.push('--userType', '${user_type}')
        args.push('--versionType', '${version_type}')
    }

    // Replace placeholders
    const assetsDir = path.join(META_PATH, 'assets')
    const replacedArgs = args.map(arg => arg
        .replace(/\$\{auth_player_name\}/g, config.profile.name)
        .replace(/\$\{auth_uuid\}/g, config.profile.id.replace(/-/g, ''))
        .replace(/\$\{auth_access_token\}/g, config.profile.accessToken)
        .replace(/\$\{auth_xuid\}/g, config.profile.accessToken) // Fallback
        .replace(/\$\{user_type\}/g, 'msa')
        .replace(/\$\{version_name\}/g, manifest.id)
        .replace(/\$\{version_type\}/g, manifest.type || 'release')
        .replace(/\$\{game_directory\}/g, gameDir)
        .replace(/\$\{assets_root\}/g, assetsDir)
        .replace(/\$\{assets_index_name\}/g, manifest.assetIndex?.id || manifest.assets || '1.18')
        .replace(/\$\{game_assets\}/g, assetsDir)
        .replace(/\$\{user_properties\}/g, '{}')
        .replace(/\$\{clientid\}/g, config.profile.id)
    )

    // Remove duplicates and filter out placeholder arguments
    const seenFlags = new Set<string>()
    const uniqueArgs: string[] = []

    for (let i = 0; i < replacedArgs.length; i++) {
        const arg = replacedArgs[i]

        // Skip --demo flag (not needed for normal play)
        if (arg === '--demo') {
            continue
        }

        // Check if this is a flag (starts with --)
        if (arg.startsWith('--')) {
            // Check if next arg exists and is a value (not another flag)
            const hasValue = i + 1 < replacedArgs.length && !replacedArgs[i + 1].startsWith('--')
            const nextValue = hasValue ? replacedArgs[i + 1] : null

            // Skip if value contains placeholder
            if (nextValue && nextValue.includes('${')) {
                i++ // Skip both flag and placeholder value
                continue
            }

            // Skip if no value provided for this flag
            if (!hasValue) {
                continue
            }

            // Check for duplicates
            if (!seenFlags.has(arg)) {
                seenFlags.add(arg)
                uniqueArgs.push(arg)
                if (nextValue !== null) {
                    uniqueArgs.push(nextValue)
                }
                i++ // Skip the value in next iteration
            } else {
                // Skip duplicate flag and its value
                i++
            }
        } else {
            // Standalone value (not following a flag) - keep it if no placeholder
            if (!arg.includes('${')) {
                uniqueArgs.push(arg)
            }
        }
    }

    return uniqueArgs
}

/**
 * Check if rules allow this argument/library
 */
function checkRules(rules: any[]): boolean {
    for (const rule of rules) {
        const action = rule.action === 'allow'

        // Check OS
        if (rule.os) {
            const osName = rule.os.name
            const currentOS = process.platform === 'win32' ? 'windows' :
                process.platform === 'darwin' ? 'osx' : 'linux'

            if (osName && osName !== currentOS) {
                if (action) return false // Disallow doesn't match
                continue // Allow doesn't match, check next rule
            }
        }

        // If we get here and action is allow, include it
        if (action) return true
    }

    // Default: allow if no rules matched
    return rules.length === 0 || rules.some(r => r.action === 'allow')
}

/**
 * Launch Minecraft with EML Lib
 */
async function launchMinecraft(config: LaunchConfig): Promise<{ success: boolean; error?: string }> {
    try {
        // 0. Ensure Vanilla Version (Base) is ready
        // This downloads the jar to meta/versions/1.21.1/1.21.1.jar if missing
        await downloadVanillaVersion(config.version)

        // 1. Prepare Version (Custom Path) if loader is used
        const launchVersion = await prepareCustomVersion(config)

        // 2. Ensure Java is installed/selected
        let javaPath = config.javaPath
        if (!javaPath) {
            const javaVersion = getJavaVersionForMinecraft(config.version)
            javaPath = await installSpecificJava(javaVersion)
        }

        // 3. Create launcher instance
        // For custom versions (Fabric, etc.), eml-lib cannot find them in Mojang's manifest.
        // We need to read the local manifest and use the 'inheritsFrom' field as the base version.
        let baseVersionForEML = config.version
        let versionManifest: any = undefined

        if (launchVersion !== config.version) {
            // This is a custom version, read its JSON manifest
            const manifestPath = path.join(VERSIONS_PATH, launchVersion, `${launchVersion}.json`)
            if (fs.existsSync(manifestPath)) {
                versionManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
                console.log(`[Launch] Using custom version manifest from ${manifestPath}`)

                // If manifest has inheritsFrom, use that as the base version for eml-lib's manifest lookup
                if (versionManifest.inheritsFrom) {
                    baseVersionForEML = versionManifest.inheritsFrom
                    console.log(`[Launch] Custom version inherits from ${baseVersionForEML}`)
                }
            }
        }

        const launcherOptions: any = {
            account: {
                accessToken: config.profile.accessToken,
                clientToken: config.profile.id, // eml-lib requires clientToken
                uuid: config.profile.id.replace(/-/g, ''),
                name: config.profile.name,
                userProperties: {},
                meta: {
                    type: 'msa' // Microsoft Account
                }
            },
            serverId: 'realauncher',
            minecraft: {
                // Use base version for eml-lib's manifest lookup, but it will actually launch the custom version
                version: baseVersionForEML,
                args: []
            },
            memory: {
                min: config.memory.min,
                max: config.memory.max
            },
            java: {
                absolutePath: javaPath,
                install: 'manual'
            },
            root: META_PATH
        }

        // Add instance-specific game directory if provided
        if (config.instancePath) {
            // Use overrides to set the game directory (running dir) to the instance path
            // while keeping 'root' as the shared meta folder for libraries/assets/versions
            launcherOptions.overrides = {
                gameDirectory: config.instancePath
            }
        }

        console.log('[Launch] Creating EML Launcher with options:', JSON.stringify({
            ...launcherOptions,
            authorization: { ...launcherOptions.authorization, access_token: '***' }
        }, null, 2))

        const launcher = new (EMLLib.Launcher as any)(launcherOptions)

        // Listen to ALL launcher events for debugging
        launcher.on('launch_debug', (e: any) => {
            console.log('[EML Debug]', e)
            sendLog('debug', `[Debug] ${e}`)
        })
        launcher.on('launch_data', (e: any) => {
            // Determine log level from message content
            let level: 'info' | 'warn' | 'error' = 'info'
            const msg = e.toString()
            if (msg.includes('ERROR') || msg.includes('FATAL') || msg.includes('Exception')) level = 'error'
            else if (msg.includes('WARN')) level = 'warn'

            console.log(`[EML Data] [${level}]`, e)
            sendLog(level, msg)
        })
        launcher.on('launch_close', (code: number) => {
            console.log('[EML] Game closed with code:', code)
            sendLog('info', `[System] Game closed with exit code: ${code}`)
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('launcher:game-closed', { exitCode: code })
            }
        })
        launcher.on('launch_compute_download', () => console.log('[EML] Computing downloads...'))
        launcher.on('launch_download', (e: any) => console.log('[EML] Download:', e))
        launcher.on('launch_install_loader', (e: any) => console.log('[EML] Installing loader:', e))
        launcher.on('launch_extract_natives', () => console.log('[EML] Extracting natives...'))
        launcher.on('launch_copy_assets', () => console.log('[EML] Copying assets...'))
        launcher.on('launch_check_java', () => console.log('[EML] Checking Java...'))
        launcher.on('launch_patch_loader', () => console.log('[EML] Patching loader...'))
        launcher.on('launch_clean', () => console.log('[EML] Cleaning...'))
        launcher.on('launch_launch', (e: any) => console.log('[EML] Launching game:', e))

        sendLog('info', `Launching Minecraft ${config.version}...`)
        console.log('[Launch] Calling launcher.launch()...')

        // Launch the game
        try {
            await launcher.launch()
            console.log('[Launch] launcher.launch() completed successfully')
        } catch (launchError) {
            console.error('[Launch] launcher.launch() failed:', launchError)
            throw launchError
        }

        sendLog('info', 'Minecraft launched successfully')

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('launcher:game-started')
        }

        return { success: true }
    } catch (error) {
        console.error('Launch failed:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown launch error'
        }
    }
}

/**
 * Register IPC handlers for EML Lib functions
 */
export function registerEMLHandlers() {
    // Launch Minecraft
    ipcMain.handle('eml:launch', async (_, launchConfig: LaunchConfig) => {
        // Network Check
        const online = await isOnline()
        if (!online) {
            Logger.error('[Launch] No internet connection detected. Launch cancelled.')
            throw new Error('No internet connection. Please check your network.')
        }

        // Use minecraft-launcher-core instead of eml-lib
        return await launchMinecraftCustom(launchConfig)
    })

    // Install Java
    ipcMain.handle('eml:install-java', async (_, version: number = 21) => {
        try {
            const path = await installSpecificJava(version)
            return { success: true, path }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })

    // Get versions
    ipcMain.handle('eml:get-versions', async () => {
        try {
            // Manifests is the correct way to get Minecraft versions in v2
            const response = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')
            const data = await response.json()
            return data.versions || []
        } catch (error) {
            Logger.error(`Failed to get versions: ${error}`)
            return []
        }
    })

    // Test Java
    ipcMain.handle('eml:test-java', async (_, javaPath: string) => {
        return new Promise((resolve) => {
            if (!javaPath || !fs.existsSync(javaPath)) {
                resolve({ success: false, error: 'File not found' })
                return
            }
            exec(`"${javaPath}" -version`, (error, _stdout, stderr) => {
                if (error) resolve({ success: false, error: error.message })
                else resolve({ success: true, version: stderr.split('\n')[0] || 'Unknown version' })
            })
        })
    })

    // Detect version
    ipcMain.handle('eml:detect-java-version', async (_, target: number) => {
        const commonPaths = [
            path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Java'),
            path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Java'),
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Adoptium'),
            JAVA_STORAGE_PATH // Also check our local storage
        ]

        const found: any[] = []

        const scan = (dir: string) => {
            if (!fs.existsSync(dir)) return
            const entries = fs.readdirSync(dir)
            for (const entry of entries) {
                const fullPath = path.join(dir, entry)
                const exePath = path.join(fullPath, 'bin', 'java.exe')
                if (fs.existsSync(exePath)) {
                    // Quick version check
                    try {
                        // This is a bit slow for a deep scan, but we'll keep it targeted
                        // For now we'll just check if the folder name contains the version
                        if (entry.includes(`jdk-${target}`) || entry.includes(`jre-${target}`) || (target === 8 && (entry.includes('1.8') || entry.includes('jre8')))) {
                            found.push({ path: exePath, version: entry })
                        }
                    } catch (e) { }
                }
            }
        }

        commonPaths.forEach(scan)
        return found.length > 0 ? found[0] : null
    })

    // Get paths
    ipcMain.handle('eml:get-paths', () => ({
        minecraft: MINECRAFT_PATH,
        versions: VERSIONS_PATH,
        assets: ASSETS_PATH,
        libraries: LIBRARIES_PATH,
        java: JAVA_STORAGE_PATH
    }))

    // Get/Set Launcher Path (Root)
    ipcMain.handle('eml:get-launcher-path', async () => {
        return LPATH
    })

    ipcMain.handle('eml:set-launcher-path', async (_, newPath: string) => {
        try {
            if (!newPath) return { success: false, error: 'Path is empty' }

            // Validate path
            if (fs.existsSync(newPath) && !fs.statSync(newPath).isDirectory()) {
                return { success: false, error: 'Path exists and is not a directory' }
            }

            // Save to config
            config.rootPath = newPath
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))

            // Update internal state
            updatePaths(newPath)

            return { success: true }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })

    // Get loader versions
    ipcMain.handle('eml:get-loader-versions', async (_, loaderType: string, mcVersion: string) => {
        try {
            switch (loaderType) {
                case 'fabric': {
                    const res = await axios.get<any[]>(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`)
                    return (res.data || []).map((v: any) => ({
                        version: v.loader.version,
                        stable: v.loader.stable,
                        loader: 'fabric'
                    }))
                }
                case 'legacy-fabric': {
                    const res = await axios.get<any[]>(`https://meta.legacyfabric.net/v2/versions/loader/${mcVersion}`)
                    return (res.data || []).map((v: any) => ({
                        version: v.loader.version,
                        stable: v.loader.stable,
                        loader: 'legacy-fabric'
                    }))
                }
                case 'quilt': {
                    const res = await axios.get<any[]>(`https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`)
                    return (res.data || []).slice(0, 20).map((v: any, i: number) => ({
                        version: v.loader.version,
                        stable: i === 0,
                        loader: 'quilt'
                    }))
                }
                case 'neoforge': {
                    const res = await axios.get<any>('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge')
                    const allVersions: string[] = res.data.versions || []

                    const mcParts = mcVersion.split('.')
                    const majorMinor = `${mcParts[1]}.${mcParts[2] || '0'}`

                    // Filter versions that match the MC version
                    // Convention: 1.20.4 -> 20.4.x, or sometimes 1.20.4-x
                    const filtered = allVersions.filter(v => v.startsWith(majorMinor) || v.startsWith(mcVersion))

                    // SORTING LOGIC:
                    // 1. Stable vs Beta/Alpha (Stable first)
                    // 2. Version number (Newest first)
                    const sorted = filtered.sort((a, b) => {
                        const aStable = !a.toLowerCase().includes('beta') && !a.toLowerCase().includes('alpha')
                        const bStable = !b.toLowerCase().includes('beta') && !b.toLowerCase().includes('alpha')

                        if (aStable !== bStable) return aStable ? -1 : 1

                        // If same stability, use Maven order (index) - higher index is newer
                        return allVersions.indexOf(b) - allVersions.indexOf(a)
                    })

                    return sorted.slice(0, 50).map((v) => ({
                        version: v,
                        stable: !v.toLowerCase().includes('beta') && !v.toLowerCase().includes('alpha'),
                        loader: 'neoforge'
                    }))
                }
                case 'forge': {
                    // Use BMCLAPI for full Forge list, fallback to official promotions
                    try {
                        const res = await axios.get<any[]>(`https://bmclapi2.bangbang93.com/forge/minecraft/${mcVersion}`)
                        const rawVersions = res.data || []

                        // Sort by stability then version
                        const sorted = rawVersions.sort((a: any, b: any) => {
                            const aStable = (a.version.includes('recommended') || !a.version.includes('beta'))
                            const bStable = (b.version.includes('recommended') || !b.version.includes('beta'))

                            if (aStable !== bStable) return aStable ? -1 : 1
                            return rawVersions.indexOf(b) - rawVersions.indexOf(a)
                        })

                        return sorted.slice(0, 50).map((v: any) => ({
                            version: v.version,
                            stable: v.version.includes('recommended') || !v.version.includes('beta'),
                            loader: 'forge'
                        }))
                    } catch (e) {
                        const res = await axios.get<any>('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')
                        const promos = res.data.promos || {}
                        const versions = []
                        if (promos[`${mcVersion}-latest`]) {
                            versions.push({ version: promos[`${mcVersion}-latest`], stable: false, loader: 'forge' })
                        }
                        if (promos[`${mcVersion}-recommended`] && promos[`${mcVersion}-recommended`] !== promos[`${mcVersion}-latest`]) {
                            versions.unshift({ version: promos[`${mcVersion}-recommended`], stable: true, loader: 'forge' })
                        }
                        return versions
                    }
                }
                default:
                    return []
            }
        } catch (error) {
            Logger.error(`Failed to fetch ${loaderType} versions for ${mcVersion}: ${error}`)
            return []
        }
    })

    // Toggle Content (Mod enable/disable)
    ipcMain.handle('eml:toggle-content', async (_, instanceId: string, filePath: string, enable: boolean) => {
        return await toggleContent(instanceId, filePath, enable)
    })

    // Export Instance
    ipcMain.handle('eml:export-instance', async (_, instanceId: string) => {
        return await exportInstance(instanceId)
    })

    // Search content (Modrinth)
    ipcMain.handle('eml:search-content', async (_, options) => {
        try {
            return await searchContent(options)
        } catch (error) {
            return { error: String(error) }
        }
    })

    // Install content
    ipcMain.handle('eml:install-content', async (_, { project, instance }) => {
        try {
            return await installContent(project, instance)
        } catch (error) {
            return { error: String(error) }
        }
    })

    // Detect installed content
    ipcMain.handle('eml:detect-content', async (_, { instance }) => {
        try {
            return await detectInstalledContent(instance)
        } catch (error) {
            return { error: String(error) }
        }
    })

    // Import Local Modpack
    ipcMain.handle('eml:import-local-modpack', async (_, { filePath, instanceName }) => {
        try {
            // 1. Create a temporary instance to hold the modpack
            const memory = { min: 2048, max: 4096 } // Default
            const instance = await minecraftLauncher.createInstance({
                name: instanceName || path.basename(filePath, path.extname(filePath)),
                version: '1.20.1', // Default, will be updated by manifest
                memory
            })

            // 2. Extract and Install
            const zip = new AdmZip(filePath)
            const extractPath = path.join(TEMP_PATH, `import_${instance.id}`)
            if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath, { recursive: true })
            zip.extractAllTo(extractPath, true)

            const manifestPath = path.join(extractPath, 'modrinth.index.json')
            if (!fs.existsSync(manifestPath)) {
                // If not mrpack, maybe it's a zip modpack (CurseForge)
                // For now only mrpack is supported in depth
                throw new Error('Only .mrpack files are currently supported for direct import.')
            }

            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

            // 3. Update instance metadata from manifest
            const instancesJsonPath = path.join(LPATH, 'instances', 'instances.json')
            const instances = JSON.parse(fs.readFileSync(instancesJsonPath, 'utf-8'))
            const idx = instances.findIndex((i: any) => i.id === instance.id)
            if (idx !== -1) {
                if (manifest.dependencies) {
                    const gameVersion = manifest.dependencies.minecraft
                    if (gameVersion) instances[idx].version = gameVersion

                    if (manifest.dependencies['fabric-loader']) {
                        instances[idx].loader = { type: 'fabric', version: manifest.dependencies['fabric-loader'] }
                    } else if (manifest.dependencies['forge']) {
                        instances[idx].loader = { type: 'forge', version: manifest.dependencies['forge'] }
                    }
                }
                fs.writeFileSync(instancesJsonPath, JSON.stringify(instances, null, 2))
            }

            // 4. Trigger file downloads (serial for stability)
            const files = manifest.files || []
            const sanitizedName = minecraftLauncher.sanitizeInstanceName(instance.name)
            const instancePath = path.join(LPATH, 'instances', sanitizedName)

            Logger.info(`[Import] Importing ${files.length} files...`)

            // Run modpack installation logic (we reuse the file processing part of installModpack by extracting it or just re-implementing here)
            // Re-implementing simplified version here for now
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const filename = file.path.split('/').pop()
                sendProgress({ type: 'hash', current: i + 1, total: files.length, percentage: Math.round(((i + 1) / files.length) * 100), filename: `Downloading ${filename}` })

                const downloadUrl = file.downloads?.[0]
                if (!downloadUrl) continue

                const relativeDir = file.path.split('/').slice(0, -1).join('/')
                const targetDir = path.join(instancePath, relativeDir)
                if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

                const targetPath = path.join(targetDir, filename)

                // Download
                const res = await axios({ method: 'GET', url: downloadUrl, responseType: 'stream' })
                const writer = fs.createWriteStream(targetPath)
                await new Promise<void>((resolve, reject) => {
                    (res.data as any).pipe(writer)
                    writer.on('finish', () => resolve())
                    writer.on('error', reject)
                })

                // Verify
                if (file.hashes?.sha1) {
                    const hash = await getFileHash(targetPath)
                    if (hash !== file.hashes.sha1) Logger.warn(`Hash mismatch for ${filename}`)
                }
            }

            // 5. Copy overrides
            const overridesPath = path.join(extractPath, 'overrides')
            if (fs.existsSync(overridesPath)) {
                copyFolderRecursive(overridesPath, instancePath)
            }

            return { success: true, instance }
        } catch (error) {
            Logger.error(`Import failed: ${error}`)
            return { error: String(error) }
        }
    })

    // Scan Launchers
    ipcMain.handle('eml:scan-launchers', async (_, launcherId: string, launcherPath: string) => {
        if (!fs.existsSync(launcherPath)) return []

        const found: any[] = []
        try {
            const instancesDir = launcherId === 'curseforge' ? launcherPath : path.join(launcherPath, 'instances')
            if (!fs.existsSync(instancesDir)) {
                // Some launchers might have custom instances folder setup, but we'll stick to defaults for now
                // CurseForge path provided is already the Instances folder usually
                if (launcherId !== 'curseforge') return []
            }

            const targetDir = launcherId === 'curseforge' ? launcherPath : instancesDir
            const items = fs.readdirSync(targetDir)

            for (const item of items) {
                const itemPath = path.join(targetDir, item)
                if (!fs.statSync(itemPath).isDirectory()) continue

                let name = item
                let version = 'unknown'
                let loader = 'vanilla'

                if (launcherId === 'multimc' || launcherId === 'prismlauncher') {
                    const cfgPath = path.join(itemPath, 'instance.cfg')
                    if (fs.existsSync(cfgPath)) {
                        const content = fs.readFileSync(cfgPath, 'utf-8')
                        const nameMatch = content.match(/^name=(.*)$/m)
                        const versionMatch = content.match(/^IntendedVersion=(.*)$/m)
                        if (nameMatch) name = nameMatch[1]
                        if (versionMatch) version = versionMatch[1]
                    }
                } else if (launcherId === 'gdlauncher') {
                    const configPath = path.join(itemPath, 'config.json')
                    if (fs.existsSync(configPath)) {
                        const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
                        name = data.name || item
                        version = data.minecraftVersion || 'unknown'
                    }
                } else if (launcherId === 'atlauncher') {
                    const jsonPath = path.join(itemPath, 'instance.json')
                    if (fs.existsSync(jsonPath)) {
                        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
                        name = data.name || item
                        version = data.minecraftVersion || 'unknown'
                    }
                } else if (launcherId === 'curseforge') {
                    const manifestPath = path.join(itemPath, 'minecraftinstance.json')
                    if (fs.existsSync(manifestPath)) {
                        const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
                        name = data.name || item
                        version = data.gameVersion || 'unknown'
                    }
                }

                found.push({
                    id: item,
                    name,
                    path: itemPath,
                    version,
                    loader
                })
            }
        } catch (error) {
            Logger.error(`Failed to scan launcher ${launcherId}: ${error}`)
        }
        return found
    })

    // Open External URL
    ipcMain.handle('app:open-external', async (_, url: string) => {
        try {
            await shell.openExternal(url)
            return { success: true }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })
}


