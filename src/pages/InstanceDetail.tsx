import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft, Play, Settings, MoreVertical, Search, X, Download, Trash2, Loader2, Globe,
    Compass, Bug, Home, DollarSign, Swords, Carrot, Sliders, Book, Wand2, BarChart3, Gamepad2, Zap, MessageSquare, Box, Cpu, Truck, Wrench, Monitor, Server,
    ChevronDown, FolderOpen, RefreshCw, Terminal
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useNotificationStore } from '../stores/notificationStore'
import { useUIStore } from '../stores/uiStore'
import InstanceSettingsModal from '../components/modals/InstanceSettingsModal'
import FileBrowserModal from '../components/modals/FileBrowserModal'
import { GameConsole } from '../components/GameConsole'

interface MinecraftInstance {
    id: string
    name: string
    description?: string
    version: string
    loader?: { type: string; version: string }
    javaPath?: string
    memory: { min: number; max: number }
    mods: any[]
    resourcepacks?: any[]
    shaderpacks?: any[]
    datapacks?: any[]
    icon?: string
    iconUrl?: string
    lastPlayed?: string
    lastUse?: string
    created: string
    path?: string
}

interface Mod {
    id: string
    name: string
    description: string
    author: string
    iconUrl?: string
    downloadUrl: string
    fileName: string
    version: string
    updated: string
    enabled: boolean
    source: string
    slug?: string
    authorId?: string
    authors?: { name: string, id: string }[]
    categories?: string[]
}

type ContentTab = 'content' | 'worlds' | 'logs' | 'install-content'
type ContentType = 'mods' | 'resourcepacks' | 'shaders' | 'datapacks' | 'all'
type InstallTab = 'mods' | 'resourcepacks' | 'datapacks' | 'shaders'
type ModPlatform = 'modrinth' | 'curseforge' | 'github'

interface CustomSelectProps {
    label: string
    value: any
    options: { value: any; label: any }[]
    onChange: (value: any) => void
    className?: string
}

function CustomSelect({ label, value, options, onChange, className = "" }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const activeLabel = options.find(opt => opt.value === value)?.label || value

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-100 text-xs font-semibold hover:bg-dark-700 transition-all min-w-[100px] justify-between"
            >
                <span>{label}: <span className="text-primary-400">{activeLabel}</span></span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 mt-1.5 w-full min-w-[140px] bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 overflow-hidden py-1"
                        >
                            {options.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value)
                                        setIsOpen(false)
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${opt.value === value
                                        ? 'bg-green-600 text-dark-950 font-bold'
                                        : 'text-dark-200 hover:bg-dark-700'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}

export default function InstanceDetail() {
    const { instanceId } = useParams<{ instanceId: string }>()
    const navigate = useNavigate()
    const [instance, setInstance] = useState<MinecraftInstance | null>(null)
    const [installedMods, setInstalledMods] = useState<Mod[]>([])
    const [resourcePacks, setResourcePacks] = useState<any[]>([])
    const [shaderPacks, setShaderPacks] = useState<any[]>([])
    const [datapacks, setDatapacks] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState<ContentTab>('content')
    const [activeContentType, setActiveContentType] = useState<ContentType>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [installTab, setInstallTab] = useState<InstallTab>('mods')
    const [installSearchQuery, setInstallSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState('relevance')
    const [viewCount, setViewCount] = useState(20)
    const [activePlatform, setActivePlatform] = useState<ModPlatform>('modrinth')
    const [isPlaying, setIsPlaying] = useState(false)
    const [worlds, setWorlds] = useState<any[]>([])
    const [logs, setLogs] = useState<string>('')
    const [logType, setLogType] = useState<'latest' | 'crash'>('latest')
    const [crashReports, setCrashReports] = useState<string[]>([])
    const [selectedCrashReport, setSelectedCrashReport] = useState<string>('')
    const [crashReportContent, setCrashReportContent] = useState<string>('')
    const [hideInstalled, setHideInstalled] = useState(false)
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isDetecting, setIsDetecting] = useState(false)
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [selectedEnvironment, setSelectedEnvironment] = useState<string | null>(null)
    const [installingStates, setInstallingStates] = useState<Record<string, boolean>>({})
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    const [contentFilter, setContentFilter] = useState<'all' | 'enabled' | 'disabled' | 'no-metadata'>('all')
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [isConsoleOpen, setIsConsoleOpen] = useState(false)
    const { activeProfile } = useAuthStore()
    const { addNotification } = useNotificationStore()
    const { t, addRunningInstance, removeRunningInstance, isInstanceRunning } = useUIStore()

    useEffect(() => {
        if (!instance) return
        if (instance.mods) setInstalledMods(instance.mods)
        if (instance.resourcepacks) setResourcePacks(instance.resourcepacks)
        if (instance.shaderpacks) setShaderPacks(instance.shaderpacks)
        if (instance.datapacks) setDatapacks(instance.datapacks)
    }, [instance])

    useEffect(() => {
        loadInstance()
    }, [instanceId])

    useEffect(() => {
        if (!instance) return
        const unsubscribe = window.electronAPI.eml.onGameClosed((data) => {
            if (data.instanceId === instance.id) {
                setIsPlaying(false)
                removeRunningInstance(instance.id)
            }
        })

        // Listen for instance updates (e.g. during modpack installation)
        const unsubscribeUpdate = (window as any).electronAPI?.launcher?.onInstanceUpdated?.((data: any) => {
            if (data.instanceId === instance.id) {
                loadInstance()
            }
        })

        return () => {
            unsubscribe()
            if (unsubscribeUpdate) unsubscribeUpdate()
        }
    }, [instance?.id, removeRunningInstance])

    const loadInstance = async () => {
        try {
            const instances = await window.electronAPI.launcher.getInstances()
            const found = instances.find((i: any) => i.id === instanceId) as MinecraftInstance | undefined
            if (found) {
                setInstance(found)
            }
        } catch (error) {
            console.error('Failed to load instance:', error)
        }
    }

    const handleSaveInstance = async (updatedInstance: MinecraftInstance) => {
        try {
            await window.electronAPI.launcher.updateInstance(updatedInstance)
            setInstance(updatedInstance)
        } catch (error) {
            console.error('Failed to update instance:', error)
        }
    }

    const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false)

    const handleIconSelected = async (path: string) => {
        if (!instance) return
        try {
            const imageData = await window.electronAPI.launcher.readImage(path)
            if (imageData) {
                const updated = { ...instance, icon: imageData }
                await handleSaveInstance(updated)
            }
        } catch (error) {
            console.error('Failed to read image:', error)
        }
    }

    const handleDeleteInstance = async () => {
        if (!instance) return
        try {
            await window.electronAPI.launcher.deleteInstance(instance.id)
            navigate('/')
        } catch (error) {
            console.error('Failed to delete instance:', error)
        }
    }

    const handleDuplicateInstance = () => {
        console.log('Duplicate not implemented')
    }

    useEffect(() => {
        if (activeTab === 'worlds') {
            fetchWorlds()
        } else if (activeTab === 'logs') {
            if (logType === 'latest') {
                fetchLogs()
            } else {
                fetchCrashReports()
            }
        }
    }, [activeTab, instanceId, logType])

    useEffect(() => {
        if (selectedCrashReport && logType === 'crash') {
            fetchCrashReportContent(selectedCrashReport)
        }
    }, [selectedCrashReport, logType])

    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(0) // Optionally track total pages if we want better UI

    useEffect(() => {
        setPage(1)
    }, [installTab, installSearchQuery, sortBy, viewCount, activePlatform, selectedCategories, selectedEnvironment])

    useEffect(() => {
        if (activeTab === 'install-content') {
            const timer = setTimeout(() => {
                handleSearch()
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [page, viewCount, installSearchQuery, sortBy, activePlatform, selectedCategories, selectedEnvironment, installTab, activeTab])

    const handleSearch = async () => {
        if (!instance) return
        setIsSearching(true)
        try {
            const facets: any[][] = []

            const typeMap: Record<string, string> = {
                'mods': 'project_type:mod',
                'resourcepacks': 'project_type:resourcepack',
                'shaders': 'project_type:shader'
            }
            if (typeMap[installTab]) facets.push([typeMap[installTab]])

            // Only strictly filter by loader for MODS. 
            // Resource packs and shaders typically don't have loader constraints or use "minecraft" as dependency.
            if (installTab === 'mods') {
                if (instance.loader) facets.push([`categories:${instance.loader.type}`])
                facets.push([`versions:${instance.version}`])
            } else {
                // For resource packs/shaders, verify if version filtering is desired. 
                // Often resources are version-agnostic or have loose matching, but strict filtering is safer.
                // User reported issues, likely due to loader. Sticking to version filter is usually fine.
                facets.push([`versions:${instance.version}`])
            }

            selectedCategories.forEach(cat => facets.push([`categories:${cat.toLowerCase()}`]))
            if (selectedEnvironment) facets.push([`categories:${selectedEnvironment.toLowerCase()}`])

            const results = await window.electronAPI.eml.searchContent({
                query: installSearchQuery,
                facets: facets,
                index: sortBy as any,
                limit: viewCount,
                offset: (page - 1) * viewCount
            })
            setSearchResults(results.hits || [])
            // Modrinth returns total_hits. We can use it.
            if (results.total_hits) {
                setTotalPages(Math.ceil(results.total_hits / viewCount))
            }
        } catch (error) {
            console.error('Search failed:', error)
        } finally {
            setIsSearching(false)
        }
    }

    const handleInstall = async (e: React.MouseEvent, project: any) => {
        e.stopPropagation()
        if (!instance) return

        const projectId = project.project_id
        setInstallingStates(prev => ({ ...prev, [projectId]: true }))

        try {
            const result = await window.electronAPI.eml.installContent(project, instance)
            if (result.success) {
                console.log(`Installed ${project.title}`)
                addNotification({
                    type: 'success',
                    title: 'Installation Successful',
                    message: `Successfully installed ${project.title}`
                })
                await loadInstance()
            } else {
                console.error('Install failed:', result.error)
                addNotification({
                    type: 'error',
                    title: 'Installation Failed',
                    message: `Failed to install ${project.title}: ${result.error}`
                })
            }
        } catch (error) {
            console.error('Install exception:', error)
        } finally {
            setInstallingStates(prev => ({ ...prev, [projectId]: false }))
        }
    }

    const handleViewDetail = (result: any) => {
        if (!instance) return
        const source = result.source || (result.project_id.startsWith('cf-') ? 'curseforge' : 'modrinth')
        const type = result.project_type === 'modpack' ? 'modpack' : 'mod'
        const id = result.project_id.replace(/^(cf|mr)-/, '')
        navigate(`/${type}/${source}/${id}?instance=${instance.id}`)
    }

    const fetchWorlds = async () => {
        if (!instanceId) return
        try {
            const result = await window.electronAPI.launcher.getWorlds(instanceId)
            setWorlds(result)
        } catch (error) {
            console.error('Failed to fetch worlds:', error)
        }
    }

    const fetchLogs = async () => {
        if (!instanceId) return
        try {
            const result = await window.electronAPI.launcher.getLogs(instanceId)
            setLogs(result)
        } catch (error) {
            console.error('Failed to fetch logs:', error)
        }
    }

    const fetchCrashReports = async () => {
        if (!instanceId) return
        try {
            const reports = await window.electronAPI.launcher.getCrashReports(instanceId)
            setCrashReports(reports)
        } catch (error) {
            console.error('Failed to fetch crash reports:', error)
        }
    }

    const fetchCrashReportContent = async (reportName: string) => {
        if (!instanceId) return
        try {
            const content = await window.electronAPI.launcher.getCrashReportContent(instanceId, reportName)
            setCrashReportContent(content)
        } catch (error) {
            console.error('Failed to fetch crash report content:', error)
        }
    }

    const handleDetectContent = async () => {
        if (!instance || isDetecting) return
        setIsDetecting(true)
        try {
            const result = await window.electronAPI.eml.detectContent(instance)
            if (result.success) {
                addNotification({
                    type: 'success',
                    title: 'Files Detected',
                    message: 'Successfully updated the content list from folder scanning.'
                })
                await loadInstance()
            } else {
                addNotification({
                    type: 'error',
                    title: 'Detection Failed',
                    message: result.error || 'Unknown error'
                })
            }
        } catch (error) {
            console.error('Detection error:', error)
        } finally {
            setIsDetecting(false)
        }
    }

    const handleOpenLink = (type: 'project' | 'author', item: Mod) => {
        if (type === 'project' && (!item.slug || item.slug === 'Unknown')) return
        if (type === 'author' && (!item.authorId || item.authorId === 'Unknown' || item.author === 'Unknown')) return

        const baseUrl = 'https://modrinth.com'
        let url = ''
        if (type === 'project') {
            const getProjectType = () => {
                if ((item as any).projectType) return (item as any).projectType
                if (activeContentType === 'mods') return 'mod'
                if (activeContentType === 'resourcepacks') return 'resourcepack'
                if (activeContentType === 'shaders') return 'shader'
                if (activeContentType === 'datapacks') return 'datapack'
                return 'mod' // fallback
            }
            const projectType = getProjectType()
            url = `${baseUrl}/${projectType}/${item.slug}`
        } else {
            url = `${baseUrl}/user/${item.authorId}`
        }

        if (url) {
            window.electronAPI.app.openExternal(url)
        }
    }

    const handlePlay = async () => {
        if (!instance || isPlaying || isInstanceRunning(instance.id)) return

        if (!activeProfile) {
            addNotification({
                type: 'warning',
                title: 'Login Required',
                message: 'Please login first'
            })
            return
        }

        setIsPlaying(true)
        setIsConsoleOpen(true) // Open console on launch
        addRunningInstance(instance.id)
        try {
            const result = await window.electronAPI.eml.launch({
                version: instance.version,
                loader: instance.loader,
                memory: instance.memory,
                profile: {
                    id: activeProfile.id,
                    name: activeProfile.name,
                    accessToken: activeProfile.accessToken
                },
                instancePath: instance.path || instance.id,
                instanceId: instance.id,
                instanceName: instance.name
            })

            setIsConsoleOpen(true) // Open console on launch

            if (result.success) {
                window.electronAPI.launcher.updateInstance({ ...instance, lastPlayed: new Date().toISOString() })
            } else {
                addNotification({
                    type: 'error',
                    title: 'Launch Failed',
                    message: result.error || 'Unknown error'
                })
            }
        } catch (error) {
            console.error('Launch error:', error)
            addNotification({
                type: 'error',
                title: 'Launch Error',
                message: 'An unexpected error occurred during launch'
            })
        } finally {
            setIsPlaying(false)
            removeRunningInstance(instance.id)
        }
    }

    const toggleMod = async (modId: string) => {
        if (!instance) return

        // Find the item in all content types
        const allItems = [
            ...installedMods.map(i => ({ ...i, type: 'mods' })),
            ...resourcePacks.map(i => ({ ...i, type: 'resourcepacks' })),
            ...shaderPacks.map(i => ({ ...i, type: 'shaderpacks' })),
            ...datapacks.map(i => ({ ...i, type: 'datapacks' }))
        ]

        const item = allItems.find(m => m.id === modId)
        if (!item) return

        const newEnabled = !item.enabled

        // Optimistic update for the correct state
        const updateState = (prev: any[]) => prev.map(m => m.id === modId ? { ...m, enabled: newEnabled } : m)

        if (item.type === 'mods') setInstalledMods(updateState)
        else if (item.type === 'resourcepacks') setResourcePacks(updateState)
        else if (item.type === 'shaderpacks') setShaderPacks(updateState)
        else if (item.type === 'datapacks') setDatapacks(updateState)

        try {
            const result = await window.electronAPI.eml.toggleContent(instance.id, item.fileName, newEnabled)
            if (result && !result.success) {
                throw new Error(result.error || 'Failed to toggle content')
            }
        } catch (error) {
            console.error('Failed to toggle content:', error)
            addNotification({
                type: 'error',
                title: 'Toggle Failed',
                message: `Failed to ${newEnabled ? 'enable' : 'disable'} ${item.name}`
            })
            // Revert state
            const revertState = (prev: any[]) => prev.map(m => m.id === modId ? { ...m, enabled: !newEnabled } : m)
            if (item.type === 'mods') setInstalledMods(revertState)
            else if (item.type === 'resourcepacks') setResourcePacks(revertState)
            else if (item.type === 'shaderpacks') setShaderPacks(revertState)
            else if (item.type === 'datapacks') setDatapacks(revertState)
        }
    }

    const removeMod = (modId: string) => {
        // Find which list it's in and remove it
        setInstalledMods(prev => prev.filter(mod => mod.id !== modId))
        setResourcePacks(prev => prev.filter(mod => mod.id !== modId))
        setShaderPacks(prev => prev.filter(mod => mod.id !== modId))
        setDatapacks(prev => prev.filter(mod => mod.id !== modId))

        // Backend removal could be added here later
    }

    if (!instance) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-dark-500">Loading...</p>
            </div>
        )
    }

    const contentTabs = [
        { id: 'content' as ContentTab, name: t('instance_detail.tabs.content') },
        { id: 'worlds' as ContentTab, name: t('instance_detail.tabs.worlds') },
        { id: 'logs' as ContentTab, name: t('instance_detail.tabs.logs') },
        { id: 'install-content' as ContentTab, name: t('instance_detail.tabs.install') },
    ]

    const contentTypes = [
        { id: 'mods' as ContentType, name: t('instance_detail.content_types.mods') },
        { id: 'resourcepacks' as ContentType, name: t('instance_detail.content_types.resourcepacks') },
        { id: 'shaders' as ContentType, name: t('instance_detail.content_types.shaders') },
        { id: 'datapacks' as ContentType, name: t('instance_detail.content_types.datapacks') },
    ]

    const getDisplayedContent = () => {
        let content: any[] = []
        switch (activeContentType) {
            case 'all':
                content = [
                    ...installedMods.map(i => ({ ...i, projectType: 'mod' })),
                    ...resourcePacks.map(i => ({ ...i, projectType: 'resourcepack' })),
                    ...shaderPacks.map(i => ({ ...i, projectType: 'shader' })),
                    ...datapacks.map(i => ({ ...i, projectType: 'datapack' }))
                ];
                break
            case 'mods': content = installedMods; break
            case 'resourcepacks': content = resourcePacks; break
            case 'shaders': content = shaderPacks; break
            case 'datapacks': content = datapacks; break
        }

        let filtered = content
        if (contentFilter === 'enabled') filtered = content.filter(item => item.enabled !== false)
        else if (contentFilter === 'disabled') filtered = content.filter(item => item.enabled === false)
        else if (contentFilter === 'no-metadata') filtered = content.filter(item => !item.id || item.id === item.fileName) // Simple check for no metadata

        return filtered
    }

    const displayedContent = getDisplayedContent()
    const filteredMods = displayedContent.filter((mod: any) =>
        mod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mod.author.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }))

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-dark-700">
                <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div
                        onClick={() => setIsFileBrowserOpen(true)}
                        className="w-16 h-16 rounded-lg bg-dark-800 border-2 border-dark-700 overflow-hidden flex items-center justify-center cursor-pointer hover:border-primary-500 transition-colors group relative"
                    >
                        {instance.icon || instance.iconUrl ? (
                            <img src={instance.icon || instance.iconUrl} alt={instance.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-2xl font-bold text-dark-500 group-hover:text-primary-500 transition-colors">
                                {instance.name.charAt(0).toUpperCase()}
                            </span>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-xs font-medium text-white">{t('instance_detail.actions.change_icon')}</span>
                        </div>
                    </div>

                    {/* Info */}
                    <div>
                        <h1 className="text-2xl font-bold text-dark-100">{instance.name.replace(/\sInstance$/i, '')}</h1>
                        <div className="flex items-center gap-3 mt-1 text-sm text-dark-400">
                            {instance.loader && (
                                <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary-400"></span>
                                    {instance.loader.type} {instance.version}
                                </span>
                            )}
                            {instance.lastPlayed && (
                                <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-dark-600"></span>
                                    {new Date(instance.lastPlayed).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>


                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/instances')}
                        className="px-6 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-dark-100 transition-all flex items-center gap-2 text-sm font-medium"
                    >
                        <ArrowLeft size={16} />
                        {t('instance_detail.actions.back')}
                    </button>
                    <button
                        onClick={() => setShowSettingsModal(true)}
                        className="px-6 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-dark-100 transition-all flex items-center gap-2 text-sm font-medium"
                    >
                        <Settings size={16} />
                        {t('instance_detail.actions.settings')}
                    </button>
                    <button
                        onClick={async () => {
                            if (instance.path) {
                                const result = await window.electronAPI.launcher.openFolder(instance.path)
                                if (!result.success) {
                                    addNotification({
                                        type: 'error',
                                        title: 'Folder Access Error',
                                        message: result.error || 'Unknown error'
                                    })
                                }
                            }
                        }}
                        className="px-6 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-dark-100 transition-all flex items-center gap-2 text-sm font-medium"
                    >
                        <FolderOpen size={16} />
                        {t('instance_detail.actions.open_folder')}
                    </button>
                    <button
                        onClick={() => setIsConsoleOpen(true)}
                        className="px-6 py-2 rounded-lg bg-dark-800 hover:bg-primary-500/10 text-dark-300 hover:text-primary-400 transition-all flex items-center gap-2 text-sm font-medium border border-dark-700 hover:border-primary-500/30"
                        title="Open Console"
                    >
                        <Terminal size={16} />
                    </button>
                    <button
                        onClick={handlePlay}
                        disabled={isPlaying || (instance && isInstanceRunning(instance.id))}
                        className={`px-6 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${isPlaying || (instance && isInstanceRunning(instance.id))
                            ? 'bg-dark-700 text-dark-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'
                            }`}
                    >
                        {isPlaying ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                {t('instance_detail.actions.launching')}
                            </>
                        ) : (
                            <>
                                <Play size={18} fill="currentColor" />
                                {t('instance_detail.actions.play')}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
                {contentTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                            ? 'bg-green-600 text-white'
                            : 'bg-dark-800 text-dark-400 hover:bg-dark-700 hover:text-dark-200'
                            }`}
                    >
                        {tab.name}
                    </button>
                ))}
            </div>

            {/* Content Tab */}
            {activeTab === 'content' && (
                <motion.div
                    key="content-tab"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col overflow-hidden"
                >
                    {/* Search & Filters */}
                    <div className="mb-4 space-y-3">
                        {/* Search */}
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('instance_detail.search_placeholder')}
                                className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-100 placeholder-dark-500 focus:outline-none focus:border-primary-500"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-24 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300"
                                >
                                    <X size={16} />
                                </button>
                            )}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                <div className="relative">
                                    <button
                                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                                        className={`px-3 py-1.5 rounded-full bg-dark-700 hover:bg-dark-600 text-dark-300 hover:text-dark-100 transition-all text-xs font-semibold flex items-center gap-1.5 ${contentFilter !== 'all' ? 'text-green-500' : ''}`}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M2 2h6v6H2V2zm0 8h6v6H2v-6zm8-8h6v6h-6V2zm0 8h6v6h-6v-6z" />
                                        </svg>
                                        {t('instance_detail.filters.title')}
                                        <ChevronDown size={12} className={`transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    <AnimatePresence>
                                        {isFilterOpen && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                                                <motion.div
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 5 }}
                                                    className="absolute right-0 top-full mt-1.5 w-32 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 overflow-hidden py-1"
                                                >
                                                    {[
                                                        { id: 'all', label: t('instance_detail.filters.all') },
                                                        { id: 'enabled', label: t('instance_detail.filters.enabled') },
                                                        { id: 'disabled', label: t('instance_detail.filters.disabled') },
                                                        { id: 'no-metadata', label: t('instance_detail.filters.no_metadata') }
                                                    ].map((filter) => (
                                                        <button
                                                            key={filter.id}
                                                            onClick={() => {
                                                                setContentFilter(filter.id as any)
                                                                setIsFilterOpen(false)
                                                            }}
                                                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${contentFilter === filter.id
                                                                ? 'bg-green-600 text-dark-950 font-bold'
                                                                : 'text-dark-200 hover:bg-dark-700'
                                                                }`}
                                                        >
                                                            {filter.label}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <button
                                    onClick={handleDetectContent}
                                    disabled={isDetecting}
                                    title="Detect files from folder"
                                    className={`px-3 py-1.5 rounded-full bg-dark-700 hover:bg-dark-600 text-dark-300 hover:text-dark-100 transition-all text-xs font-semibold flex items-center gap-1.5 ${isDetecting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <RefreshCw size={12} className={isDetecting ? 'animate-spin' : ''} />
                                    {t('instance_detail.filters.refresh')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('install-content')}
                                    className="px-4 py-1.5 rounded-full bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium flex items-center gap-1.5 shadow-lg shadow-primary-900/20"
                                >
                                    <Download size={14} />
                                    Install content
                                </button>
                            </div>
                        </div>

                        {/* Content Type Filters */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setActiveContentType('all')}
                                className={`p-1.5 rounded-lg transition-all ${activeContentType === 'all'
                                    ? 'bg-primary-600 text-white'
                                    : 'text-dark-400 hover:text-dark-200'
                                    }`}
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M2 2h6v6H2V2zm0 8h6v6H2v-6zm8-8h6v6h-6V2zm0 8h6v6h-6v-6z" />
                                </svg>
                            </button>
                            {contentTypes.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => setActiveContentType(type.id)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeContentType === type.id
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-transparent text-dark-400 hover:text-dark-200'
                                        }`}
                                >
                                    {type.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mods Table */}
                    <div className="flex-1 overflow-auto">
                        {filteredMods.length === 0 ? (
                            <div className="glass-card p-12 text-center">
                                <p className="text-dark-500 mb-4">No {activeContentType} installed</p>
                                <button
                                    onClick={() => setActiveTab('install-content')}
                                    className="px-6 py-2.5 rounded-full bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium"
                                >
                                    Install content
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-px">
                                {/* Table Header */}
                                <div className="flex items-center px-4 py-2 bg-dark-900 text-xs font-medium text-dark-500 border-b border-dark-800">
                                    <div className="flex-1">Name ↑</div>
                                    <div className="w-64">Updated</div>
                                    <div className="w-32 flex items-center justify-end gap-2 relative">
                                        Action
                                    </div>
                                </div>

                                {/* Table Rows */}
                                {filteredMods.map((mod) => (
                                    <motion.div
                                        key={mod.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        onClick={() => mod.slug && mod.slug !== 'Unknown' && handleOpenLink('project', mod)}
                                        className="flex items-center px-4 py-3 bg-dark-900 hover:bg-dark-800 transition-colors border-b border-dark-800 cursor-pointer"
                                    >
                                        {/* Icon + Name */}
                                        <div className="flex-1 flex items-center gap-3">
                                            {mod.iconUrl ? (
                                                <img src={mod.iconUrl} alt={mod.name} className="w-10 h-10 rounded shrink-0" />
                                            ) : (
                                                <div className="w-10 h-10 rounded bg-dark-800 flex items-center justify-center text-dark-500 shrink-0 border border-dark-700">
                                                    <Box size={20} />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <h4
                                                    className={`font-semibold text-dark-100 truncate ${mod.slug && mod.slug !== 'Unknown' ? 'hover:text-primary-400 cursor-pointer underline-offset-4 hover:underline' : ''}`}
                                                    onClick={() => mod.slug && mod.slug !== 'Unknown' && handleOpenLink('project', mod)}
                                                >
                                                    {mod.name}
                                                </h4>
                                                <p className="text-xs text-dark-500 truncate">
                                                    by{' '}
                                                    {mod.authors && mod.authors.length > 0 ? (
                                                        mod.authors.map((author: any, index: number) => (
                                                            <span key={author.id}>
                                                                <span
                                                                    className={author.id && author.id !== 'Unknown' && author.name !== 'Unknown' ? 'hover:text-primary-400 cursor-pointer hover:underline' : ''}
                                                                    onClick={() => author.id && author.id !== 'Unknown' && author.name !== 'Unknown' && window.electronAPI.app.openExternal(`https://modrinth.com/user/${author.id}`)}
                                                                >
                                                                    {author.name}
                                                                </span>
                                                                {index < (mod.authors?.length || 0) - 1 && ', '}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span
                                                            className={mod.authorId && mod.authorId !== 'Unknown' && mod.author !== 'Unknown' ? 'hover:text-primary-400 cursor-pointer hover:underline' : ''}
                                                            onClick={() => mod.authorId && mod.authorId !== 'Unknown' && mod.author !== 'Unknown' && handleOpenLink('author', mod)}
                                                        >
                                                            {mod.author}
                                                        </span>
                                                    )}
                                                </p>
                                                {/* Categories */}
                                                {mod.categories && mod.categories.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {mod.categories.map((cat: string) => (
                                                            <span key={cat} className="px-1.5 py-0.5 rounded bg-dark-800 text-[10px] text-dark-400 border border-dark-700 font-medium">
                                                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Version Info */}
                                        <div className="w-64">
                                            <p className="text-sm text-dark-200">{mod.version}</p>
                                            <p className="text-xs text-dark-500">{mod.fileName}</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="w-32 flex items-center justify-end gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleMod(mod.id);
                                                }}
                                                className={`w-10 h-6 rounded-full transition-all relative ${mod.enabled ? 'bg-green-600' : 'bg-dark-700'
                                                    }`}
                                            >
                                                <motion.span
                                                    layout
                                                    transition={{ type: "spring", stiffness: 700, damping: 30 }}
                                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white ${mod.enabled ? 'right-1' : 'left-1'}`}
                                                />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeMod(mod.id);
                                                }}
                                                className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-red-400 transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-dark-200 transition-all"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div >
            )
            }

            {/* Worlds Tab */}
            {
                activeTab === 'worlds' && (
                    <motion.div
                        key="worlds-tab"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 overflow-auto"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {worlds.length > 0 ? (
                                worlds.map((world) => (
                                    <div key={world.name} className="glass-card p-4 flex items-center gap-4 group">
                                        <div className="w-16 h-16 rounded bg-dark-800 flex items-center justify-center text-dark-500">
                                            <Globe size={32} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-bold text-dark-100 truncate">{world.name}</h3>
                                            <p className="text-xs text-dark-500 mt-1">
                                                Last played: {new Date(world.lastPlayed).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <button className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 opacity-0 group-hover:opacity-100 transition-all">
                                            <Play size={16} fill="currentColor" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full py-20 text-center">
                                    <Globe size={48} className="mx-auto text-dark-700 mb-4" />
                                    <p className="text-dark-500">No worlds found in this instance.</p>
                                    <p className="text-xs text-dark-600 mt-1">Worlds you create will appear here.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )
            }

            {/* Logs Tab */}
            {
                activeTab === 'logs' && (
                    <motion.div
                        key="logs-tab"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 flex flex-col overflow-hidden bg-dark-950 rounded-lg border border-dark-800"
                    >
                        <div className="flex items-center justify-between px-4 py-2 border-b border-dark-800 bg-dark-900/50">
                            <div className="flex items-center gap-4">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setLogType('latest')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${logType === 'latest' ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-dark-200'}`}
                                    >
                                        latest.log
                                    </button>
                                    <button
                                        onClick={() => setLogType('crash')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${logType === 'crash' ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-dark-200'}`}
                                    >
                                        Crash Reports
                                    </button>
                                </div>

                                {logType === 'crash' && crashReports.length > 0 && (
                                    <select
                                        value={selectedCrashReport}
                                        onChange={(e) => setSelectedCrashReport(e.target.value)}
                                        className="bg-dark-800 border border-dark-700 text-dark-200 text-xs rounded px-2 py-1 outline-none focus:border-primary-500"
                                    >
                                        <option value="">Select crash report...</option>
                                        {crashReports.map(report => (
                                            <option key={report} value={report}>{report}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <button
                                onClick={logType === 'latest' ? fetchLogs : fetchCrashReports}
                                className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                            >
                                Refresh
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-dark-300 whitespace-pre">
                            {logType === 'latest'
                                ? (logs || 'No logs found or loading...')
                                : (selectedCrashReport
                                    ? (crashReportContent || 'Loading report...')
                                    : (crashReports.length > 0 ? 'Select a crash report to view' : 'No crash reports found'))
                            }
                        </div>
                    </motion.div>
                )
            }

            {/* Install Content Tab */}
            {
                activeTab === 'install-content' && (
                    <motion.div
                        key="install-content-tab"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 flex flex-row overflow-hidden gap-4"
                    >
                        {/* Main Content Area */}
                        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                            {/* Header with Back Button */}
                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-dark-700">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded bg-dark-800 flex items-center justify-center">
                                        {instance.icon ? (
                                            <img src={instance.icon} alt={instance.name} className="w-full h-full rounded" />
                                        ) : (
                                            <span className="text-sm font-bold text-dark-500">
                                                {instance.name.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-dark-100">Install content to instance</h2>
                                        <p className="text-xs text-dark-500">
                                            {instance.loader?.type} {instance.version}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setActiveTab('content')}
                                    className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-dark-100 transition-all flex items-center gap-1.5 text-xs"
                                >
                                    <ArrowLeft size={14} />
                                    Back to instance
                                </button>
                            </div>

                            {/* Install Tabs */}
                            <div className="flex gap-1.5 mb-2">
                                {[
                                    { id: 'mods' as InstallTab, name: 'Mods' },
                                    { id: 'resourcepacks' as InstallTab, name: 'Resource Packs' },
                                    { id: 'datapacks' as InstallTab, name: 'Data Packs' },
                                    { id: 'shaders' as InstallTab, name: 'Shaders' },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setInstallTab(tab.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${installTab === tab.id
                                            ? 'bg-green-600 text-white'
                                            : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                                            }`}
                                    >
                                        {tab.name}
                                    </button>
                                ))}
                            </div>
                            {/* Search & Filters */}
                            <div className="space-y-2 mb-3">
                                <div className="relative">
                                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-500" />
                                    <input
                                        type="text"
                                        value={installSearchQuery}
                                        onChange={(e) => setInstallSearchQuery(e.target.value)}
                                        placeholder={`Search ${installTab}...`}
                                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-100 text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500"
                                    />
                                </div>

                                <div className="flex items-center gap-3">
                                    <CustomSelect
                                        label="Platform"
                                        value={activePlatform}
                                        onChange={setActivePlatform}
                                        options={[
                                            { value: 'modrinth', label: 'Modrinth' },
                                            { value: 'curseforge', label: 'CurseForge' },
                                            { value: 'github', label: 'GitHub' },
                                        ]}
                                    />
                                    <CustomSelect
                                        label="Sort by"
                                        value={sortBy}
                                        onChange={setSortBy}
                                        options={[
                                            { value: 'relevance', label: 'Relevance' },
                                            { value: 'downloads', label: 'Downloads' },
                                            { value: 'updated', label: 'Recently Updated' },
                                        ]}
                                    />
                                    <CustomSelect
                                        label="View"
                                        value={viewCount}
                                        onChange={setViewCount}
                                        options={[
                                            { value: 5, label: 5 },
                                            { value: 10, label: 10 },
                                            { value: 20, label: 20 },
                                            { value: 50, label: 50 },
                                            { value: 100, label: 100 },
                                        ]}
                                    />

                                    {/* Version Filters */}
                                    {instance && (
                                        <div className="flex items-center gap-1.5 ml-auto">
                                            <span className="px-2 py-0.5 rounded bg-primary-600/20 text-primary-400 text-xs font-medium">
                                                {instance.version}
                                            </span>
                                            {instance.loader && (
                                                <span className="px-2 py-0.5 rounded bg-dark-700 text-dark-300 text-xs font-medium">
                                                    {instance.loader.type}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Content List */}
                            <div className="flex-1 overflow-auto">
                                {isSearching ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-dark-500">
                                        <Loader2 size={48} className="animate-spin mb-4 text-primary-500" />
                                        <p>Searching for content...</p>
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <div className="space-y-3 pb-4">
                                        {searchResults
                                            .filter(result => !hideInstalled || !installedMods.some(m => m.id === result.project_id || m.slug === result.pk))
                                            .map((result) => (
                                                <div
                                                    key={result.project_id}
                                                    onClick={() => handleViewDetail(result)}
                                                    className="glass-card p-4 flex gap-5 group hover:border-green-500/30 transition-all cursor-pointer min-h-[110px]"
                                                >
                                                    {/* Icon */}
                                                    <div className="relative shrink-0">
                                                        {result.icon_url ? (
                                                            <img src={result.icon_url} alt={result.title} className="w-20 h-20 rounded-xl bg-dark-800 object-cover shadow-lg border border-dark-700" />
                                                        ) : (
                                                            <div className="w-20 h-20 rounded-xl bg-dark-800 flex items-center justify-center text-dark-500 border border-dark-700">
                                                                <Box size={40} />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                                        <div>
                                                            <div className="flex items-baseline gap-2">
                                                                <h3 className="text-lg font-bold text-dark-500 group-hover:text-dark-100 transition-colors truncate">
                                                                    {result.title}
                                                                </h3>
                                                                <span className="text-xs text-dark-500" onClick={(e) => e.stopPropagation()}>
                                                                    by <span
                                                                        className="text-dark-400 hover:text-primary-400 cursor-pointer"
                                                                        onClick={() => {
                                                                            const source = result.source || (result.project_id.startsWith('cf-') ? 'curseforge' : 'modrinth')
                                                                            if (source === 'modrinth') {
                                                                                window.electronAPI.app.openExternal(`https://modrinth.com/user/${result.author}`)
                                                                            }
                                                                        }}
                                                                    >
                                                                        {result.author}
                                                                    </span>
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-dark-400 mt-0.5 line-clamp-2 leading-relaxed max-w-2xl">
                                                                {result.description}
                                                            </p>
                                                        </div>

                                                        {/* Categories / Tags */}
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            <div className="p-1 text-dark-500">
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-tag"><path d="M12.586 2.586 19 9l-7 7-6.414-6.414a2 2 0 0 1 0-2.828l6.414-6.414a2 2 0 0 1 2.828 0Z" /><path d="m15 5 4 4" /></svg>
                                                            </div>
                                                            {result.categories?.slice(0, 6).map((cat: string) => (
                                                                <span key={cat} className="px-2.5 py-0.5 rounded-full bg-dark-800 text-[10px] text-dark-300 border border-dark-700 font-bold uppercase tracking-wider">
                                                                    {cat.replace(/-/g, ' ')}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Stats & Actions */}
                                                    <div className="flex flex-col items-end justify-between shrink-0">
                                                        <div className="space-y-1 text-right">
                                                            <div className="flex items-center justify-end gap-1.5 text-xs text-dark-400 font-medium">
                                                                <Download size={14} className="text-dark-500" />
                                                                <span>{result.downloads > 1000000 ? (result.downloads / 1000000).toFixed(2) + 'M' : result.downloads.toLocaleString()} downloads</span>
                                                            </div>
                                                            <div className="flex items-center justify-end gap-1.5 text-xs text-dark-400 font-medium">
                                                                <BarChart3 size={14} className="text-dark-500" />
                                                                <span>{result.follows?.toLocaleString() || 0} followers</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            {installedMods.some(m => m.id === result.project_id || m.slug === result.pk) ? (
                                                                <div className="px-5 py-1.5 rounded-lg bg-transparent border border-green-500/50 text-green-500 text-sm font-bold flex items-center gap-2">
                                                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                                        <path d="M13 4L6 11L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                    </svg>
                                                                    Installed
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => handleInstall(e, result)}
                                                                    disabled={installingStates[result.project_id]}
                                                                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all shadow-lg min-w-[100px] flex items-center justify-center ${installingStates[result.project_id]
                                                                        ? 'bg-dark-700 text-dark-400 cursor-not-allowed border border-dark-600'
                                                                        : 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20 border border-green-500/50 active:scale-95'
                                                                        }`}
                                                                >
                                                                    {installingStates[result.project_id] ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <Loader2 size={16} className="animate-spin" />
                                                                            <span>Installing</span>
                                                                        </div>
                                                                    ) : (
                                                                        'Install'
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 text-dark-500">
                                        <Search size={48} className="mb-4 text-dark-700" />
                                        <p>No results found.</p>
                                        <p className="text-xs text-dark-600 mt-1">Try adjusting your filters or search query.</p>
                                    </div>
                                )}
                            </div>

                            {/* Pagination */}
                            {searchResults.length > 0 && (
                                <div className="flex items-center justify-between border-t border-dark-700 pt-3 mt-1 px-1">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1 || isSearching}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${page === 1 || isSearching
                                            ? 'text-dark-500 cursor-not-allowed'
                                            : 'text-dark-200 hover:bg-dark-700 hover:text-dark-100'
                                            }`}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z" /></svg>
                                        Previous
                                    </button>

                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-dark-400">Page {page} {totalPages > 0 && `of ${totalPages}`}</span>
                                    </div>

                                    <button
                                        onClick={() => setPage(p => p + 1)}
                                        disabled={searchResults.length < viewCount || (totalPages > 0 && page >= totalPages) || isSearching}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${searchResults.length < viewCount || (totalPages > 0 && page >= totalPages) || isSearching
                                            ? 'text-dark-500 cursor-not-allowed'
                                            : 'text-dark-200 hover:bg-dark-700 hover:text-dark-100'
                                            }`}
                                    >
                                        Next
                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" /></svg>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Filters Sidebar */}
                        <div className="w-80 space-y-4 overflow-y-auto pr-1">
                            {/* Hide installed content */}
                            <div
                                onClick={() => setHideInstalled(!hideInstalled)}
                                className={`glass-card p-3 cursor-pointer hover:bg-dark-800/40 transition-all border-2 border-transparent ${hideInstalled ? 'bg-green-600 border-green-500/50' : ''}`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm font-semibold ${hideInstalled ? 'text-dark-950' : 'text-dark-100'}`}>Hide installed content</span>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${hideInstalled ? 'bg-dark-950 border-dark-950' : 'bg-dark-800 border-dark-600'}`}>
                                        {hideInstalled && (
                                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="text-green-500">
                                                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Game version */}
                            <div className="glass-card p-3">
                                <button className="w-full flex items-center justify-between text-sm font-semibold text-dark-100">
                                    <span>Game version</span>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M4 6l4 4 4-4" />
                                    </svg>
                                </button>
                                <p className="text-xs text-dark-400 mt-2">{instance.version}</p>
                            </div>

                            {/* Loader */}
                            <div className="glass-card p-3">
                                <button className="w-full flex items-center justify-between text-sm font-semibold text-dark-100">
                                    <span>Loader</span>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M4 6l4 4 4-4" />
                                    </svg>
                                </button>
                                <p className="text-xs text-primary-400 mt-2">{instance.loader?.type || 'None'}</p>
                            </div>

                            {/* Categories */}
                            <div className="glass-card p-3">
                                <button className="w-full flex items-center justify-between text-sm font-semibold text-dark-100 mb-3">
                                    <span>Categories</span>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M4 10l4-4 4 4" />
                                    </svg>
                                </button>
                                <div className="space-y-2">
                                    {[
                                        { icon: <Compass size={14} className="text-dark-400" />, name: 'Adventure' },
                                        { icon: <Bug size={14} className="text-dark-400" />, name: 'Cursed' },
                                        { icon: <Home size={14} className="text-dark-400" />, name: 'Decoration' },
                                        { icon: <DollarSign size={14} className="text-dark-400" />, name: 'Economy' },
                                        { icon: <Swords size={14} className="text-dark-400" />, name: 'Equipment' },
                                        { icon: <Carrot size={14} className="text-dark-400" />, name: 'Food' },
                                        { icon: <Sliders size={14} className="text-dark-400" />, name: 'Game Mechanics' },
                                        { icon: <Book size={14} className="text-dark-400" />, name: 'Library' },
                                        { icon: <Wand2 size={14} className="text-dark-400" />, name: 'Magic' },
                                        { icon: <BarChart3 size={14} className="text-dark-400" />, name: 'Management' },
                                        { icon: <Gamepad2 size={14} className="text-dark-400" />, name: 'Minigame' },
                                        { icon: <Zap size={14} className="text-dark-400" />, name: 'Optimization' },
                                        { icon: <MessageSquare size={14} className="text-dark-400" />, name: 'Social' },
                                        { icon: <Box size={14} className="text-dark-400" />, name: 'Storage' },
                                        { icon: <Cpu size={14} className="text-dark-400" />, name: 'Technology' },
                                        { icon: <Truck size={14} className="text-dark-400" />, name: 'Transportation' },
                                        { icon: <Wrench size={14} className="text-dark-400" />, name: 'Utility' },
                                        { icon: <Globe size={14} className="text-dark-400" />, name: 'World Generation' },
                                    ].map((category) => (
                                        <label
                                            key={category.name}
                                            className="relative flex items-center justify-between cursor-pointer rounded-full px-4 py-1.5 transition-all group overflow-hidden"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedCategories.includes(category.name.toLowerCase().replace(/\s+/g, '-'))}
                                                onChange={() => {
                                                    const cat = category.name.toLowerCase().replace(/\s+/g, '-')
                                                    setSelectedCategories(prev =>
                                                        prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                                                    )
                                                }}
                                                className="peer sr-only"
                                            />
                                            <div className="absolute inset-0 transition-colors bg-transparent peer-checked:bg-green-500 peer-checked:border peer-checked:border-green-400/50 hover:bg-dark-800/50"></div>
                                            <div className="relative flex items-center gap-2.5 z-10 w-full justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-dark-400 group-hover:text-white transition-colors peer-checked:text-white">{category.icon}</span>
                                                    <span className="text-xs font-bold text-dark-300 peer-checked:text-white transition-colors">{category.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="hidden peer-checked:block text-white">
                                                        <path d="M13 3L6 11 3 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Environment */}
                            <div className="glass-card p-3">
                                <button className="w-full flex items-center justify-between text-sm font-semibold text-dark-100 mb-3">
                                    <span>Environment</span>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M4 10l4-4 4 4" />
                                    </svg>
                                </button>
                                <div className="space-y-2">
                                    {[
                                        { icon: <Monitor size={14} className="text-dark-400" />, name: 'Client' },
                                        { icon: <Server size={14} className="text-dark-400" />, name: 'Server' },
                                    ].map((env) => (
                                        <label
                                            key={env.name}
                                            className="relative flex items-center justify-between cursor-pointer rounded-full px-4 py-1.5 transition-all group overflow-hidden"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedEnvironment === env.name.toLowerCase()}
                                                onChange={() => {
                                                    const val = env.name.toLowerCase()
                                                    setSelectedEnvironment(prev => prev === val ? null : val)
                                                }}
                                                className="peer sr-only"
                                            />
                                            <div className="absolute inset-0 transition-colors bg-transparent peer-checked:bg-green-500 peer-checked:border peer-checked:border-green-400/50 hover:bg-dark-800/50"></div>
                                            <div className="relative flex items-center gap-2.5 z-10 w-full justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-dark-400 group-hover:text-white transition-colors peer-checked:text-white">{env.icon}</span>
                                                    <span className="text-xs font-bold text-dark-300 peer-checked:text-white transition-colors">{env.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="hidden peer-checked:block text-white">
                                                        <path d="M13 3L6 11 3 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* License */}
                            <div className="glass-card p-3">
                                <button className="w-full flex items-center justify-between text-sm font-semibold text-dark-100 mb-3">
                                    <span>License</span>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M4 10l4-4 4 4" />
                                    </svg>
                                </button>
                                <div className="space-y-2">
                                    <label className="relative flex items-center justify-between cursor-pointer hover:bg-dark-800/50 rounded px-2.5 py-1.5 transition-all group">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                className="peer sr-only"
                                            />
                                            <span className="text-xs text-dark-300 peer-checked:text-green-400">📄 Open source</span>
                                        </div>
                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="hidden peer-checked:block text-green-500 group-hover:hidden">
                                            <path d="M13 3L6 11 3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <X size={14} className="hidden peer-checked:group-hover:block text-red-400" />
                                        <div className="absolute inset-0 border-2 border-green-500 rounded hidden peer-checked:block pointer-events-none"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )
            }
            {
                isFileBrowserOpen && (
                    <FileBrowserModal
                        isOpen={isFileBrowserOpen}
                        onClose={() => setIsFileBrowserOpen(false)}
                        onSelect={handleIconSelected}
                        title="Select Icon"
                        allowedExtensions={['png', 'jpg', 'jpeg']}
                    />
                )
            }
            {
                showSettingsModal && instance && (
                    <InstanceSettingsModal
                        isOpen={showSettingsModal}
                        onClose={() => setShowSettingsModal(false)}
                        instance={instance}
                        onSave={(updated) => {
                            handleSaveInstance(updated)
                            setShowSettingsModal(false)
                        }}
                        onDelete={() => {
                            handleDeleteInstance()
                            setShowSettingsModal(false)
                        }}
                        onDuplicate={() => {
                            handleDuplicateInstance()
                            setShowSettingsModal(false)
                        }}
                    />
                )
            }
            <GameConsole
                isOpen={isConsoleOpen}
                onClose={() => setIsConsoleOpen(false)}
                instanceId={instance.id}
            />
        </div>
    )
}
