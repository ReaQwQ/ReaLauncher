import { contextBridge, ipcRenderer } from 'electron'

console.log('--- PRELOAD SCRIPT STARTING ---');

try {
    const api = {
        // Window controls
        minimize: () => ipcRenderer.send('window-minimize'),
        maximize: () => ipcRenderer.send('window-maximize'),
        close: () => ipcRenderer.send('window-close'),
        isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

        // Auth
        auth: {
            login: () => ipcRenderer.invoke('auth:login'),
            logout: () => ipcRenderer.invoke('auth:logout'),
            getProfile: () => ipcRenderer.invoke('auth:get-profile'),
            onDeviceCode: (callback: (data: { userCode: string, verificationUri: string }) => void) => {
                const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
                ipcRenderer.on('auth:device-code', handler)
                return () => ipcRenderer.removeListener('auth:device-code', handler)
            }
        },

        // Launcher
        launcher: {
            detectJava: () => ipcRenderer.invoke('launcher:detect-java'),
            getInstances: () => ipcRenderer.invoke('launcher:get-instances'),
            createInstance: (options: {
                name: string
                version: string
                loader?: { type: string; version: string }
                memory?: { min: number; max: number }
            }) => ipcRenderer.invoke('launcher:create-instance', options),
            deleteInstance: (instanceId: string) => ipcRenderer.invoke('launcher:delete-instance', instanceId),
            updateInstance: (instance: unknown) => ipcRenderer.invoke('launcher:update-instance', instance),
            launch: (options: unknown) => ipcRenderer.invoke('launcher:launch', options),
            getWorlds: (instanceId: string) => ipcRenderer.invoke('launcher:get-worlds', instanceId),
            getLogs: (instanceId: string) => ipcRenderer.invoke('launcher:get-logs', instanceId),
            openFolder: (instancePath: string) => ipcRenderer.invoke('launcher:open-folder', instancePath),
            readImage: (path: string) => ipcRenderer.invoke('launcher:read-image', path),
            getCrashReports: (instanceId: string) => ipcRenderer.invoke('launcher:get-crash-reports', instanceId),
            getCrashReportContent: (instanceId: string, reportName: string) => ipcRenderer.invoke('launcher:get-crash-report-content', instanceId, reportName),
            onInstanceUpdated: (callback: (data: { instanceId: string }) => void) => {
                const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
                ipcRenderer.on('launcher:instance-updated', handler)
                return () => ipcRenderer.removeListener('launcher:instance-updated', handler)
            }
        },

        // Filesystem
        selectFile: (title: string, filters?: { name: string, extensions: string[] }[]) => ipcRenderer.invoke('fs:select-file', title, filters),
        selectDirectory: (title: string) => ipcRenderer.invoke('fs:select-directory', title),
        listContents: (targetPath: string) => ipcRenderer.invoke('fs:list-contents', targetPath),
        getDrives: () => ipcRenderer.invoke('fs:get-drives'),
        getHome: () => ipcRenderer.invoke('fs:get-home'),

        // Events
        onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized)
            ipcRenderer.on('window-maximize-changed', handler)
            return () => ipcRenderer.removeListener('window-maximize-changed', handler)
        },

        // Dialog & App
        dialog: {
            openDirectory: (title?: string) => ipcRenderer.invoke('fs:select-directory', title)
        },
        app: {
            clearCache: () => ipcRenderer.invoke('app:clear-cache'),
            openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url)
        },

        // EML Lib Integration
        eml: {
            launch: (config: {
                version: string
                loader?: { type: string; version: string }
                memory: { min: number; max: number }
                profile: { id: string; name: string; accessToken: string }
                instancePath?: string
            }) => ipcRenderer.invoke('eml:launch', config),

            installJava: (version?: number) => ipcRenderer.invoke('eml:install-java', version),

            downloadMinecraft: (version: string, loader?: { type: string; version: string }) =>
                ipcRenderer.invoke('eml:download-minecraft', version, loader),

            getVersions: () => ipcRenderer.invoke('eml:get-versions'),

            getLoaderVersions: (loaderType: string, mcVersion: string) =>
                ipcRenderer.invoke('eml:get-loader-versions', loaderType, mcVersion),

            isVersionInstalled: (version: string) => ipcRenderer.invoke('eml:is-version-installed', version),

            getPaths: () => ipcRenderer.invoke('eml:get-paths'),

            getLauncherPath: () => ipcRenderer.invoke('eml:get-launcher-path'),
            setLauncherPath: (path: string) => ipcRenderer.invoke('eml:set-launcher-path', path),

            testJava: (javaPath: string) => ipcRenderer.invoke('eml:test-java', javaPath),

            detectJavaVersion: (version: number) => ipcRenderer.invoke('eml:detect-java-version', version),

            searchContent: (options: any) => ipcRenderer.invoke('eml:search-content', options),

            installContent: (project: any, instance: any) => ipcRenderer.invoke('eml:install-content', { project, instance }),
            detectContent: (instance: any) => ipcRenderer.invoke('eml:detect-content', { instance }),
            importLocalModpack: (options: { filePath: string, instanceName?: string }) => ipcRenderer.invoke('eml:import-local-modpack', options),
            scanLaunchers: (launcherId: string, launcherPath: string) => ipcRenderer.invoke('eml:scan-launchers', launcherId, launcherPath),

            toggleContent: (instanceId: string, filePath: string, enable: boolean, type: string) =>
                ipcRenderer.invoke('eml:toggle-content', instanceId, filePath, enable, type),

            deleteContent: (instanceId: string, filePath: string, type: string) =>
                ipcRenderer.invoke('eml:delete-content', instanceId, filePath, type),

            exportInstance: (instanceId: string) => ipcRenderer.invoke('eml:export-instance', instanceId),

            // Progress events
            onDownloadProgress: (callback: (progress: {
                type: 'java' | 'minecraft' | 'assets' | 'libraries' | 'loader' | 'modpack' | 'hash' | 'game'
                current: number
                total: number
                filename?: string
                percentage: number
            }) => void) => {
                const handler = (_event: Electron.IpcRendererEvent, progress: any) => callback(progress)
                ipcRenderer.on('launcher:download-progress', handler)
                return () => ipcRenderer.removeListener('launcher:download-progress', handler)
            },

            onGameStarted: (callback: () => void) => {
                const handler = () => callback()
                ipcRenderer.on('launcher:game-started', handler)
                return () => ipcRenderer.removeListener('launcher:game-started', handler)
            },

            onGameClosed: (callback: (data: { exitCode: number; instanceId?: string }) => void) => {
                const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
                ipcRenderer.on('launcher:game-closed', handler)
                return () => ipcRenderer.removeListener('launcher:game-closed', handler)
            },
            onLog: (callback: (data: { level: 'info' | 'warn' | 'error' | 'debug'; message: string, instanceId?: string }) => void) => {
                const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
                ipcRenderer.on('launcher:log', handler)
                return () => ipcRenderer.removeListener('launcher:log', handler)
            }
        }
    }

    contextBridge.exposeInMainWorld('electronAPI', api)
    console.log('--- ELECTRON API EXPOSED ---');

} catch (error) {
    console.error('--- PRELOAD ERROR ---', error);
}

export interface ElectronAPI {
    minimize: () => void
    maximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    auth: {
        login: () => Promise<{ success: boolean; error?: string; profile?: unknown }>
        logout: () => Promise<{ success: boolean }>
        getProfile: () => Promise<unknown | null>
        onDeviceCode: (callback: (data: { userCode: string, verificationUri: string }) => void) => () => void
    }
    launcher: {
        detectJava: () => Promise<Array<{ path: string; version: string; is64Bit: boolean; vendor: string }>>
        getInstances: () => Promise<unknown[]>
        createInstance: (options: {
            name: string
            version: string
            loader?: { type: string; version: string }
            memory?: { min: number; max: number }
        }) => Promise<unknown>
        deleteInstance: (instanceId: string) => Promise<void>
        updateInstance: (instance: unknown) => Promise<void>
        launch: (options: unknown) => Promise<{ success: boolean; error?: string }>
        getWorlds: (instanceId: string) => Promise<any[]>
        getLogs: (instanceId: string) => Promise<string>
        openFolder: (instancePath: string) => Promise<{ success: boolean; error?: string }>
        readImage: (path: string) => Promise<string | null>
        getCrashReports: (instanceId: string) => Promise<string[]>
        getCrashReportContent: (instanceId: string, reportName: string) => Promise<string>
        onInstanceUpdated: (callback: (data: { instanceId: string }) => void) => () => void
    }
    selectFile: (title: string, filters?: { name: string, extensions: string[] }[]) => Promise<string | null>
    selectDirectory: (title: string) => Promise<string | null>
    listContents: (targetPath: string) => Promise<{
        currentPath: string;
        parentPath: string | null;
        entries: Array<{ name: string; path: string; isDirectory: boolean; size: number; mtime: Date }>;
        error?: string;
    }>
    getDrives: () => Promise<string[]>
    getHome: () => Promise<string>
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void
    dialog: {
        openDirectory: (title?: string) => Promise<string | null>
    }
    app: {
        clearCache: () => Promise<void>
        openExternal: (url: string) => Promise<{ success: boolean; error?: string }>
    }
    eml: {
        launch: (config: {
            version: string
            loader?: { type: string; version: string }
            memory: { min: number; max: number }
            profile: { id: string; name: string; accessToken: string }
            instancePath?: string
            instanceId?: string
            instanceName?: string
        }) => Promise<{ success: boolean; error?: string }>
        installJava: (version?: number) => Promise<{ success: boolean; path?: string; error?: string }>
        downloadMinecraft: (version: string, loader?: { type: string; version: string }) => Promise<{ success: boolean; error?: string }>
        getVersions: () => Promise<any[]>
        getLoaderVersions: (loaderType: string, mcVersion: string) => Promise<any[]>
        isVersionInstalled: (version: string) => Promise<boolean>
        getPaths: () => Promise<{ minecraft: string; versions: string; assets: string; libraries: string; java: string }>
        getLauncherPath: () => Promise<string>
        setLauncherPath: (path: string) => Promise<{ success: boolean; error?: string }>
        testJava: (javaPath: string) => Promise<{ success: boolean; version?: string; error?: string }>
        detectJavaVersion: (version: number) => Promise<{ path: string; version: string; is64Bit: boolean; vendor: string } | null>
        searchContent: (options: {
            query?: string
            facets?: any[][]
            index?: 'relevance' | 'downloads' | 'newest' | 'updated'
            offset?: number
            limit?: number
        }) => Promise<any>
        installContent: (project: any, instance: any) => Promise<{ success: boolean; path?: string; version?: string; modCount?: number; error?: string }>
        detectContent: (instance: any) => Promise<{ success: boolean; error?: string }>
        importLocalModpack: (options: { filePath: string, instanceName?: string }) => Promise<{ success: boolean; instance?: any; error?: string }>
        scanLaunchers: (launcherId: string, launcherPath: string) => Promise<Array<{ id: string; name: string; path: string; version: string; loader: string }>>
        toggleContent: (instanceId: string, filePath: string, enable: boolean, type: string) => Promise<{ success: boolean; error?: string }>
        deleteContent: (instanceId: string, filePath: string, type: string) => Promise<{ success: boolean; error?: string }>
        exportInstance: (instanceId: string) => Promise<{ success: boolean; path?: string; error?: string }>
        onDownloadProgress: (callback: (progress: {
            type: 'java' | 'minecraft' | 'assets' | 'libraries' | 'loader' | 'modpack' | 'hash' | 'game'
            current: number
            total: number
            filename?: string
            percentage: number
        }) => void) => () => void
        onGameStarted: (callback: () => void) => () => void
        onGameClosed: (callback: (data: { exitCode: number; instanceId?: string }) => void) => () => void
        onLog: (callback: (data: { level: 'info' | 'warn' | 'error' | 'debug'; message: string, instanceId?: string }) => void) => () => void
    }
}

declare global {
    interface Window {
        electronAPI: ElectronAPI
    }
}