import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Check, Folder, RefreshCw, Search, Download, Upload, X, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMinecraftVersions } from '../hooks/useMinecraftVersions'
import { useLoaderVersions } from '../hooks/useLoaderVersions'
import { useUIStore } from '../stores/uiStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useInstanceStore, MinecraftInstance } from '../stores/instanceStore'
import { Image as ImageIcon } from 'lucide-react'

const loaderTypes = [
    { id: 'none', name: 'None', color: 'bg-dark-700' },
    { id: 'fabric', name: 'Fabric', color: 'bg-amber-600/20 text-amber-400' },
    { id: 'forge', name: 'Forge', color: 'bg-orange-600/20 text-orange-400' },
    { id: 'legacy-fabric', name: 'Legacy Fabric', color: 'bg-amber-800/20 text-amber-500' },
    { id: 'neoforge', name: 'NeoForge', color: 'bg-red-600/20 text-red-400' },
    { id: 'quilt', name: 'Quilt', color: 'bg-purple-600/20 text-purple-400' }
]

export default function CreateInstance() {
    const navigate = useNavigate()
    const { t } = useUIStore()
    const { memory: defaultMemory } = useSettingsStore()
    const { addInstance, fetchInstances } = useInstanceStore()

    const [activeTab, setActiveTab] = useState<'custom' | 'modpack' | 'launcher'>('custom')

    // Global Action state
    const [isCreating, setIsCreating] = useState(false)
    const [isScanning, setIsScanning] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [importProgress, setImportProgress] = useState('')

    // --- CUSTOM TAB STATE ---
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [version, setVersion] = useState('1.21.1')
    const [loaderType, setLoaderType] = useState('none')
    const [loaderVersion, setLoaderVersion] = useState('')

    // Reset loader version when loader type changes
    const handleLoaderTypeChange = (type: string) => {
        setLoaderType(type)
        setLoaderVersion('')
    }
    const [versionSearch, setVersionSearch] = useState('')
    const [activeVersionFilters, setActiveVersionFilters] = useState<string[]>(['release'])
    const [iconPath, setIconPath] = useState<string>('')
    const [iconPreview, setIconPreview] = useState<string>('')

    const { data: loaderVersions, isLoading: loaderVersionsLoading } = useLoaderVersions(loaderType, version)
    const { data: allVersions, isLoading: versionsLoading } = useMinecraftVersions()

    const filteredVersions = useMemo(() => {
        if (!allVersions) return []
        let vs = allVersions
        vs = vs.filter(v => activeVersionFilters.includes(v.type))
        if (versionSearch) {
            vs = vs.filter(v => v.version.toLowerCase().includes(versionSearch.toLowerCase()))
        }
        return vs
    }, [allVersions, versionSearch, activeVersionFilters])

    useEffect(() => {
        if (allVersions && allVersions.length > 0 && !version) {
            const latestRelease = allVersions.find(v => v.type === 'release')
            if (latestRelease) setVersion(latestRelease.version)
        }
    }, [allVersions, version])

    useEffect(() => {
        if (loaderType === 'none') {
            setLoaderVersion('')
        } else if (loaderVersions && loaderVersions.length > 0) {
            // Verify the loaded versions actually match the selected loader type
            // (prevents using cached/stale versions from a different loader)
            if (loaderVersions[0].loader === loaderType) {
                setLoaderVersion(loaderVersions[0].version)
            } else {
                setLoaderVersion('')
            }
        } else {
            // Clear version while loading or if no versions found
            setLoaderVersion('')
        }
    }, [loaderVersions, loaderType])

    const handleCreate = async () => {
        if (!name.trim()) return
        setIsCreating(true)
        try {
            const instance = await window.electronAPI.launcher.createInstance({
                name: name.trim(),
                version,
                loader: loaderType !== 'none' && loaderVersion ? { type: loaderType, version: loaderVersion } : undefined,
                memory: defaultMemory
            })
            // Update instance with icon if selected
            let finalInstance = { ...(instance as MinecraftInstance), description }
            if (iconPath) {
                // Read image and create Data URI if specific path is needed, or just store path
                // For now, assume storing path is fine or try to read it
                const iconBase64 = await window.electronAPI.launcher.readImage(iconPath)
                if (iconBase64) {
                    finalInstance = { ...finalInstance, icon: iconBase64 }
                } else {
                    finalInstance = { ...finalInstance, icon: iconPath } // Fallback
                }

                await window.electronAPI.launcher.updateInstance(finalInstance)
            } else {
                // Update with description
                await window.electronAPI.launcher.updateInstance(finalInstance)
            }

            addInstance(finalInstance)
            navigate('/instances')
        } catch (error) {
            console.error('Failed to create instance:', error)
        } finally {
            setIsCreating(false)
        }
    }

    // --- MODPACK TAB STATE (Discovery + File) ---
    const [searchQuery, setSearchQuery] = useState('')
    const [modpackResults, setModpackResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)

    useEffect(() => {
        if (activeTab === 'modpack') fetchModpacks()
    }, [activeTab, searchQuery])

    const fetchModpacks = async () => {
        setIsSearching(true)
        try {
            const data = await window.electronAPI.eml.searchContent({
                query: searchQuery,
                facets: [['project_type:modpack']],
                limit: 20
            })
            setModpackResults(data.hits || [])
        } catch (error) {
            console.error('Search failed:', error)
        } finally {
            setIsSearching(false)
        }
    }

    const handleIconSelect = async () => {
        try {
            const path = await window.electronAPI.selectFile('Select Icon', [
                { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'ico'] }
            ])
            if (path) {
                setIconPath(path)
                const preview = await window.electronAPI.launcher.readImage(path)
                if (preview) setIconPreview(preview)
            }
        } catch (error) {
            console.error('Failed to select icon:', error)
        }
    }

    const handleFileSelect = async () => {
        try {
            const filePath = await window.electronAPI.selectFile('Select Modpack File', [
                { name: 'Modpacks', extensions: ['mrpack', 'zip'] }
            ])
            if (filePath) await importModpackFile(filePath)
        } catch (error) {
            console.error('File selection failed:', error)
        }
    }

    const importModpackFile = async (filePath: string) => {
        setIsImporting(true)
        setImportProgress('Starting import...')
        try {
            const removeListener = window.electronAPI.eml.onDownloadProgress((progress: any) => {
                if (progress.filename) setImportProgress(progress.filename)
            })
            const result = await (window.electronAPI as any).importLocalModpack({ filePath })
            removeListener()
            if (result.success) {
                addInstance(result.instance)
                await fetchInstances()
                navigate('/instances')
            } else {
                alert(`Import failed: ${result.error}`)
            }
        } catch (error) {
            console.error('Import failed:', error)
        } finally {
            setIsImporting(false)
            setImportProgress('')
        }
    }

    const handleDiscoverInstall = async (project: any) => {
        setIsImporting(true)
        setImportProgress(`Installing ${project.title}...`)
        try {
            // Simplified auto-create for now like Discover.tsx
            const instance = await window.electronAPI.launcher.createInstance({
                name: project.title,
                version: '1.20.1', // Placeholder or add version picker
                loader: { type: 'fabric', version: 'latest' },
                memory: defaultMemory
            })
            if (instance) {
                await window.electronAPI.eml.installContent(project, instance)
                addInstance(instance as MinecraftInstance)
                navigate('/instances')
            }
        } catch (error) {
            console.error('Install failed:', error)
        } finally {
            setIsImporting(false)
        }
    }

    // --- LAUNCHER TAB STATE ---
    const [selectedLauncher, setSelectedLauncher] = useState('atlauncher')
    const [launcherPath, setLauncherPath] = useState('C:\\Users\\reaqwq\\AppData\\Roaming\\ATLauncher')
    const [scanResults, setScanResults] = useState<any[]>([])
    const [selectedProfiles, setSelectedProfiles] = useState<string[]>([])

    const handleLauncherScan = async () => {
        if (!launcherPath) return
        setIsScanning(true)
        try {
            const results = await window.electronAPI.eml.scanLaunchers(selectedLauncher, launcherPath)
            setScanResults(results)
            setSelectedProfiles([])
        } catch (error) {
            console.error('Failed to scan:', error)
        } finally {
            setIsScanning(false)
        }
    }

    const toggleSelectAll = () => {
        if (selectedProfiles.length === scanResults.length) setSelectedProfiles([])
        else setSelectedProfiles(scanResults.map(p => p.id))
    }

    const handleLauncherImport = async () => {
        if (selectedProfiles.length === 0) return
        setIsImporting(true)
        try {
            const selectedData = scanResults.filter(p => selectedProfiles.includes(p.id))
            for (let i = 0; i < selectedData.length; i++) {
                const profile = selectedData[i]
                setImportProgress(`Importing ${profile.name} (${i + 1}/${selectedData.length})...`)
                const result = await (window.electronAPI.launcher as any).createInstance({
                    name: profile.name,
                    version: profile.version,
                    loader: profile.loader !== 'vanilla' ? { type: profile.loader, version: 'latest' } : undefined,
                    externalPath: profile.path
                })
                if (result) addInstance(result as MinecraftInstance)
            }
            await fetchInstances()
            navigate('/instances')
        } catch (error) {
            console.error('Import failed:', error)
        } finally {
            setIsImporting(false)
        }
    }

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-xl bg-dark-800 text-dark-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Plus size={32} className="text-primary-500" />
                        {t('instances.create_new')}
                    </h1>
                </div>

                <div className="flex bg-dark-800/50 p-1 rounded-xl border border-dark-700">
                    <button
                        onClick={() => setActiveTab('custom')}
                        className={`px-8 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'custom' ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20' : 'text-dark-400 hover:text-dark-200'}`}
                    >
                        {t('create_instance.tabs.custom').toUpperCase()}
                    </button>
                    <button
                        onClick={() => setActiveTab('modpack')}
                        className={`px-8 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'modpack' ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20' : 'text-dark-400 hover:text-dark-200'}`}
                    >
                        {t('create_instance.tabs.modpack').toUpperCase()}
                    </button>
                    <button
                        onClick={() => setActiveTab('launcher')}
                        className={`px-8 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'launcher' ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20' : 'text-dark-400 hover:text-dark-200'}`}
                    >
                        {t('create_instance.tabs.launcher').toUpperCase()}
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-dark-900/20 rounded-3xl border border-dark-700/50 p-8 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    {isImporting ? (
                        <motion.div
                            key="importing"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-dark-950/80 backdrop-blur-md rounded-3xl"
                        >
                            <div className="w-24 h-24 bg-emerald-600/10 rounded-full flex items-center justify-center mb-6 relative">
                                <Loader2 size={48} className="animate-spin text-emerald-500" />
                                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
                            </div>
                            <h2 className="text-3xl font-black text-white mb-2">{t('common.loading')}</h2>
                            <p className="text-dark-400 text-lg">{importProgress || t('common.loading')}</p>
                        </motion.div>
                    ) : null}

                    {activeTab === 'custom' && (
                        <motion.div
                            key="custom"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="h-full flex flex-col"
                        >
                            <div className="grid grid-cols-2 gap-12 flex-1 min-h-0">
                                <div className="space-y-8">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-dark-500 uppercase tracking-[0.2em]">{t('settings.categories.appearance')}</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder={t('instances.modal.name_placeholder')}
                                            className="w-full px-5 py-4 rounded-2xl bg-dark-800 border-2 border-dark-700 text-white text-lg focus:outline-none focus:border-primary-500 transition-all shadow-inner"
                                        />
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder={t('instances.modal.desc_placeholder')}
                                            className="w-full px-5 py-4 rounded-2xl bg-dark-800 border border-dark-700 text-sm text-dark-200 focus:outline-none focus:border-primary-500 transition-all h-32 resize-none"
                                        />

                                        {/* Icon Selection */}
                                        <div className="flex items-center gap-4">
                                            <div
                                                onClick={handleIconSelect}
                                                className="w-16 h-16 rounded-2xl bg-dark-800 border-2 border-dashed border-dark-600 flex items-center justify-center cursor-pointer hover:border-primary-500 hover:text-primary-500 transition-all overflow-hidden relative group"
                                            >
                                                {iconPreview ? (
                                                    <>
                                                        <img src={iconPreview} alt="icon" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                            <Upload size={20} className="text-white" />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <ImageIcon size={24} className="text-dark-500 group-hover:text-primary-500" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[11px] font-black text-dark-500 uppercase tracking-[0.2em] block mb-1">{t('create_instance.custom.icon_select')}</label>
                                                <button
                                                    onClick={handleIconSelect}
                                                    className="text-sm font-bold text-primary-400 hover:text-white transition-colors"
                                                >
                                                    {iconPath ? t('instance_detail.actions.change_icon') : t('create_instance.custom.icon_select')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[11px] font-black text-dark-500 uppercase tracking-[0.2em]">{t('instances.modal.loader_label')}</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {loaderTypes.map((l) => (
                                                <button
                                                    key={l.id}
                                                    onClick={() => handleLoaderTypeChange(l.id)}
                                                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${loaderType === l.id ? 'border-primary-500 bg-primary-600/10 text-primary-400' : 'border-dark-700 bg-dark-800/30 text-dark-400 hover:border-dark-600'}`}
                                                >
                                                    <span className="text-sm font-bold">{l.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                        {loaderType !== 'none' && (
                                            <div className="flex items-center gap-4 bg-dark-800/50 p-4 rounded-2xl border border-dark-700">
                                                <span className="text-xs font-bold text-dark-400 uppercase">{t('instances.modal.loader_version_label')}:</span>
                                                <select
                                                    value={loaderVersion}
                                                    onChange={(e) => setLoaderVersion(e.target.value)}
                                                    className="flex-1 bg-transparent text-white font-bold focus:outline-none"
                                                >
                                                    {loaderVersions?.map(v => <option key={v.version} value={v.version} className="bg-dark-800">{v.version}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col h-full bg-dark-950/40 rounded-3xl border border-dark-700/50 overflow-hidden">
                                    <div className="p-6 border-b border-dark-700/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2 p-1 bg-dark-800 rounded-lg">
                                            {['release', 'snapshot', 'beta', 'alpha'].map(f => (
                                                <button
                                                    key={f}
                                                    onClick={() => {
                                                        setActiveVersionFilters(prev =>
                                                            prev.includes(f)
                                                                ? (prev.length > 1 ? prev.filter(v => v !== f) : prev)
                                                                : [...prev, f]
                                                        )
                                                    }}
                                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${activeVersionFilters.includes(f) ? 'bg-primary-600 text-white' : 'text-dark-500 hover:text-dark-300'}`}
                                                >
                                                    {f}s
                                                </button>
                                            ))}
                                        </div>
                                        <div className="relative w-48">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-600" />
                                            <input
                                                type="text"
                                                value={versionSearch}
                                                onChange={(e) => setVersionSearch(e.target.value)}
                                                placeholder={t('instances.modal.search_placeholder')}
                                                className="w-full bg-dark-800 border border-dark-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                        {versionsLoading ? (
                                            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary-500" /></div>
                                        ) : (
                                            <div className="space-y-1">
                                                {filteredVersions.map(v => (
                                                    <button
                                                        key={v.version}
                                                        onClick={() => setVersion(v.version)}
                                                        className={`w-full px-4 py-2.5 rounded-xl flex items-center justify-between transition-all group ${version === v.version ? 'bg-primary-600/10 border border-primary-500/50' : 'hover:bg-dark-800/50 border border-transparent'}`}
                                                    >
                                                        <span className={`font-black text-lg ${version === v.version ? 'text-primary-400' : 'text-white'}`}>{v.version}</span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] font-bold text-dark-500 uppercase tracking-widest">{new Date(v.releaseTime).toLocaleDateString()}</span>
                                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${v.type === 'release' ? 'bg-emerald-500/10 text-emerald-400' :
                                                                v.type === 'snapshot' ? 'bg-amber-500/10 text-amber-400' :
                                                                    v.type === 'beta' ? 'bg-blue-500/10 text-blue-400' :
                                                                        'bg-red-500/10 text-red-400'
                                                                }`}>
                                                                {v.type.toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={handleCreate}
                                    disabled={!name || isCreating || (loaderType !== 'none' && loaderVersionsLoading)}
                                    className="px-12 py-4 rounded-2xl bg-primary-600 text-white font-black text-lg shadow-2xl shadow-primary-900/40 hover:bg-primary-500 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isCreating ? <Loader2 className="animate-spin" /> : <><Plus size={24} /> {t('common.create').toUpperCase()} {t('sidebar.instances').toUpperCase()}</>}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'modpack' && (
                        <motion.div
                            key="modpack"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="h-full flex flex-col space-y-6"
                        >
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleFileSelect}
                                    className="px-6 py-3 rounded-2xl bg-dark-800 border-2 border-dashed border-dark-700 text-dark-300 font-bold flex items-center gap-3 hover:border-primary-500 hover:text-white transition-all group"
                                >
                                    <Upload size={20} className="group-hover:scale-110 transition-transform" />
                                    Import from File (.mrpack / .zip)
                                </button>

                                <div className="flex-1 relative">
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-dark-500" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={t('create_instance.modpack.search_placeholder')}
                                        className="w-full pl-14 pr-6 py-4 rounded-2xl bg-dark-800 border border-dark-700 text-white text-lg focus:outline-none focus:border-primary-500 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                                {isSearching ? (
                                    <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-6">
                                        {modpackResults.map(p => (
                                            <div key={p.project_id} className="group bg-dark-800/40 border border-dark-700/50 rounded-2xl p-5 flex gap-5 hover:bg-dark-700/50 transition-all">
                                                <div className="w-24 h-24 rounded-xl overflow-hidden bg-dark-900 flex-shrink-0">
                                                    <img src={p.icon_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                </div>
                                                <div className="flex-1 min-w-0 flex flex-col">
                                                    <h3 className="font-black text-white text-lg truncate mb-1">{p.title}</h3>
                                                    <p className="text-xs text-dark-400 line-clamp-2 mb-4 flex-1">{p.description}</p>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex gap-4 text-[10px] font-black text-dark-500 uppercase">
                                                            <span><Download size={12} className="inline mr-1 text-primary-400" /> {(p.downloads / 1000).toFixed(1)}k</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDiscoverInstall(p)}
                                                            className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-500 transition-all font-bold text-xs"
                                                        >
                                                            {t('instance_detail.actions.play').toUpperCase()}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'launcher' && (
                        <motion.div
                            key="launcher"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="h-full flex flex-col space-y-6"
                        >
                            <div className="bg-dark-800/50 p-6 rounded-3xl border border-dark-700/50 space-y-6">
                                <div className="flex items-center gap-4">
                                    {[
                                        { id: 'atlauncher', name: 'ATLauncher' },
                                        { id: 'multimc', name: 'MultiMC' },
                                        { id: 'prismlauncher', name: 'Prism' },
                                        { id: 'curseforge', name: 'CurseForge' },
                                        { id: 'gdlauncher', name: 'GDLauncher' }
                                    ].map(l => (
                                        <button
                                            key={l.id}
                                            onClick={() => setSelectedLauncher(l.id)}
                                            className={`flex-1 py-3 rounded-xl font-bold transition-all ${selectedLauncher === l.id ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20' : 'text-dark-400 hover:bg-dark-700/50'}`}
                                        >
                                            {l.name}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex gap-3">
                                    <div className="flex-1 relative">
                                        <Folder className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500" size={18} />
                                        <input
                                            type="text"
                                            value={launcherPath}
                                            onChange={(e) => setLauncherPath(e.target.value)}
                                            className="w-full bg-dark-900 border border-dark-700 rounded-2xl pl-12 pr-6 py-4 text-sm text-white focus:outline-none focus:border-primary-500"
                                        />
                                    </div>
                                    <button
                                        onClick={async () => {
                                            const path = await window.electronAPI.selectDirectory('Select Launcher Folder')
                                            if (path) setLauncherPath(path)
                                        }}
                                        className="p-4 bg-dark-800 rounded-2xl text-dark-300 hover:text-white transition-colors"
                                    >
                                        <Folder size={24} />
                                    </button>
                                    <button
                                        onClick={handleLauncherScan}
                                        disabled={isScanning}
                                        className="px-8 bg-primary-600 text-white rounded-2xl font-black flex items-center gap-2 hover:bg-primary-500 disabled:opacity-50"
                                    >
                                        {isScanning ? <Loader2 className="animate-spin" /> : <RefreshCw size={20} />}
                                        {t('create_instance.launcher.scan').toUpperCase()}
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 bg-dark-950/40 rounded-3xl border border-dark-700/50 overflow-hidden flex flex-col">
                                <div className="p-4 bg-dark-800/30 flex items-center justify-between border-b border-dark-700/50">
                                    <button onClick={toggleSelectAll} className="text-xs font-bold text-dark-400 hover:text-primary-400 flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-dark-700/50">
                                        <Check size={14} /> {selectedProfiles.length === scanResults.length ? t('create_instance.launcher.deselect_all').toUpperCase() : t('create_instance.launcher.select_all').toUpperCase()}
                                    </button>
                                    <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">{t('create_instance.launcher.selected_count').replace('{count}', selectedProfiles.length.toString()).replace('{total}', scanResults.length.toString())}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                    {scanResults.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {scanResults.map(p => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => {
                                                        if (selectedProfiles.includes(p.id)) setSelectedProfiles(selectedProfiles.filter(i => i !== p.id))
                                                        else setSelectedProfiles([...selectedProfiles, p.id])
                                                    }}
                                                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${selectedProfiles.includes(p.id) ? 'border-primary-500 bg-primary-600/10' : 'border-dark-800/50 bg-dark-800/20 hover:border-dark-700'}`}
                                                >
                                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${selectedProfiles.includes(p.id) ? 'bg-primary-500 text-dark-950' : 'bg-dark-700 text-dark-500'}`}>
                                                        {selectedProfiles.includes(p.id) && <Check size={16} strokeWidth={4} />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="font-bold text-white truncate">{p.name}</h4>
                                                        <p className="text-[10px] text-dark-500 font-bold uppercase">{p.version} • {p.loader}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-dark-600 gap-4">
                                            <Search size={48} strokeWidth={1.5} />
                                            <p className="font-bold">{t('instances.no_instances')}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="p-6 border-t border-dark-700/50 flex justify-end">
                                    <button
                                        onClick={handleLauncherImport}
                                        disabled={selectedProfiles.length === 0}
                                        className="px-10 py-3 rounded-2xl bg-primary-600 text-white font-black hover:bg-primary-500 disabled:opacity-50 transition-all flex items-center gap-2"
                                    >
                                        {isImporting ? <Loader2 className="animate-spin" /> : <><Download size={18} /> {t('create_instance.launcher.import_selected').toUpperCase()}</>}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
