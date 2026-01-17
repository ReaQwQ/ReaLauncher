import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Download, X, Loader2, ChevronDown } from 'lucide-react'
import { useVersionList } from '../../hooks/useVersionList'
import { useLoaderVersions } from '../../hooks/useLoaderVersions'
import { ContentSource } from '../../hooks/useContentDetail'
import { useSettingsStore } from '../../stores/settingsStore'
import { useNotificationStore } from '../../stores/notificationStore'

interface InstallContentModalProps {
    isOpen: boolean
    onClose: () => void
    contentId: string
    contentSource: ContentSource
    contentName: string
    contentType: 'mod' | 'modpack'
    defaultGameVersion?: string
    defaultLoader?: string
}

export default function InstallContentModal({
    isOpen,
    onClose,
    contentId,
    contentSource,
    contentName,
    contentType,
    defaultGameVersion,
    defaultLoader
}: InstallContentModalProps) {
    const [name, setName] = useState('')
    const [selectedVersion, setSelectedVersion] = useState('')
    const [minMemory, setMinMemory] = useState(2048)
    const [maxMemory, setMaxMemory] = useState(4096)
    const [isInstalling, setIsInstalling] = useState(false)
    const { memory: defaultMemory } = useSettingsStore()
    const { addNotification } = useNotificationStore()

    // Fetch available versions
    const { data: versions, isLoading: versionsLoading } = useVersionList(
        {
            source: contentSource,
            id: contentId
        },
        isOpen
    )

    // Get selected version data
    const selectedVersionData = versions?.find(v => v.id === selectedVersion)
    const gameVersion = selectedVersionData?.gameVersions[0] || defaultGameVersion || '1.21.1'
    const requiredLoader = selectedVersionData?.loaders[0] || defaultLoader

    // Fetch loader versions for the selected game version and loader type
    const { data: loaderVersions } = useLoaderVersions(
        requiredLoader || 'fabric',
        gameVersion
    )

    // Set default values when modal opens
    useEffect(() => {
        if (isOpen) {
            setName(contentName)
            setMinMemory(defaultMemory.min)
            setMaxMemory(defaultMemory.max)
        }
    }, [isOpen, contentName, defaultMemory])

    // Set default version when versions load
    useEffect(() => {
        if (versions && versions.length > 0 && !selectedVersion) {
            // Select the first version (usually latest)
            setSelectedVersion(versions[0].id)
        }
    }, [versions, selectedVersion])

    const handleInstall = async () => {
        if (!name.trim() || !selectedVersion) return

        setIsInstalling(true)
        try {
            if (!selectedVersionData) {
                throw new Error('Version data not found')
            }

            // Determine loader info with actual version
            let loaderInfo: { type: string; version: string } | undefined

            // For modpacks/mods, extract loader from version data
            if (requiredLoader && loaderVersions && loaderVersions.length > 0) {
                loaderInfo = {
                    type: requiredLoader.toLowerCase(),
                    version: loaderVersions[0].version // Use the latest compatible loader version
                }
                console.log('Using loader:', loaderInfo)
            }

            // Create instance
            console.log('Creating instance with:', { name: name.trim(), gameVersion, loader: loaderInfo, memory: { min: minMemory, max: maxMemory } })

            const instance = await window.electronAPI.launcher.createInstance({
                name: name.trim(),
                version: gameVersion,
                loader: loaderInfo,
                memory: { min: minMemory, max: maxMemory }
            })

            console.log('Instance created:', instance)

            // Install content (Mod or Modpack) to the instance
            const projectData = {
                project_id: contentId.replace(/^(cf|mr)-/, ''),
                title: contentName,
                project_type: contentType
            }

            console.log(`[Install] Calling installContent for ${contentType}:`, projectData)
            const result = await window.electronAPI.eml.installContent(projectData, instance)

            if (result.success) {
                addNotification({
                    type: 'success',
                    title: 'Installation Successful',
                    message: `Successfully installed "${contentName}" to instance "${name}"!${contentType === 'modpack' ? ` (${result.modCount} mods installed)` : ''}`
                })
            } else {
                throw new Error(result.error || 'Installation failed')
            }

            onClose()
            setName('')
            setSelectedVersion('')
        } catch (error: any) {
            console.error('Failed to install:', error)
            addNotification({
                type: 'error',
                title: 'Installation Failed',
                message: error.message || 'Unknown error'
            })
        } finally {
            setIsInstalling(false)
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
                className="relative z-10 w-full max-w-2xl glass-card p-6 max-h-[85vh] overflow-hidden flex flex-col"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-dark-100 flex items-center gap-2">
                        <Download size={24} className="text-primary-500" />
                        Install {contentType === 'modpack' ? 'Modpack' : 'Mod'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-dark-800 rounded-lg transition-colors text-dark-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                    {/* Content Name Display */}
                    <div className="glass-card p-4 bg-dark-800/50 border border-primary-500/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-dark-500 uppercase tracking-wider mb-1">
                                    {contentType === 'modpack' ? 'Modpack' : 'Mod'}
                                </p>
                                <h3 className="text-lg font-bold text-dark-100">{contentName}</h3>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${contentSource === 'curseforge'
                                ? 'bg-orange-600/20 text-orange-400'
                                : 'bg-green-600/20 text-green-400'
                                }`}>
                                {contentSource === 'curseforge' ? 'CurseForge' : 'Modrinth'}
                            </span>
                        </div>
                    </div>

                    {/* Instance Name */}
                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-2">
                            Instance Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter instance name..."
                            className="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-100 placeholder-dark-500 focus:outline-none focus:border-primary-500"
                        />
                    </div>

                    {/* Version Selection */}
                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-2">
                            {contentType === 'modpack' ? 'Modpack' : 'Mod'} Version
                        </label>
                        {versionsLoading ? (
                            <div className="px-4 py-8 text-center">
                                <Loader2 size={24} className="mx-auto text-primary-400 animate-spin mb-2" />
                                <p className="text-sm text-dark-500">Loading versions...</p>
                            </div>
                        ) : versions && versions.length > 0 ? (
                            <div className="relative">
                                <select
                                    value={selectedVersion}
                                    onChange={(e) => setSelectedVersion(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-100 focus:outline-none focus:border-primary-500 appearance-none cursor-pointer"
                                >
                                    {versions.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.name} ({v.gameVersions.join(', ')}) - {new Date(v.datePublished).toLocaleDateString()}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 pointer-events-none" />
                            </div>
                        ) : (
                            <p className="text-sm text-dark-500 px-4 py-2">No versions available</p>
                        )}
                    </div>

                    {/* Game Version (Disabled for modpack) */}
                    {selectedVersionData && (
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-2">
                                Minecraft Version
                            </label>
                            <input
                                type="text"
                                value={selectedVersionData.gameVersions.join(', ')}
                                disabled
                                className="w-full px-4 py-2.5 rounded-lg bg-dark-800/50 border border-dark-700 text-dark-400 cursor-not-allowed"
                            />
                            <p className="text-xs text-dark-500 mt-1">Determined by {contentType} version</p>
                        </div>
                    )}

                    {/* Loader (Disabled for modpack) */}
                    {defaultLoader && (
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-2">
                                Mod Loader
                            </label>
                            <input
                                type="text"
                                value={defaultLoader.charAt(0).toUpperCase() + defaultLoader.slice(1)}
                                disabled
                                className="w-full px-4 py-2.5 rounded-lg bg-dark-800/50 border border-dark-700 text-dark-400 cursor-not-allowed"
                            />
                            <p className="text-xs text-dark-500 mt-1">Determined by {contentType}</p>
                        </div>
                    )}

                    {/* Memory Settings */}
                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-3">
                            Memory Allocation
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-dark-500 mb-2">Minimum (MB)</label>
                                <input
                                    type="number"
                                    value={minMemory}
                                    onChange={(e) => setMinMemory(parseInt(e.target.value) || 512)}
                                    min={512}
                                    max={maxMemory}
                                    step={512}
                                    className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-100 focus:outline-none focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-dark-500 mb-2">Maximum (MB)</label>
                                <input
                                    type="number"
                                    value={maxMemory}
                                    onChange={(e) => setMaxMemory(parseInt(e.target.value) || 2048)}
                                    min={minMemory}
                                    step={512}
                                    className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-100 focus:outline-none focus:border-primary-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-dark-700">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-dark-100 font-medium transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleInstall}
                        disabled={isInstalling || !name.trim() || !selectedVersion}
                        className={`px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${isInstalling || !name.trim() || !selectedVersion
                            ? 'bg-dark-700 text-dark-500 cursor-not-allowed'
                            : 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-600/20'
                            }`}
                    >
                        {isInstalling ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Installing...
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                Install
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
