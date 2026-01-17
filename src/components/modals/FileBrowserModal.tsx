import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { X, Folder, File, ChevronRight, HardDrive, Home, Search, Loader2 } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'

interface FileEntry {
    name: string
    path: string
    isDirectory: boolean
    size: number
    mtime: Date
}

interface FileBrowserModalProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (path: string) => void
    title?: string
    mode?: 'file' | 'folder'
    allowedExtensions?: string[]
    initialPath?: string
}

export default function FileBrowserModal({
    isOpen,
    onClose,
    onSelect,
    title,
    mode = 'file',
    allowedExtensions = [],
    initialPath
}: FileBrowserModalProps) {
    const { t } = useUIStore()
    const [currentPath, setCurrentPath] = useState('')
    const [entries, setEntries] = useState<FileEntry[]>([])
    const [drives, setDrives] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null)

    // Load initial data
    useEffect(() => {
        const init = async () => {
            const home = await window.electronAPI.getHome()
            const drvs = await window.electronAPI.getDrives()
            setDrives(drvs)
            const startPath = initialPath || home
            setCurrentPath(startPath)
            loadPath(startPath)
        }
        if (isOpen) init()
    }, [isOpen, initialPath])

    const loadPath = async (targetPath: string) => {
        setIsLoading(true)
        setSelectedEntry(null)
        setSearchQuery('') // Clear search when moving folders
        try {
            const result = await window.electronAPI.listContents(targetPath)
            if (result.error) {
                console.error('Failed to list path:', result.error)
            } else {
                setCurrentPath(result.currentPath)
                setEntries(result.entries)
            }
        } catch (error) {
            console.error('Error loading path:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const filteredEntries = useMemo(() => {
        return entries
            .filter(entry => {
                // Filter by search
                if (searchQuery && !entry.name.toLowerCase().includes(searchQuery.toLowerCase())) return false

                // Filter by mode and extension
                if (mode === 'folder' && !entry.isDirectory) return false
                if (mode === 'file' && !entry.isDirectory && allowedExtensions.length > 0) {
                    const ext = entry.name.split('.').pop()?.toLowerCase() || ''
                    if (!allowedExtensions.includes(ext)) return false
                }
                return true
            })
            .sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
                return a.name.localeCompare(b.name)
            })
    }, [entries, searchQuery, mode, allowedExtensions])

    const handleEntryClick = (entry: FileEntry) => {
        if (entry.isDirectory) {
            loadPath(entry.path)
        } else {
            setSelectedEntry(entry)
        }
    }

    const handleConfirm = () => {
        if (mode === 'folder') {
            onSelect(currentPath)
        } else if (selectedEntry) {
            onSelect(selectedEntry.path)
        }
        onClose()
    }

    const breadcrumbs = useMemo(() => {
        const parts = currentPath.split(/[\\/]/).filter(Boolean)
        // Adjust for Windows drives
        if (currentPath.includes(':') && currentPath.indexOf(':') === 1) {
            const drive = currentPath.substring(0, 3) // e.g. "C:\"
            const rest = currentPath.substring(3).split(/[\\/]/).filter(Boolean)
            return [drive, ...rest]
        }
        return parts.length === 0 ? ['/'] : parts
    }, [currentPath])

    const navigateToBreadcrumb = (index: number) => {
        let target = ''
        if (currentPath.includes(':')) {
            target = breadcrumbs.slice(0, index + 1).join('\\')
            if (index === 0) target += '\\' // Drive root
        } else {
            target = '/' + breadcrumbs.slice(0, index + 1).join('/')
        }
        loadPath(target)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative z-10 w-full max-w-4xl glass-card h-[80vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="p-4 border-b border-dark-700/50 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-dark-100 flex items-center gap-2">
                        <HardDrive size={20} className="text-primary-500" />
                        {title || t('settings.browser.title')}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-dark-800 rounded-lg transition-colors text-dark-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-56 border-r border-dark-700/50 bg-dark-900/30 p-4 flex flex-col gap-6 overflow-y-auto">
                        <div>
                            <p className="text-[10px] font-bold text-dark-500 uppercase tracking-widest mb-3">
                                {t('settings.browser.quick_access')}
                            </p>
                            <div className="space-y-1">
                                <button
                                    onClick={async () => loadPath(await window.electronAPI.getHome())}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-dark-300 hover:bg-dark-800 hover:text-dark-100 transition-all"
                                >
                                    <Home size={16} className="text-blue-400" />
                                    {t('settings.browser.home')}
                                </button>
                            </div>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-dark-500 uppercase tracking-widest mb-3">
                                {t('settings.browser.drives')}
                            </p>
                            <div className="space-y-1">
                                {drives.map(drive => (
                                    <button
                                        key={drive}
                                        onClick={() => loadPath(drive)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${currentPath.startsWith(drive) ? 'bg-primary-600/20 text-primary-400' : 'text-dark-300 hover:bg-dark-800 hover:text-dark-100'}`}
                                    >
                                        <HardDrive size={16} />
                                        {drive}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Toolbar */}
                        <div className="p-4 flex flex-col gap-4 border-b border-dark-700/30">
                            {/* Breadcrumbs */}
                            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                                {breadcrumbs.map((part, i) => (
                                    <div key={i} className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={() => navigateToBreadcrumb(i)}
                                            className="px-2 py-1 rounded text-xs text-dark-400 hover:bg-dark-800 hover:text-dark-200"
                                        >
                                            {part}
                                        </button>
                                        {i < breadcrumbs.length - 1 && <ChevronRight size={12} className="text-dark-600" />}
                                    </div>
                                ))}
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="名前で検索..."
                                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-dark-800/50 border border-dark-700/50 text-dark-100 text-sm focus:outline-none focus:border-primary-500"
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {isLoading ? (
                                <div className="h-full flex flex-col items-center justify-center text-dark-500 gap-2">
                                    <Loader2 size={32} className="animate-spin text-primary-500" />
                                    <p className="text-sm">{t('common.loading')}</p>
                                </div>
                            ) : filteredEntries.length > 0 ? (
                                <div className="grid grid-cols-1 gap-1">
                                    {filteredEntries.map(entry => (
                                        <button
                                            key={entry.path}
                                            onClick={() => handleEntryClick(entry)}
                                            className={`flex items-center gap-4 px-4 py-2 rounded-lg transition-all group ${selectedEntry?.path === entry.path ? 'bg-primary-600 text-white' : 'hover:bg-dark-800/50 text-dark-200'}`}
                                        >
                                            {entry.isDirectory ? (
                                                <Folder size={18} className="text-amber-400 flex-shrink-0" />
                                            ) : (
                                                <File size={18} className="text-blue-400 flex-shrink-0" />
                                            )}
                                            <span className="text-sm truncate flex-1 text-left">{entry.name}</span>
                                            <span className="text-[10px] text-dark-500 group-hover:text-dark-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {entry.isDirectory ? '' : `${(entry.size / 1024 / 1024).toFixed(2)} MB`}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-dark-500 gap-2 opacity-50">
                                    <Folder size={48} />
                                    <p className="text-sm">{t('settings.browser.empty')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-dark-900/50 border-t border-dark-700/50 flex items-center justify-between">
                    <div className="text-xs text-dark-500 truncate max-w-[50%]">
                        {selectedEntry?.path || currentPath}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 rounded-xl text-sm font-medium text-dark-400 hover:bg-dark-800 transition-all"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={mode === 'file' && !selectedEntry}
                            className="px-10 py-2 rounded-xl bg-primary-600 text-white text-sm font-bold shadow-lg shadow-primary-600/20 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {t('common.select')}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
