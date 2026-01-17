import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, MoreVertical, Loader2, Gamepad2, Heart, Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { MinecraftInstance } from '../components/InstanceCard'
import { useUIStore } from '../stores/uiStore'

export default function Home() {
    const navigate = useNavigate()
    const { t } = useUIStore()
    const { activeProfile } = useAuthStore()
    const [lastPlayedInstance, setLastPlayedInstance] = useState<MinecraftInstance | null>(null)
    const [isLaunching, setIsLaunching] = useState(false)
    const [featuredModpacks, setFeaturedModpacks] = useState<any[]>([])
    const [featuredMods, setFeaturedMods] = useState<any[]>([])

    useEffect(() => {
        loadLastPlayed()
        loadFeaturedContent()
    }, [])

    const loadLastPlayed = async () => {
        try {
            const instances = await window.electronAPI.launcher.getInstances() as MinecraftInstance[]
            // Sort by lastPlayed descending
            const sorted = instances
                .filter(i => i.lastPlayed)
                .sort((a, b) => new Date(b.lastPlayed!).getTime() - new Date(a.lastPlayed!).getTime())

            if (sorted.length > 0) {
                setLastPlayedInstance(sorted[0])
            }
        } catch (error) {
            console.error('Failed to load instances:', error)
        }
    }

    const loadFeaturedContent = async () => {
        try {
            // Fetch popular modpacks
            const modpacks = await window.electronAPI.eml.searchContent({
                index: 'downloads',
                facets: [['project_type:modpack']],
                limit: 5
            })
            if (modpacks && modpacks.hits) setFeaturedModpacks(modpacks.hits)

            // Fetch popular mods
            const mods = await window.electronAPI.eml.searchContent({
                index: 'downloads',
                facets: [['project_type:mod']],
                limit: 4
            })
            if (mods && mods.hits) setFeaturedMods(mods.hits)
        } catch (error) {
            console.error('Failed to load featured content:', error)
        }
    }

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
        return num.toString()
    }

    const handleLaunch = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!lastPlayedInstance) return

        if (!activeProfile) {
            console.error('No active profile')
            // Option: Add notification if store is available
            return
        }

        setIsLaunching(true)
        try {
            await window.electronAPI.eml.launch({
                version: lastPlayedInstance.version,
                loader: lastPlayedInstance.loader,
                memory: lastPlayedInstance.memory,
                profile: {
                    id: activeProfile.id,
                    name: activeProfile.name,
                    accessToken: activeProfile.accessToken
                },
                instancePath: lastPlayedInstance.path || lastPlayedInstance.id,
                instanceId: lastPlayedInstance.id,
                instanceName: lastPlayedInstance.name
            })

            // Update last played
            const updated = {
                ...lastPlayedInstance,
                lastPlayed: new Date().toISOString()
            }
            await window.electronAPI.launcher.updateInstance(updated)
            setLastPlayedInstance(updated)
        } catch (error) {
            console.error('Launch failed', error)
        } finally {
            setIsLaunching(false)
        }
    }

    return (
        <div className="space-y-8 pb-10">
            {/* Hero Section */}
            <section className="relative rounded-3xl overflow-hidden min-h-[300px] group border border-dark-700/50 shadow-2xl shadow-black/50">
                {lastPlayedInstance ? (
                    <>
                        {/* Dynamic Background */}
                        <div className="absolute inset-0 z-0">
                            {lastPlayedInstance.icon ? (
                                <>
                                    <img src={lastPlayedInstance.icon} alt="" className="w-full h-full object-cover blur-xl opacity-50 scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-900/40 to-dark-900/10" />
                                    <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-900/40 to-transparent" />
                                </>
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-primary-900/30 via-dark-900 to-dark-950" />
                            )}
                        </div>

                        {/* Content */}
                        <div className="absolute inset-0 z-10 p-8 md:p-10 flex flex-col justify-end items-start w-full">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="w-full"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-300 text-xs font-medium backdrop-blur-md uppercase tracking-wide">
                                        {t('app.ready_to_play')}
                                    </span>
                                    <span className="text-dark-400 text-sm font-medium">
                                        {t('app.last_played').replace('{date}', new Date(lastPlayedInstance.lastPlayed!).toLocaleDateString())}
                                    </span>
                                </div>

                                <h1 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight drop-shadow-lg max-w-3xl">
                                    {lastPlayedInstance.name}
                                </h1>

                                <div className="flex items-center gap-6 mt-6">
                                    <button
                                        onClick={handleLaunch}
                                        disabled={isLaunching}
                                        className="relative group/btn overflow-hidden rounded-xl bg-white text-dark-950 font-black text-lg px-8 py-4 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:scale-105 transition-all duration-300 active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
                                    >
                                        <div className="relative z-10 flex items-center gap-2">
                                            {isLaunching ? <Loader2 size={24} className="animate-spin" /> : <Play size={24} fill="currentColor" />}
                                            <span>{t('app.actions.jump_in')}</span>
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-300 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                    </button>

                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-950/50 backdrop-blur-md border border-white/5 text-dark-200 text-sm">
                                            <Gamepad2 size={16} />
                                            <span className="capitalize">{(lastPlayedInstance.loader?.type ? t(`discover.tabs.${lastPlayedInstance.loader.type.toLowerCase()}`) : t('app.loaders.vanilla'))} {lastPlayedInstance.version}</span>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/instances/${lastPlayedInstance.id}`)}
                                            className="p-3 rounded-xl bg-dark-950/30 hover:bg-dark-800 backdrop-blur-md border border-white/5 text-white hover:text-primary-300 transition-colors"
                                        >
                                            <MoreVertical size={20} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Instance Icon (Floating) */}
                        {lastPlayedInstance.icon && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, x: 20 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="absolute top-1/2 -translate-y-1/2 right-10 hidden lg:block z-10"
                            >
                                <img src={lastPlayedInstance.icon} alt="" className="w-64 h-64 object-cover rounded-3xl shadow-2xl shadow-black/80 rotate-3 border-4 border-white/10" />
                            </motion.div>
                        )}
                    </>
                ) : (
                    /* Welcome/Empty State Hero */
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-dark-900 to-dark-950">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <h1 className="text-4xl font-bold text-white mb-4">{t('app.welcome_back').replace('{name}', activeProfile?.name ? `, ${activeProfile.name}` : '')}</h1>
                            <p className="text-dark-400 max-w-lg mx-auto mb-8 text-lg">
                                {t('app.welcome_description')}
                            </p>
                            <button
                                onClick={() => navigate('/instances/create')}
                                className="px-8 py-3 rounded-full bg-primary-600 hover:bg-primary-500 text-white font-bold transition-all shadow-lg hover:shadow-primary-500/25"
                            >
                                {t('instances.create_new')}
                            </button>
                        </motion.div>
                    </div>
                )}
            </section>

            {/* Discover Modpacks */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 onClick={() => navigate('/discover?tab=modpack')} className="text-xl font-bold text-white cursor-pointer hover:text-primary-400 transition-colors">{t('app.sections.discover_modpack')}</h2>
                    <button onClick={() => navigate('/discover?tab=modpack')} className="text-sm font-semibold text-dark-400 hover:text-white transition-colors">{t('common.view_all')}</button>
                </div>

                <div className="grid grid-cols-5 gap-4">
                    {featuredModpacks.map((pack) => (
                        <div key={pack.project_id} className="group cursor-pointer" onClick={() => navigate(`/modpack/modrinth/${pack.project_id}`)}>
                            <div className="aspect-video rounded-xl bg-dark-800 mb-3 overflow-hidden relative flex items-center justify-center border border-dark-700/50 group-hover:border-dark-600 transition-colors">
                                <div className="absolute inset-0 bg-dark-700/50 group-hover:bg-dark-700/30 transition-colors" />
                                {pack.icon_url ? (
                                    <img src={pack.icon_url} alt={pack.title} className="w-16 h-16 rounded-lg shadow-lg relative z-10" />
                                ) : (
                                    <span className="text-2xl font-bold text-dark-500 relative z-10">{pack.title.charAt(0)}</span>
                                )}
                            </div>
                            <h3 className="font-bold text-white text-sm truncate">{pack.title}</h3>
                            <p className="text-xs text-dark-400 truncate">{pack.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-dark-500">
                                <span className="flex items-center gap-1"><Download size={10} /> {formatNumber(pack.downloads)}</span>
                                <span className="flex items-center gap-1"><Heart size={10} /> {formatNumber(pack.follows)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Discover Mods */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 onClick={() => navigate('/discover?tab=mod')} className="text-xl font-bold text-white cursor-pointer hover:text-primary-400 transition-colors">{t('app.sections.discover_mod')}</h2>
                    <button onClick={() => navigate('/discover?tab=mod')} className="text-sm font-semibold text-dark-400 hover:text-white transition-colors">{t('common.view_all')}</button>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    {featuredMods.map((mod) => (
                        <div key={mod.project_id} className="group cursor-pointer bg-dark-800 hover:bg-dark-750 transition-colors rounded-xl p-4 border border-dark-700/50 hover:border-dark-600" onClick={() => navigate(`/mod/modrinth/${mod.project_id}`)}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-primary-600/20 flex items-center justify-center text-primary-400 font-bold overflow-hidden">
                                    {mod.icon_url ? (
                                        <img src={mod.icon_url} alt={mod.title} className="w-full h-full object-cover" />
                                    ) : (
                                        mod.title.charAt(0)
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-white text-sm truncate">{mod.title}</h3>
                                    <p className="text-xs text-dark-400 truncate">{mod.categories?.[0] || 'Mod'}</p>
                                </div>
                            </div>
                            <p className="text-xs text-dark-300 line-clamp-2 mb-3 h-8">
                                {mod.description}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-dark-500">
                                <span className="flex items-center gap-1"><Download size={12} /> {formatNumber(mod.downloads)}</span>
                                <span className="flex items-center gap-1"><Heart size={12} /> {formatNumber(mod.follows)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
