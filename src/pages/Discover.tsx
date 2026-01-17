import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, Download, Heart, Package, Loader2, ChevronRight, X, Grid, List as ListIcon } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUIStore } from '../stores/uiStore'
import InstallToInstanceModal from '../components/modals/InstallToInstanceModal'
import { useInstanceStore } from '../stores/instanceStore'
import { useSettingsStore } from '../stores/settingsStore'

const getTabs = (t: any) => [
    { id: 'modpack', name: t('discover.tabs.modpack') },
    { id: 'mod', name: t('discover.tabs.mod') },
    { id: 'resourcepack', name: t('discover.tabs.resourcepack') },
    { id: 'datapack', name: t('discover.tabs.datapack') },
    { id: 'shader', name: t('discover.tabs.shader') }
]

const getSortOptions = (t: any) => [
    { id: 'relevance', name: t('discover.sort.relevance') },
    { id: 'downloads', name: t('discover.sort.downloads') },
    { id: 'follows', name: t('discover.sort.follows') },
    { id: 'newest', name: t('discover.sort.newest') },
    { id: 'updated', name: t('discover.sort.updated') }
]

export default function Discover() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { t } = useUIStore()
    const { instances } = useInstanceStore()
    const { memory: defaultMemory } = useSettingsStore()

    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'modpack')
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [results, setResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [sortBy, setSortBy] = useState('relevance')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

    // Installation state
    const [showInstallModal, setShowInstallModal] = useState(false)
    const [selectedProject, setSelectedProject] = useState<any>(null)
    const [isInstalling, setIsInstalling] = useState<string | null>(null)

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery)
        }, 500)
        return () => clearTimeout(timer)
    }, [searchQuery])

    // Load content
    useEffect(() => {
        fetchContent()
    }, [debouncedQuery, activeTab, sortBy])

    const fetchContent = async () => {
        setIsSearching(true)
        try {
            const facets: any[][] = [[`project_type:${activeTab}`]]

            const searchOptions: any = {
                query: debouncedQuery,
                index: sortBy === 'relevance' && !debouncedQuery ? 'downloads' : sortBy,
                facets,
                limit: 20
            }

            const data = await window.electronAPI.eml.searchContent(searchOptions)
            setResults(data.hits || [])
        } catch (error) {
            console.error('Failed to fetch content:', error)
        } finally {
            setIsSearching(false)
        }
    }

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
        return num.toString()
    }

    const handleInstallClick = (e: React.MouseEvent, project: any) => {
        e.stopPropagation()
        setSelectedProject(project)
        setShowInstallModal(true)
    }

    const handleInstallConfirm = async (instanceId: string | null) => {
        setShowInstallModal(false)
        const project = selectedProject
        if (!project || isInstalling) return

        setIsInstalling(project.project_id)
        try {
            let instance
            if (instanceId) {
                instance = instances.find(i => i.id === instanceId)
            } else {
                // Create new
                instance = await window.electronAPI.launcher.createInstance({
                    name: project.title,
                    version: '1.20.1', // Should probably let user pick version/loader in a next step
                    loader: { type: 'fabric', version: '0.14.21' },
                    memory: defaultMemory
                })
            }

            if (instance) {
                await window.electronAPI.eml.installContent(project, instance)
            }
        } catch (error) {
            console.error('Install failed:', error)
        } finally {
            setIsInstalling(null)
            setSelectedProject(null)
        }
    }

    const tabs = getTabs(t)
    const sortOptions = getSortOptions(t)

    return (
        <div className="flex flex-col h-full overflow-hidden space-y-6">
            {/* Header Area */}
            <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-black text-white tracking-tight">Discover</h1>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'bg-dark-800 text-dark-400 hover:text-white'}`}
                        >
                            <Grid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-dark-800 text-dark-400 hover:text-white'}`}
                        >
                            <ListIcon size={18} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 p-1 bg-dark-800/50 rounded-xl border border-dark-700 w-fit">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20'
                                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700'
                                }`}
                        >
                            {tab.name}
                        </button>
                    ))}
                </div>

                {/* Search & Sort */}
                <div className="flex gap-4">
                    <div className="flex-1 relative group">
                        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500 group-focus-within:text-primary-400 transition-colors" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('discover.search_placeholder')}
                            className="w-full pl-12 pr-4 py-3 rounded-xl bg-dark-800 border border-dark-700 text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-all shadow-xl shadow-black/20"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white">
                                <X size={18} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3 bg-dark-800 border border-dark-700 rounded-xl px-4 py-2 text-sm">
                        <span className="text-dark-500 flex items-center gap-2"><Filter size={16} /> {t('instance_detail.filters.title')}:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                        >
                            {sortOptions.map(opt => (
                                <option key={opt.id} value={opt.id} className="bg-dark-800">{opt.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0">
                {isSearching ? (
                    <div className="flex flex-col items-center justify-center py-20 text-dark-500 space-y-4">
                        <Loader2 size={48} className="animate-spin text-primary-500" />
                        <p className="font-medium">Searching Modrinth...</p>
                    </div>
                ) : results.length > 0 ? (
                    <div className={viewMode === 'grid' ? 'grid grid-cols-4 gap-4 pb-10' : 'flex flex-col gap-3 pb-10'}>
                        {results.map((result) => (
                            <motion.div
                                key={result.project_id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`group bg-dark-800/40 border border-dark-700/50 rounded-2xl overflow-hidden hover:bg-dark-700/50 hover:border-dark-600 transition-all ${viewMode === 'list' ? 'flex p-4 gap-6' : 'flex flex-col'
                                    }`}
                                onClick={() => navigate(`/${activeTab}/${result.project_id}`)}
                            >
                                {/* Thumbnail */}
                                <div className={`${viewMode === 'list' ? 'w-24 h-24' : 'aspect-video'} relative flex-shrink-0 bg-dark-900 overflow-hidden rounded-xl`}>
                                    {result.icon_url ? (
                                        <img src={result.icon_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-dark-700">
                                            <Package size={40} />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-dark-950/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h3 className="font-black text-white text-lg truncate tracking-tight">{result.title}</h3>
                                            <p className="text-xs text-primary-400 font-bold mb-2">by {result.author}</p>
                                        </div>
                                        <div className="flex items-center gap-2 text-dark-500 text-xs font-bold uppercase transition-transform group-hover:translate-x-1">
                                            <span>Details</span>
                                            <ChevronRight size={14} />
                                        </div>
                                    </div>

                                    <p className="text-sm text-dark-300 line-clamp-2 mb-4 leading-relaxed h-10">
                                        {result.description}
                                    </p>

                                    <div className="flex items-center justify-between mt-auto">
                                        <div className="flex items-center gap-4 text-xs font-bold text-dark-500">
                                            <span className="flex items-center gap-1.5 bg-dark-900/50 px-2 py-1 rounded-md"><Download size={12} className="text-primary-400" /> {formatNumber(result.downloads)}</span>
                                            <span className="flex items-center gap-1.5 bg-dark-900/50 px-2 py-1 rounded-md"><Heart size={12} className="text-pink-500" /> {formatNumber(result.follows)}</span>
                                        </div>
                                        <button
                                            onClick={(e) => handleInstallClick(e, result)}
                                            disabled={isInstalling === result.project_id}
                                            className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black shadow-lg shadow-primary-900/20 hover:bg-primary-500 hover:shadow-primary-500/30 active:scale-95 transition-all flex items-center gap-2 group/btn"
                                        >
                                            {isInstalling === result.project_id ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <>
                                                    <Download size={16} className="group-hover/btn:translate-y-0.5 transition-transform" />
                                                    <span>INSTALL</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-dark-500 space-y-4">
                        <Package size={64} className="opacity-20" />
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-white mb-1">No results found</h3>
                            <p>Try adjusting your search or filters</p>
                        </div>
                    </div>
                )}
            </div>

            <InstallToInstanceModal
                isOpen={showInstallModal}
                onClose={() => setShowInstallModal(false)}
                onInstall={handleInstallConfirm}
                project={selectedProject}
            />
        </div>
    )
}
