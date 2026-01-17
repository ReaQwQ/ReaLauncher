import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Settings, Package, Monitor, Coffee, Zap, Trash2, Copy, Search, FolderOpen, Play as PlayIcon, Image as ImageIcon, ChevronDown, Download } from 'lucide-react'
import ToggleSwitch from '../ui/ToggleSwitch'
import MemorySlider from '../ui/MemorySlider'
import { useNotificationStore } from '../../stores/notificationStore'
import { useMinecraftVersions } from '../../hooks/useMinecraftVersions'
import { useLoaderVersions } from '../../hooks/useLoaderVersions'
import FileBrowserModal from './FileBrowserModal'

interface MinecraftInstance {
    id: string
    name: string
    description?: string
    version: string
    loader?: { type: string; version: string }
    memory: { min: number; max: number }
    mods: string[]
    lastPlayed?: string
    lastUse?: string
    created: string
    isModpack?: boolean
    modpackName?: string
    iconUrl?: string
    iconPath?: string
    // Settings
    javaPath?: string
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
}

interface InstanceSettingsModalProps {
    isOpen: boolean
    onClose: () => void
    instance: MinecraftInstance
    onSave: (instance: MinecraftInstance) => void
    onDelete: () => void
    onDuplicate: () => void
}

type TabId = 'general' | 'installation' | 'window' | 'java' | 'hooks'

export default function InstanceSettingsModal({
    isOpen,
    onClose,
    instance,
    onSave,
    onDelete,
    onDuplicate
}: InstanceSettingsModalProps) {
    const { addNotification } = useNotificationStore()
    const [activeTab, setActiveTab] = useState<TabId>('general')
    const [formData, setFormData] = useState({
        name: instance.name,
        libraryGroups: '',
        useCustomWindow: false,
        fullscreen: false,
        width: 1920,
        height: 1080,
        useCustomJava: false,
        javaPath: '',
        useCustomMemory: false,
        memoryMB: instance.memory.max,
        useCustomJavaArgs: false,
        javaArgs: '',
        useCustomEnvVars: false,
        envVars: '',
        useCustomHooks: false,
        preLaunch: '',
        wrapper: '',
        postExit: '',
        version: instance.version,
        loaderType: instance.loader?.type || 'none',
        loaderVersion: instance.loader?.version || '',
        iconUrl: instance.iconUrl || '',
        iconPath: instance.iconPath || ''
    })

    const [showFileBrowser, setShowFileBrowser] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isExporting, setIsExporting] = useState(false)

    const tabs = [
        { id: 'general' as TabId, name: 'General', icon: Settings },
        { id: 'installation' as TabId, name: 'Installation', icon: Package },
        { id: 'window' as TabId, name: 'Window', icon: Monitor },
        { id: 'java' as TabId, name: 'Java and memory', icon: Coffee },
        { id: 'hooks' as TabId, name: 'Launch Hooks', icon: Zap }
    ]

    const handleSave = () => {
        onSave({
            ...instance,
            name: formData.name,
            version: formData.version,
            loader: formData.loaderType !== 'none' ? {
                type: formData.loaderType as any,
                version: formData.loaderVersion
            } : undefined,
            iconUrl: formData.iconUrl,
            iconPath: formData.iconPath,
            memory: formData.useCustomMemory ? {
                min: Math.floor(formData.memoryMB / 2),
                max: formData.memoryMB
            } : instance.memory,
            javaPath: formData.useCustomJava ? formData.javaPath : undefined,
            windowSettings: formData.useCustomWindow ? {
                fullscreen: formData.fullscreen,
                width: formData.width,
                height: formData.height
            } : undefined,
            javaArgs: formData.useCustomJavaArgs ? formData.javaArgs : undefined,
            envVars: formData.useCustomEnvVars ? formData.envVars : undefined,
            launchHooks: formData.useCustomHooks ? {
                preLaunch: formData.preLaunch,
                wrapper: formData.wrapper,
                postExit: formData.postExit
            } : undefined,
            lastUse: new Date().toISOString()
        })


        // Notify user about version changes triggering downloads
        if (formData.version !== instance.version ||
            (formData.loaderType !== 'none' && formData.loaderVersion !== instance.loader?.version) ||
            (formData.loaderType === 'none' && instance.loader)) {
            addNotification({
                type: 'info',
                title: 'Instance Updated',
                message: 'Downloading required version files in background...',
                duration: 5000
            })
        } else {
            addNotification({
                type: 'success',
                title: 'Settings Saved',
                message: 'Instance settings have been updated.',
                duration: 3000
            })
        }

        onClose()
    }

    const handleExport = async () => {
        setIsExporting(true)
        try {
            const result = await (window as any).electronAPI.eml.exportInstance(instance.id)
            if (result.success) {
                addNotification({ title: 'Export Success', message: 'Instance exported successfully', type: 'success' })
            } else if (result.error !== 'Export cancelled') {
                addNotification({ title: 'Export Failed', message: `Export failed: ${result.error}`, type: 'error' })
            }
        } catch (error) {
            addNotification({ title: 'Export Error', message: `Export error: ${error}`, type: 'error' })
        } finally {
            setIsExporting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative z-10 w-full max-w-4xl max-h-[85vh] glass-card flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-dark-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center">
                            <Settings size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-dark-100">Instance Settings</h2>
                            <p className="text-sm text-dark-400">{instance.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-dark-800 rounded-lg transition-colors text-dark-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-56 border-r border-dark-800 p-4 space-y-1 flex-shrink-0 overflow-y-auto">
                        {tabs.map((tab) => {
                            const Icon = tab.icon
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                                        ? 'bg-primary-600/20 text-primary-400'
                                        : 'text-dark-300 hover:bg-dark-800/50'
                                        }`}
                                >
                                    <Icon size={18} />
                                    {tab.name}
                                </button>
                            )
                        })}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <AnimatePresence mode="wait">
                            {activeTab === 'general' && (
                                <motion.div
                                    key="general"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <GeneralTab
                                        instance={instance}
                                        formData={formData}
                                        setFormData={setFormData}
                                        onDelete={() => setShowDeleteConfirm(true)}
                                        onDuplicate={onDuplicate}
                                        onExport={handleExport}
                                        isExporting={isExporting}
                                        showFileBrowser={showFileBrowser}
                                        setShowFileBrowser={setShowFileBrowser}
                                    />
                                </motion.div>
                            )}
                            {activeTab === 'installation' && (
                                <InstallationTab
                                    instance={instance}
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            )}
                            {activeTab === 'window' && (
                                <WindowTab
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            )}
                            {activeTab === 'java' && (
                                <JavaTab
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            )}
                            {activeTab === 'hooks' && (
                                <LaunchHooksTab
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-dark-800">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-xl text-sm font-medium text-dark-300 hover:bg-dark-800 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-8 py-2 rounded-xl bg-primary-600 text-white text-sm font-bold shadow-lg shadow-primary-600/20 hover:bg-primary-500 transition-all"
                    >
                        Save Changes
                    </button>
                </div>

                {/* File Browser for Icon */}
                <FileBrowserModal
                    isOpen={showFileBrowser}
                    onClose={() => setShowFileBrowser(false)}
                    onSelect={(path) => {
                        // If it looks like a local path, we might want to handle it specially,
                        // but for now just set iconUrl to the path and iconPath
                        setFormData({ ...formData, iconUrl: path, iconPath: path })
                    }}
                    title="Select Instance Icon"
                    mode="file"
                    allowedExtensions={['png', 'jpg', 'jpeg', 'webp']}
                />
            </motion.div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60" onClick={() => setShowDeleteConfirm(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative z-10 glass-card p-6 max-w-md"
                        >
                            <h3 className="text-lg font-bold text-dark-100 mb-2">Delete Instance?</h3>
                            <p className="text-sm text-dark-400 mb-6">
                                Are you sure you want to delete "{instance.name}"? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-dark-300 hover:bg-dark-800 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        onDelete()
                                        setShowDeleteConfirm(false)
                                        onClose()
                                    }}
                                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-500 transition-all"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

// Tab Components
function GeneralTab({ formData, setFormData, onDelete, onDuplicate, onExport, isExporting, setShowFileBrowser }: any) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-dark-100 mb-4">General Settings</h3>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-dark-300 mb-2 block">Instance Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-100 focus:outline-none focus:border-primary-500"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-dark-300 mb-2 block">Instance Icon</label>
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-dark-800/50 border border-dark-700">
                            <div className="w-16 h-16 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center overflow-hidden">
                                {formData.iconUrl ? (
                                    <img src={formData.iconUrl} alt="Icon" className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon size={24} className="text-dark-500" />
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-dark-400 mb-3">Custom icon for this instance. Supports PNG, JPG, WEBP.</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowFileBrowser(true)}
                                        className="px-4 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-all shadow-lg shadow-primary-600/20"
                                    >
                                        Browse File
                                    </button>
                                    <button
                                        onClick={() => {
                                            const url = prompt('Enter image URL:')
                                            if (url) setFormData({ ...formData, iconUrl: url, iconPath: '' })
                                        }}
                                        className="px-4 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-200 text-xs font-medium border border-dark-700 transition-all"
                                    >
                                        From URL
                                    </button>
                                    {formData.iconUrl && (
                                        <button
                                            onClick={() => setFormData({ ...formData, iconUrl: '', iconPath: '' })}
                                            className="px-4 py-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 text-xs font-medium border border-red-600/20 transition-all"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-dark-700 grid grid-cols-2 gap-3">
                        <button
                            onClick={onExport}
                            disabled={isExporting}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600/10 hover:bg-primary-600/20 text-primary-400 font-medium transition-all border border-primary-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isExporting ? <Search size={16} className="animate-spin" /> : <Download size={16} />}
                            Export .mrpack
                        </button>
                        <button
                            onClick={onDuplicate}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-200 font-medium transition-all border border-dark-700"
                        >
                            <Copy size={16} />
                            Duplicate
                        </button>
                    </div>

                    <button
                        onClick={onDelete}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 font-medium transition-all border border-red-600/20"
                    >
                        <Trash2 size={16} />
                        Delete Instance
                    </button>
                </div>
            </div>
        </div>
    )
}

function InstallationTab({ instance, formData, setFormData }: any) {
    const { data: allVersions, isLoading: versionsLoading } = useMinecraftVersions()
    const { data: loaderVersions, isLoading: loaderVersionsLoading } = useLoaderVersions(formData.loaderType, formData.version)

    const loaderTypes = [
        { id: 'none', name: 'Vanilla' },
        { id: 'fabric', name: 'Fabric' },
        { id: 'forge', name: 'Forge' },
        { id: 'neoforge', name: 'NeoForge' },
        { id: 'quilt', name: 'Quilt' }
    ]

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-dark-100 mb-4">Installation Settings</h3>

                <div className="space-y-6">
                    {instance.isModpack && (
                        <div className="p-4 rounded-lg bg-primary-600/10 border border-primary-600/20">
                            <div className="flex items-center gap-3">
                                <Package size={20} className="text-primary-400" />
                                <div>
                                    <p className="text-sm font-bold text-primary-300">Modpack Instance</p>
                                    <p className="text-xs text-primary-400/80">Changing versions or loaders for modpacks may cause issues.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-6">
                        {/* Minecraft Version */}
                        <div>
                            <label className="text-sm font-medium text-dark-300 mb-2 block">Minecraft Version</label>
                            {versionsLoading ? (
                                <div className="w-full px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-500 flex items-center gap-2">
                                    <Search size={14} className="animate-spin" /> Fetching versions...
                                </div>
                            ) : (
                                <div className="relative">
                                    <select
                                        value={formData.version}
                                        onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-100 focus:outline-none focus:border-primary-500 appearance-none cursor-pointer"
                                    >
                                        {allVersions?.map((v) => (
                                            <option key={v.version} value={v.version}>
                                                {v.version} ({v.type})
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
                                </div>
                            )}
                        </div>

                        {/* Mod Loader Type */}
                        <div>
                            <label className="text-sm font-medium text-dark-300 mb-2 block">Mod Loader</label>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                {loaderTypes.map((loader) => (
                                    <button
                                        key={loader.id}
                                        onClick={() => setFormData({ ...formData, loaderType: loader.id, loaderVersion: '' })}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${formData.loaderType === loader.id
                                            ? 'bg-primary-600 border-primary-500 text-white shadow-lg'
                                            : 'bg-dark-800 border-dark-700 text-dark-400 hover:bg-dark-700'
                                            }`}
                                    >
                                        {loader.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Loader Version */}
                        {formData.loaderType !== 'none' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                <label className="text-sm font-medium text-dark-300 mb-2 block">Loader Version</label>
                                {loaderVersionsLoading ? (
                                    <div className="w-full px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-500 flex items-center gap-2">
                                        <Search size={14} className="animate-spin" /> Fetching loader versions...
                                    </div>
                                ) : loaderVersions && loaderVersions.length > 0 ? (
                                    <div className="relative">
                                        <select
                                            value={formData.loaderVersion}
                                            onChange={(e) => setFormData({ ...formData, loaderVersion: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-100 focus:outline-none focus:border-primary-500 appearance-none cursor-pointer"
                                        >
                                            {!formData.loaderVersion && <option value="">Select a version</option>}
                                            {loaderVersions.map((v) => (
                                                <option key={v.version} value={v.version}>
                                                    {v.version} {v.stable ? '(Recommended)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
                                    </div>
                                ) : (
                                    <p className="text-xs text-red-400 px-1">No compatible loader versions found for this Minecraft version.</p>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function WindowTab({ formData, setFormData }: any) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-dark-100 mb-4">Window Settings</h3>

                <div className="space-y-4">
                    <ToggleSwitch
                        enabled={formData.useCustomWindow}
                        onChange={(val) => setFormData({ ...formData, useCustomWindow: val })}
                        label="Custom window settings"
                        description="Override default window configuration"
                    />

                    <AnimatePresence>
                        {formData.useCustomWindow && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="pl-4 space-y-4 border-l-2 border-dark-700 mt-4">
                                    <ToggleSwitch
                                        enabled={formData.fullscreen}
                                        onChange={(val) => setFormData({ ...formData, fullscreen: val })}
                                        label="Fullscreen"
                                    />

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-sm font-medium text-dark-300 mb-2 block">Width</label>
                                            <input
                                                type="number"
                                                value={formData.width}
                                                onChange={(e) => setFormData({ ...formData, width: parseInt(e.target.value) })}
                                                className="w-full px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-200 focus:outline-none focus:border-primary-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-dark-300 mb-2 block">Height</label>
                                            <input
                                                type="number"
                                                value={formData.height}
                                                onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) })}
                                                className="w-full px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-200 focus:outline-none focus:border-primary-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}

function JavaTab({ formData, setFormData }: any) {
    const [isDetecting, setIsDetecting] = useState(false)
    const [isTesting, setIsTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

    const handleBrowseJava = async () => {
        try {
            const path = await window.electronAPI.selectFile('Select java.exe', [
                { name: 'Java Executable', extensions: ['exe'] }
            ])
            if (path) {
                setFormData({ ...formData, javaPath: path })
                setTestResult(null)
            }
        } catch (error) {
            console.error('Failed to browse for Java:', error)
        }
    }

    const handleDetectJava = async () => {
        setIsDetecting(true)
        setTestResult(null)
        try {
            // Default to Java 21, or we could make this configurable
            const result = await window.electronAPI.eml.detectJavaVersion(21)
            if (result && result.path) {
                setFormData({ ...formData, javaPath: result.path })
                setTestResult({ success: true, message: `Java detected: ${result.version || 'Unknown version'}` })
            } else {
                setTestResult({ success: false, message: 'No Java installation found. Please browse manually.' })
            }
        } catch (error) {
            setTestResult({ success: false, message: 'Failed to detect Java installation.' })
        } finally {
            setIsDetecting(false)
        }
    }

    const handleTestJava = async () => {
        if (!formData.javaPath) {
            setTestResult({ success: false, message: 'Please provide a Java path first.' })
            return
        }

        setIsTesting(true)
        setTestResult(null)
        try {
            const result = await window.electronAPI.eml.testJava(formData.javaPath)
            if (result.success) {
                setTestResult({ success: true, message: `✓ ${result.version || 'Java test successful'}` })
            } else {
                setTestResult({ success: false, message: `✗ ${result.error || 'Test failed'}` })
            }
        } catch (error) {
            setTestResult({ success: false, message: '✗ Failed to test Java.' })
        } finally {
            setIsTesting(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-dark-100 mb-4">Java and Memory Settings</h3>

                <div className="space-y-6">
                    {/* Java Installation */}
                    <div>
                        <ToggleSwitch
                            enabled={formData.useCustomJava}
                            onChange={(val) => setFormData({ ...formData, useCustomJava: val })}
                            label="Custom Java installation"
                            description="Use a specific Java installation instead of auto-detected"
                        />

                        <AnimatePresence>
                            {formData.useCustomJava && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-4 space-y-3 pl-4 border-l-2 border-dark-700">
                                        <label className="text-sm font-medium text-dark-300 mb-2 block">Java Path</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={formData.javaPath}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, javaPath: e.target.value })
                                                    setTestResult(null)
                                                }}
                                                placeholder="C:\Program Files\Java\jdk-21\bin\java.exe"
                                                className="flex-1 px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-200 placeholder-dark-500 focus:outline-none focus:border-primary-500 font-mono text-sm"
                                            />
                                            <button
                                                onClick={handleDetectJava}
                                                disabled={isDetecting}
                                                title="Auto-detect Java"
                                                className="px-3 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 transition-all border border-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isDetecting ? (
                                                    <div className="animate-spin">⏳</div>
                                                ) : (
                                                    <Search size={18} />
                                                )}
                                            </button>
                                            <button
                                                onClick={handleBrowseJava}
                                                title="Browse for java.exe"
                                                className="px-3 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 transition-all border border-dark-700"
                                            >
                                                <FolderOpen size={18} />
                                            </button>
                                            <button
                                                onClick={handleTestJava}
                                                disabled={isTesting || !formData.javaPath}
                                                title="Test Java"
                                                className="px-3 py-2 rounded-lg bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 transition-all border border-primary-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isTesting ? (
                                                    <div className="animate-spin">⏳</div>
                                                ) : (
                                                    <PlayIcon size={18} />
                                                )}
                                            </button>
                                        </div>

                                        {/* Test Result */}
                                        {testResult && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium ${testResult.success
                                                    ? 'bg-green-600/10 text-green-400 border border-green-600/20'
                                                    : 'bg-red-600/10 text-red-400 border border-red-600/20'
                                                    }`}
                                            >
                                                {testResult.message}
                                            </motion.div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Memory Allocation */}
                    <div>
                        <ToggleSwitch
                            enabled={formData.useCustomMemory}
                            onChange={(val) => setFormData({ ...formData, useCustomMemory: val })}
                            label="Custom memory allocation"
                            description="Set custom memory limits for this instance"
                        />

                        <AnimatePresence>
                            {formData.useCustomMemory && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-4 pl-4 border-l-2 border-dark-700">
                                        <MemorySlider
                                            value={formData.memoryMB}
                                            onChange={(val) => setFormData({ ...formData, memoryMB: val })}
                                            min={512}
                                            max={16104}
                                            step={64}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Java Arguments */}
                    <div>
                        <ToggleSwitch
                            enabled={formData.useCustomJavaArgs}
                            onChange={(val) => setFormData({ ...formData, useCustomJavaArgs: val })}
                            label="Custom Java arguments"
                            description="Add custom JVM arguments"
                        />

                        <AnimatePresence>
                            {formData.useCustomJavaArgs && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-4 pl-4 border-l-2 border-dark-700">
                                        <textarea
                                            value={formData.javaArgs}
                                            onChange={(e) => setFormData({ ...formData, javaArgs: e.target.value })}
                                            placeholder="-XX:+UnlockExperimentalVMOptions -XX:+UseG1GC"
                                            rows={3}
                                            className="w-full px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-200 placeholder-dark-500 focus:outline-none focus:border-primary-500 font-mono text-sm"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Environment Variables */}
                    <div>
                        <ToggleSwitch
                            enabled={formData.useCustomEnvVars}
                            onChange={(val) => setFormData({ ...formData, useCustomEnvVars: val })}
                            label="Custom environment variables"
                            description="Set environment variables for the game process"
                        />

                        <AnimatePresence>
                            {formData.useCustomEnvVars && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-4 pl-4 border-l-2 border-dark-700">
                                        <textarea
                                            value={formData.envVars}
                                            onChange={(e) => setFormData({ ...formData, envVars: e.target.value })}
                                            placeholder="KEY=value"
                                            rows={3}
                                            className="w-full px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-200 placeholder-dark-500 focus:outline-none focus:border-primary-500 font-mono text-sm"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    )
}

function LaunchHooksTab({ formData, setFormData }: any) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-dark-100 mb-2">Launch Hooks</h3>
                <p className="text-sm text-dark-400 mb-6">
                    Hooks allow advanced users to run certain system commands before and after launching the game.
                </p>

                <div className="space-y-6">
                    <ToggleSwitch
                        enabled={formData.useCustomHooks}
                        onChange={(val) => setFormData({ ...formData, useCustomHooks: val })}
                        label="Custom launch hooks"
                        description="Enable pre-launch, wrapper, and post-exit commands"
                    />

                    <AnimatePresence>
                        {formData.useCustomHooks && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="pl-4 border-l-2 border-dark-700 space-y-4 mt-4">
                                    <div>
                                        <label className="text-sm font-medium text-dark-300 mb-1 block">Pre-launch</label>
                                        <p className="text-xs text-dark-500 mb-2">Ran before the instance is launched.</p>
                                        <input
                                            type="text"
                                            value={formData.preLaunch}
                                            onChange={(e) => setFormData({ ...formData, preLaunch: e.target.value })}
                                            placeholder="echo 'Starting Minecraft...'"
                                            className="w-full px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-200 placeholder-dark-500 focus:outline-none focus:border-primary-500 font-mono text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-dark-300 mb-1 block">Wrapper</label>
                                        <p className="text-xs text-dark-500 mb-2">Wrapper command for launching Minecraft.</p>
                                        <input
                                            type="text"
                                            value={formData.wrapper}
                                            onChange={(e) => setFormData({ ...formData, wrapper: e.target.value })}
                                            placeholder="gamemoderun"
                                            className="w-full px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-200 placeholder-dark-500 focus:outline-none focus:border-primary-500 font-mono text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-dark-300 mb-1 block">Post-exit</label>
                                        <p className="text-xs text-dark-500 mb-2">Ran after the game closes.</p>
                                        <input
                                            type="text"
                                            value={formData.postExit}
                                            onChange={(e) => setFormData({ ...formData, postExit: e.target.value })}
                                            placeholder="echo 'Minecraft closed'"
                                            className="w-full px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-200 placeholder-dark-500 focus:outline-none focus:border-primary-500 font-mono text-sm"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
