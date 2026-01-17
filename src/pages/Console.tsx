import { useEffect, useRef, useState } from 'react'
import { Terminal, Trash2, Download, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { useLogStore } from '../stores/logStore'
import { useUIStore } from '../stores/uiStore'

export default function Console() {
    const { t } = useUIStore()
    const { logs, clearLogs } = useLogStore()
    const [autoScroll, setAutoScroll] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedLevel, setSelectedLevel] = useState<string>('all')
    const consoleRef = useRef<HTMLDivElement>(null)

    const logLevels = ['all', 'info', 'warn', 'error', 'debug']

    // Auto-scroll to bottom when new logs arrive
    useEffect(() => {
        if (autoScroll && consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight
        }
    }, [logs, autoScroll])

    // Handle user scroll to disable auto-scroll
    const handleScroll = () => {
        if (consoleRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = consoleRef.current
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
            setAutoScroll(isAtBottom)
        }
    }

    // Export logs to file
    const handleExportLogs = () => {
        const content = logs.map(log =>
            `[${new Date(log.timestamp).toLocaleTimeString()}] [${log.level.toUpperCase()}] ${log.message}`
        ).join('\n')

        const blob = new Blob([content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `realauncher-logs-${Date.now()}.txt`
        a.click()
        URL.revokeObjectURL(url)
    }

    // Filter logs
    const filteredLogs = logs.filter(log => {
        const matchesLevel = selectedLevel === 'all' || log.level === selectedLevel
        const matchesSearch = !searchQuery || log.message.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesLevel && matchesSearch
    })

    const getLogColor = (level: string) => {
        switch (level) {
            case 'error': return 'text-red-400'
            case 'warn': return 'text-yellow-400'
            case 'info': return 'text-blue-400'
            case 'debug': return 'text-gray-400'
            default: return 'text-dark-200'
        }
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-dark-100 flex items-center gap-3">
                        <Terminal size={32} className="text-primary-400" />
                        {t('sidebar.console')}
                    </h1>
                    <p className="text-dark-400 text-sm mt-1">
                        {filteredLogs.length} {t('app.console.logs_count')} {searchQuery && t('app.console.filtered_from').replace('{count}', logs.length.toString())}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Export button */}
                    <button
                        onClick={handleExportLogs}
                        className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-dark-200 transition-all flex items-center gap-2 text-sm font-medium"
                        title={t('app.console.export')}
                    >
                        <Download size={16} />
                        {t('app.console.export')}
                    </button>

                    {/* Clear button */}
                    <button
                        onClick={() => clearLogs()}
                        className="px-4 py-2 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 transition-all flex items-center gap-2 text-sm font-medium"
                        title={t('app.console.clear')}
                    >
                        <Trash2 size={16} />
                        {t('app.console.clear')}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-4">
                {/* Search */}
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('app.console.search_placeholder')}
                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-100 placeholder-dark-500 focus:outline-none focus:border-primary-500 text-sm"
                    />
                </div>

                {/* Log level filter */}
                <div className="flex gap-2">
                    {logLevels.map((level) => (
                        <button
                            key={level}
                            onClick={() => setSelectedLevel(level)}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${selectedLevel === level
                                ? 'bg-primary-600 text-white'
                                : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                                }`}
                        >
                            {level.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Auto-scroll toggle */}
                <button
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${autoScroll
                        ? 'bg-green-600/20 text-green-400'
                        : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                        }`}
                >
                    {autoScroll ? t('app.console.auto_scroll_on') : t('app.console.auto_scroll_off')}
                </button>
            </div>

            {/* Console output */}
            <div className="flex-1 flex flex-col glass-card overflow-hidden">
                <div
                    ref={consoleRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed"
                >
                    {filteredLogs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-dark-500">
                            {searchQuery ? t('common.no_results') : t('app.console.no_logs')}
                        </div>
                    ) : (
                        filteredLogs.map((log, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.1 }}
                                className="py-1 hover:bg-dark-800/30 px-2 rounded"
                            >
                                <span className="text-dark-500">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                {' '}
                                <span className={`font-bold ${getLogColor(log.level)}`}>
                                    [{log.level.toUpperCase()}]
                                </span>
                                {' '}
                                <span className="text-dark-200">{log.message}</span>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
