import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft,
    Download,
    Heart,
    Calendar,
    ExternalLink,
    Loader2,
    X
} from 'lucide-react'
import { useContentDetail, ContentType, ContentSource } from '../hooks/useContentDetail'
import { useUIStore } from '../stores/uiStore'
import { useVersionList } from '../hooks/useVersionList'
import InstallContentModal from '../components/modals/InstallContentModal'
import MarkdownRenderer from '../components/ui/MarkdownRenderer'

interface ContentDetailProps {
    type: ContentType
}

const tabs = [
    { id: 'description', name: 'Description' },
    { id: 'versions', name: 'Versions' },
    { id: 'gallery', name: 'Gallery' }
] as const

type TabId = typeof tabs[number]['id']

function formatNumber(num: number): string {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
}

function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

export default function ContentDetail({ type }: ContentDetailProps) {
    const { source, id } = useParams<{ source: string; id: string }>()
    const { t } = useUIStore()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const instanceId = searchParams.get('instance')

    const [activeTab, setActiveTab] = useState<TabId>('description')
    const [selectedGameVersion, setSelectedGameVersion] = useState<string>('')
    const [selectedReleaseType, setSelectedReleaseType] = useState<'all' | 'release' | 'beta' | 'alpha'>('all')
    const [lightboxImage, setLightboxImage] = useState<string | null>(null)
    const [showInstallModal, setShowInstallModal] = useState(false)
    const [isInstalled, setIsInstalled] = useState(false)

    // Fetch content details
    const { data: content, isLoading: contentLoading } = useContentDetail(
        source as ContentSource,
        id || '',
        type,
        !!(source && id)
    )

    // Fetch versions
    const { data: versions, isLoading: versionsLoading } = useVersionList(
        {
            source: source as ContentSource,
            id: id || '',
            gameVersion: selectedGameVersion || undefined,
            loader: undefined
        },
        !!(source && id) && activeTab === 'versions'
    )

    // Filter versions by release type
    const filteredVersions = useMemo(() => {
        if (!versions) return []
        if (selectedReleaseType === 'all') return versions
        return versions.filter(v => v.releaseType === selectedReleaseType)
    }, [versions, selectedReleaseType])

    // Extract unique game versions from all versions
    const availableGameVersions = useMemo(() => {
        if (!versions) return []
        const versionSet = new Set<string>()
        versions.forEach(v => v.gameVersions.forEach(gv => versionSet.add(gv)))
        return Array.from(versionSet).sort((a, b) => {
            // Sort by version number descending
            const aParts = a.split('.').map(Number)
            const bParts = b.split('.').map(Number)
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const aNum = aParts[i] || 0
                const bNum = bParts[i] || 0
                if (aNum !== bNum) return bNum - aNum
            }
            return 0
        })
    }, [versions])

    // Load instance and check if installed
    useEffect(() => {
        const checkStatus = async () => {
            if (!instanceId) return
            try {
                const instances: any = await window.electronAPI.launcher.getInstances()
                const current = instances.find((i: any) => i.id === instanceId)
                if (current) {
                    // Check if this content is already installed
                    const searchList = [
                        ...(current.mods || []),
                        ...(current.resourcepacks || []),
                        ...(current.shaderpacks || [])
                    ]

                    const installed = searchList.some((item: any) =>
                        item.id === id ||
                        (item.slug && item.slug === id) ||
                        (content && (item.name === content.name || item.id === content.id))
                    )

                    setIsInstalled(!!installed)

                    // Check settings for "Hide installed content"
                    const savedConfig = localStorage.getItem('launcher-settings')
                    if (savedConfig) {
                        const settings = JSON.parse(savedConfig)
                        if (settings.hideInstalledContent && installed) {
                            // If it should be hidden and it is installed, go back
                            navigate(-1)
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to check installation status:', e)
            }
        }
        checkStatus()
    }, [instanceId, id, type, content, navigate])

    const handleBack = () => {
        if (instanceId) {
            navigate(`/instances/${instanceId}`)
        } else {
            navigate(-1)
        }
    }

    if (contentLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <Loader2 size={48} className="mx-auto text-primary-400 animate-spin mb-4" />
                    <p className="text-dark-400">{t('common.loading')}</p>
                </div>
            </div>
        )
    }

    if (!content) {
        return (
            <div className="text-center py-12">
                <p className="text-dark-400">{t('common.not_found')}</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="glass-card p-6">
                <div className="flex items-start gap-6">
                    {/* Icon */}
                    <div className="w-24 h-24 rounded-xl bg-dark-800 flex-shrink-0 overflow-hidden">
                        {content.iconUrl ? (
                            <img src={content.iconUrl} alt={content.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary-600 to-primary-800" />
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <h1 className="text-3xl font-bold text-dark-100 mb-2">{content.name}</h1>
                                <p className="text-dark-400">
                                    {t('content_detail.info.by').replace('{authors}', content.authors.join(', '))}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                {instanceId && (
                                    <button
                                        onClick={handleBack}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-dark-200 transition-colors"
                                    >
                                        <ArrowLeft size={18} />
                                        Back to instance
                                    </button>
                                )}
                                <button
                                    onClick={() => !isInstalled && setShowInstallModal(true)}
                                    disabled={isInstalled}
                                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors shadow-lg ${isInstalled
                                        ? 'bg-dark-700 text-dark-400 cursor-not-allowed border border-dark-600'
                                        : 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/20'
                                        }`}
                                >
                                    <Download size={18} />
                                    {isInstalled ? t('content_detail.actions.installed') : t('content_detail.actions.install')}
                                </button>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-6 mt-4">
                            <div className="flex items-center gap-2 text-dark-300">
                                <Download size={18} className="text-dark-500" />
                                <span className="font-medium">{formatNumber(content.downloads)}</span>
                                <span className="text-dark-500 text-sm">{t('content_detail.info.downloads')}</span>
                            </div>
                            {content.followers !== undefined && (
                                <div className="flex items-center gap-2 text-dark-300">
                                    <Heart size={18} className="text-dark-500" />
                                    <span className="font-medium">{formatNumber(content.followers)}</span>
                                    <span className="text-dark-500 text-sm">{t('content_detail.info.followers')}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-dark-300">
                                <Calendar size={18} className="text-dark-500" />
                                <span className="text-dark-500 text-sm">{t('content_detail.info.updated').replace('{date}', formatDate(content.dateUpdated))}</span>
                            </div>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mt-4">
                            {content.categories.slice(0, 6).map((category) => (
                                <span
                                    key={category}
                                    className="px-3 py-1 rounded-lg bg-dark-700 text-dark-300 text-sm"
                                >
                                    {category}
                                </span>
                            ))}
                            {content.loaders.map((loader) => (
                                <span
                                    key={loader}
                                    className="px-3 py-1 rounded-lg bg-primary-600/20 text-primary-400 text-sm"
                                >
                                    {loader}
                                </span>
                            ))}
                            <span className={`px-3 py-1 rounded-lg text-sm ${content.source === 'curseforge'
                                ? 'bg-orange-600/20 text-orange-400'
                                : 'bg-green-600/20 text-green-400'
                                }`}>
                                {content.source === 'curseforge' ? 'CurseForge' : 'Modrinth'}
                            </span>
                        </div>

                        <p className="text-dark-300 mt-4">{content.description}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-dark-700">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-6 py-3 font-medium transition-colors relative ${activeTab === tab.id
                            ? 'text-primary-400'
                            : 'text-dark-400 hover:text-dark-200'
                            }`}
                    >
                        {t(`content_detail.tabs.${tab.id}`)}
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                {activeTab === 'description' && (
                    <DescriptionTab key="description" content={content} />
                )}
                {activeTab === 'versions' && (
                    <VersionsTab
                        key="versions"
                        versions={filteredVersions}
                        isLoading={versionsLoading}
                        selectedGameVersion={selectedGameVersion}
                        setSelectedGameVersion={setSelectedGameVersion}
                        selectedReleaseType={selectedReleaseType}
                        setSelectedReleaseType={setSelectedReleaseType}
                        availableGameVersions={availableGameVersions}
                    />
                )}
                {activeTab === 'gallery' && (
                    <GalleryTab
                        key="gallery"
                        screenshots={content.screenshots}
                        onImageClick={setLightboxImage}
                    />
                )}
            </AnimatePresence>

            {/* Lightbox */}
            <AnimatePresence>
                {lightboxImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
                        onClick={() => setLightboxImage(null)}
                    >
                        <button
                            className="absolute top-4 right-4 p-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-200"
                            onClick={() => setLightboxImage(null)}
                        >
                            <X size={24} />
                        </button>
                        <img
                            src={lightboxImage}
                            alt="Screenshot"
                            className="max-w-full max-h-full object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Install Modal */}
            <InstallContentModal
                isOpen={showInstallModal}
                onClose={() => setShowInstallModal(false)}
                contentId={id || ''}
                contentSource={source as ContentSource}
                contentName={content?.name || ''}
                contentType={type}
                defaultGameVersion={content?.gameVersions[0]}
                defaultLoader={content?.loaders[0]}
            />
        </div>
    )
}

function DescriptionTab({ content }: { content: any }) {
    const { t } = useUIStore()
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-6"
        >
            <div className="prose prose-invert max-w-none">
                <MarkdownRenderer content={content.body} />
            </div>

            {/* Additional Info */}
            <div className="mt-8 pt-6 border-t border-dark-700 grid grid-cols-2 gap-6">
                {content.license && (
                    <div>
                        <h3 className="text-sm font-medium text-dark-400 mb-2">{t('content_detail.info.license')}</h3>
                        <p className="text-dark-200">{content.license.name}</p>
                    </div>
                )}
                <div>
                    <h3 className="text-sm font-medium text-dark-400 mb-2">{t('content_detail.info.created')}</h3>
                    <p className="text-dark-200">{formatDate(content.dateCreated)}</p>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-dark-400 mb-2">{t('instance_detail.filters.refresh')}</h3>
                    <p className="text-dark-200">{formatDate(content.dateUpdated)}</p>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-dark-400 mb-2">{t('content_detail.info.external_links')}</h3>
                    <a
                        href={content.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary-400 hover:text-primary-300"
                    >
                        {t('content_detail.info.view_on').replace('{source}', content.source === 'curseforge' ? 'CurseForge' : 'Modrinth')}
                        <ExternalLink size={14} />
                    </a>
                </div>
            </div>
        </motion.div>
    )
}

function VersionsTab({
    versions,
    isLoading,
    selectedGameVersion,
    setSelectedGameVersion,
    selectedReleaseType,
    setSelectedReleaseType,
    availableGameVersions
}: any) {
    const { t } = useUIStore()
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
        >
            {/* Filters */}
            <div className="glass-card p-4">
                <div className="flex gap-4 items-center">
                    <div className="flex-1">
                        <label className="text-sm font-medium text-dark-400 mb-2 block">{t('content_detail.versions.game_version')}</label>
                        <select
                            value={selectedGameVersion}
                            onChange={(e) => setSelectedGameVersion(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-200 focus:outline-none focus:border-primary-500"
                        >
                            <option value="">{t('content_detail.versions.all_versions')}</option>
                            {availableGameVersions.map((v: string) => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="text-sm font-medium text-dark-400 mb-2 block">{t('content_detail.versions.channels')}</label>
                        <div className="flex gap-2">
                            {(['all', 'release', 'beta', 'alpha'] as const).map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setSelectedReleaseType(type)}
                                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${selectedReleaseType === type
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                                        }`}
                                >
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Versions Table */}
            <div className="glass-card overflow-hidden">
                {isLoading ? (
                    <div className="p-12 text-center">
                        <Loader2 size={40} className="mx-auto text-primary-400 animate-spin mb-4" />
                        <p className="text-dark-400">{t('common.loading')}</p>
                    </div>
                ) : versions && versions.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-dark-800/50 border-b border-dark-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                                        {t('content_detail.versions.table.name')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                                        {t('content_detail.versions.table.version')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                                        {t('content_detail.versions.table.platforms')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                                        {t('content_detail.versions.table.published')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                                        {t('content_detail.versions.table.downloads')}
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-dark-400 uppercase tracking-wider">
                                        {t('content_detail.versions.table.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-700/30">
                                {versions.map((version: any) => (
                                    <tr key={version.id} className="hover:bg-dark-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-dark-200">{version.name}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${version.releaseType === 'release'
                                                    ? 'bg-green-600/20 text-green-400'
                                                    : version.releaseType === 'beta'
                                                        ? 'bg-yellow-600/20 text-yellow-400'
                                                        : 'bg-red-600/20 text-red-400'
                                                    }`}>
                                                    {version.releaseType}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1 flex-wrap">
                                                {version.gameVersions.slice(0, 3).map((v: string) => (
                                                    <span key={v} className="text-xs px-2 py-0.5 rounded bg-dark-700 text-dark-300">
                                                        {v}
                                                    </span>
                                                ))}
                                                {version.gameVersions.length > 3 && (
                                                    <span className="text-xs text-dark-500">+{version.gameVersions.length - 3}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1 flex-wrap">
                                                {version.loaders.slice(0, 2).map((loader: string) => (
                                                    <span key={loader} className="text-xs px-2 py-0.5 rounded bg-primary-600/20 text-primary-400">
                                                        {loader}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-dark-400 text-sm">
                                            {formatDate(version.datePublished)}
                                        </td>
                                        <td className="px-6 py-4 text-dark-400 text-sm">
                                            {formatNumber(version.downloads)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors">
                                                <Download size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center">
                        <p className="text-dark-400">{t('content_detail.versions.no_versions')}</p>
                    </div>
                )}
            </div>
        </motion.div>
    )
}

function GalleryTab({ screenshots, onImageClick }: any) {
    const { t } = useUIStore()
    if (!screenshots || screenshots.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass-card p-12 text-center"
            >
                <p className="text-dark-400">{t('content_detail.gallery.no_images')}</p>
            </motion.div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-2 gap-4"
        >
            {screenshots.map((screenshot: any, index: number) => (
                <div
                    key={index}
                    className="glass-card overflow-hidden cursor-pointer group"
                    onClick={() => onImageClick(screenshot.url)}
                >
                    <div className="aspect-video bg-dark-800 relative overflow-hidden">
                        <img
                            src={screenshot.thumbnailUrl || screenshot.url}
                            alt={screenshot.title || `Screenshot ${index + 1}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ExternalLink size={32} className="text-white" />
                        </div>
                    </div>
                    {screenshot.title && (
                        <div className="p-3">
                            <p className="text-dark-200 font-medium">{screenshot.title}</p>
                            {screenshot.description && (
                                <p className="text-dark-400 text-sm mt-1">{screenshot.description}</p>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </motion.div>
    )
}
