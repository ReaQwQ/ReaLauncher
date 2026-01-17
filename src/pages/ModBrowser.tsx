import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, ChevronDown, Download, ExternalLink, Loader2, X } from 'lucide-react'
import { useModSearch, UnifiedMod, ModSearchParams } from '../hooks/useModSearch'

const categories = [
    { id: 'all', name: 'すべて' },
    { id: 'adventure', name: 'アドベンチャー' },
    { id: 'decoration', name: '装飾' },
    { id: 'magic', name: '魔法' },
    { id: 'optimization', name: '最適化' },
    { id: 'storage', name: 'ストレージ' },
    { id: 'technology', name: 'テクノロジー' },
    { id: 'utility', name: 'ユーティリティ' },
    { id: 'worldgen', name: 'ワールド生成' },
    { id: 'mobs', name: 'Mob' },
]

const modLoaders = ['Forge', 'Fabric', 'NeoForge', 'Quilt']

const minecraftVersions = [
    '1.21.4', '1.21.3', '1.21.1', '1.21',
    '1.20.6', '1.20.4', '1.20.2', '1.20.1',
    '1.19.4', '1.19.2', '1.18.2', '1.16.5'
]

const sortOptions = [
    { id: 'popularity', name: '人気順' },
    { id: 'updated', name: '更新日順' },
    { id: 'downloads', name: 'ダウンロード数順' },
    { id: 'name', name: '名前順' },
]

function formatNumber(num: number): string {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
}


function ModCard({ mod }: { mod: UnifiedMod }) {
    const navigate = useNavigate()

    const handleClick = () => {
        const source = mod.source === 'curseforge' ? 'curseforge' : 'modrinth'
        const cleanId = mod.id.replace(/^(cf|mr)-/, '')
        navigate(`/mod/${source}/${cleanId}`)
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleClick}
            className="glass-card p-4 hover:bg-dark-800/70 transition-colors group cursor-pointer"
        >
            <div className="flex gap-4">
                {/* Icon */}
                <div className="w-16 h-16 rounded-xl bg-dark-800 flex-shrink-0 overflow-hidden">
                    {mod.iconUrl ? (
                        <img src={mod.iconUrl} alt={mod.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-600 to-primary-800" />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h3 className="font-medium text-dark-100 truncate">{mod.name}</h3>
                            <p className="text-xs text-dark-400 mt-0.5">
                                by {mod.authors.slice(0, 2).join(', ')}
                            </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${mod.source === 'curseforge'
                            ? 'bg-orange-600/20 text-orange-400'
                            : 'bg-green-600/20 text-green-400'
                            }`}>
                            {mod.source === 'curseforge' ? 'CF' : 'MR'}
                        </span>
                    </div>

                    <p className="text-sm text-dark-300 mt-2 line-clamp-2">{mod.description}</p>

                    <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5 text-xs text-dark-400">
                            <Download size={14} />
                            <span>{formatNumber(mod.downloads)}</span>
                        </div>
                        {mod.loaders.length > 0 && (
                            <div className="flex gap-1">
                                {mod.loaders.slice(0, 2).map((loader) => (
                                    <span key={loader} className="text-xs px-1.5 py-0.5 rounded bg-dark-700 text-dark-300">
                                        {loader}
                                    </span>
                                ))}
                            </div>
                        )}
                        {mod.gameVersions.length > 0 && (
                            <span className="text-xs text-dark-400">
                                {mod.gameVersions[0]}
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            // TODO: Implement install
                        }}
                        className="p-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors"
                    >
                        <Download size={18} />
                    </button>
                    <a
                        href={mod.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-dark-300 transition-colors"
                    >
                        <ExternalLink size={18} />
                    </a>
                </div>
            </div>
        </motion.div>
    )
}

export default function ModBrowser() {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [selectedLoader, setSelectedLoader] = useState<string | null>(null)
    const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
    const [selectedSource, setSelectedSource] = useState<'all' | 'curseforge' | 'modrinth'>('all')
    const [sortBy, setSortBy] = useState<'popularity' | 'updated' | 'downloads' | 'name'>('popularity')
    const [showFilters, setShowFilters] = useState(false)
    const [page, setPage] = useState(1)

    const searchParams: ModSearchParams = {
        query: searchQuery,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        loader: selectedLoader || undefined,
        gameVersion: selectedVersion || undefined,
        source: selectedSource,
        sortBy,
        page,
        pageSize: 20
    }

    const { data, isLoading, isFetching } = useModSearch(
        searchParams,
        searchQuery.length > 0 || selectedCategory !== 'all'
    )

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault()
        setPage(1)
    }, [])

    const clearFilters = useCallback(() => {
        setSelectedLoader(null)
        setSelectedVersion(null)
        setSelectedSource('all')
        setSortBy('popularity')
    }, [])

    const hasActiveFilters = selectedLoader || selectedVersion || selectedSource !== 'all'

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-dark-100">Mod検索</h1>
                <div className="flex items-center gap-2 text-sm">
                    {['all', 'curseforge', 'modrinth'].map((source) => (
                        <button
                            key={source}
                            onClick={() => { setSelectedSource(source as typeof selectedSource); setPage(1) }}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${selectedSource === source
                                ? source === 'curseforge'
                                    ? 'bg-orange-600/20 text-orange-400'
                                    : source === 'modrinth'
                                        ? 'bg-green-600/20 text-green-400'
                                        : 'bg-primary-600/20 text-primary-400'
                                : 'bg-dark-800 text-dark-400 hover:text-dark-200'
                                }`}
                        >
                            {source === 'all' ? 'すべて' : source === 'curseforge' ? 'CurseForge' : 'Modrinth'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex gap-4">
                <div className="flex-1 relative">
                    <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" />
                    <input
                        type="text"
                        placeholder="Modを検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-dark-800/50 border border-dark-700 text-dark-100 placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                    />
                    {isFetching && (
                        <Loader2 size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-400 animate-spin" />
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${showFilters || hasActiveFilters
                        ? 'bg-primary-600/20 border-primary-500 text-primary-400'
                        : 'bg-dark-800/50 border-dark-700 text-dark-300 hover:border-dark-600'
                        }`}
                >
                    <Filter size={20} />
                    フィルター
                    {hasActiveFilters && (
                        <span className="w-2 h-2 rounded-full bg-primary-500" />
                    )}
                    <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
            </form>

            {/* Filters */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="glass-card p-6 space-y-4 overflow-hidden"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-dark-200">フィルター設定</span>
                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="flex items-center gap-1 text-xs text-dark-400 hover:text-dark-200"
                                >
                                    <X size={14} />
                                    クリア
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            {/* Mod Loader */}
                            <div>
                                <label className="text-sm font-medium text-dark-300 mb-2 block">Modローダー</label>
                                <div className="flex flex-wrap gap-2">
                                    {modLoaders.map((loader) => (
                                        <button
                                            key={loader}
                                            onClick={() => { setSelectedLoader(selectedLoader === loader ? null : loader); setPage(1) }}
                                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${selectedLoader === loader
                                                ? 'bg-primary-600 text-white'
                                                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                                                }`}
                                        >
                                            {loader}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Minecraft Version */}
                            <div>
                                <label className="text-sm font-medium text-dark-300 mb-2 block">Minecraftバージョン</label>
                                <select
                                    value={selectedVersion || ''}
                                    onChange={(e) => { setSelectedVersion(e.target.value || null); setPage(1) }}
                                    className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-200 focus:outline-none focus:border-primary-500"
                                >
                                    <option value="">すべて</option>
                                    {minecraftVersions.map((version) => (
                                        <option key={version} value={version}>{version}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Sort */}
                            <div>
                                <label className="text-sm font-medium text-dark-300 mb-2 block">並び順</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1) }}
                                    className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-200 focus:outline-none focus:border-primary-500"
                                >
                                    {sortOptions.map((option) => (
                                        <option key={option.id} value={option.id}>{option.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {categories.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => { setSelectedCategory(category.id); setPage(1) }}
                        className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${selectedCategory === category.id
                            ? 'bg-primary-600 text-white'
                            : 'bg-dark-800/50 text-dark-300 hover:bg-dark-700/50'
                            }`}
                    >
                        {category.name}
                    </button>
                ))}
            </div>

            {/* Results */}
            {isLoading ? (
                <div className="glass-card p-12 text-center">
                    <Loader2 size={40} className="mx-auto text-primary-400 animate-spin mb-4" />
                    <p className="text-dark-400">検索中...</p>
                </div>
            ) : data && data.mods.length > 0 ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-dark-400">
                        <span>{formatNumber(data.total)} 件の結果</span>
                        <span>ページ {page}</span>
                    </div>

                    <div className="space-y-3">
                        {data.mods.map((mod) => (
                            <ModCard key={mod.id} mod={mod} />
                        ))}
                    </div>

                    {/* Pagination */}
                    {data.hasMore && (
                        <div className="flex justify-center pt-4">
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={isFetching}
                                className="px-6 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-200 transition-colors disabled:opacity-50"
                            >
                                {isFetching ? (
                                    <Loader2 size={20} className="animate-spin" />
                                ) : (
                                    'さらに読み込む'
                                )}
                            </button>
                        </div>
                    )}
                </div>
            ) : searchQuery || selectedCategory !== 'all' ? (
                <div className="glass-card p-8 text-center">
                    <p className="text-dark-400">該当するModが見つかりませんでした</p>
                </div>
            ) : (
                <div className="glass-card p-8 text-center">
                    <div className="max-w-md mx-auto">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-600/20 flex items-center justify-center">
                            <Search size={32} className="text-primary-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-dark-100 mb-2">Modを検索してみましょう</h2>
                        <p className="text-dark-400">
                            上の検索ボックスにキーワードを入力するか、カテゴリを選択してModを探しましょう。
                            CurseForgeとModrinthの両方から検索できます。
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
