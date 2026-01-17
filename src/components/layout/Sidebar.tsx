import { NavLink } from 'react-router-dom'
import { Home, Boxes, Settings, User, LogOut, Loader2, Terminal } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import { useEffect, useState, useRef } from 'react'

export default function Sidebar() {
    const { isLoggedIn, isLoading, activeProfile: profile, login, logout, checkAuth } = useAuthStore()
    const { t } = useUIStore()
    const [hoveredItem, setHoveredItem] = useState<{ id: string; x: number; y: number; label: string } | null>(null)
    const hoverTimeout = useRef<NodeJS.Timeout | null>(null)

    const navItems = [
        { id: 'home', to: '/', icon: Home, label: t('sidebar.home') },
        { id: 'instances', to: '/instances', icon: Boxes, label: t('sidebar.instances') },
        { id: 'console', to: '/console', icon: Terminal, label: t('sidebar.console' as any) || 'Console' },
    ]

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    const handleMouseEnter = (item: any, e: React.MouseEvent) => {
        const x = e.clientX
        const y = e.clientY
        hoverTimeout.current = setTimeout(() => {
            setHoveredItem({ id: item.id, x, y, label: item.label })
        }, 1000) // 1 second delay
    }

    const handleMouseLeave = () => {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
        setHoveredItem(null)
    }

    return (
        <aside className="w-16 bg-dark-950/20 backdrop-blur-lg border-r border-dark-800 flex flex-col items-center">
            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-2 w-full">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        onMouseEnter={(e) => handleMouseEnter(item, e)}
                        onMouseLeave={handleMouseLeave}
                        className={({ isActive }) =>
                            `sidebar-item flex items-center justify-center p-3 rounded-xl transition-all duration-200 cursor-pointer w-full relative group ${isActive ? 'text-primary-400 bg-primary-600/10' : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800/40'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebar-indicator"
                                        className="absolute inset-0 bg-primary-600/20 rounded-xl"
                                        initial={false}
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <item.icon size={22} className="relative z-10" />
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Bottom section */}
            <div className="p-2 border-t border-dark-800 space-y-4 w-full flex flex-col items-center">
                {/* Settings Link */}
                <NavLink
                    to="/settings"
                    onMouseEnter={(e) => handleMouseEnter({ id: 'settings', label: t('sidebar.settings') }, e)}
                    onMouseLeave={handleMouseLeave}
                    className={({ isActive }) =>
                        `p-3 rounded-xl transition-all flex items-center justify-center w-full ${isActive ? 'text-primary-400 bg-primary-600/10' : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800/50'}`
                    }
                >
                    <Settings size={22} />
                </NavLink>

                {/* User section */}
                <div className="pb-4 w-full flex flex-col items-center gap-4">
                    {isLoggedIn && profile ? (
                        <div className="flex flex-col items-center gap-2">
                            <div
                                className="w-10 h-10 rounded-xl bg-dark-700 overflow-hidden border border-dark-600 cursor-pointer"
                                onMouseEnter={(e) => handleMouseEnter({ id: 'profile', label: profile.name }, e)}
                                onMouseLeave={handleMouseLeave}
                            >
                                <img
                                    src={`https://minotar.net/helm/${profile.name}/40`}
                                    alt={profile.name}
                                    className="w-full h-full"
                                />
                            </div>
                            <button
                                onClick={logout}
                                disabled={isLoading}
                                onMouseEnter={(e) => handleMouseEnter({ id: 'logout', label: t('settings.account.logout_btn') }, e)}
                                onMouseLeave={handleMouseLeave}
                                className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all text-dark-500"
                                title={t('settings.account.logout_btn')}
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={login}
                            disabled={isLoading}
                            onMouseEnter={(e) => handleMouseEnter({ id: 'login', label: t('settings.account.login_btn') }, e)}
                            onMouseLeave={handleMouseLeave}
                            className="w-10 h-10 rounded-xl bg-dark-800/50 hover:bg-dark-700/50 transition-all flex items-center justify-center border border-dark-700/50"
                        >
                            {isLoading ? (
                                <Loader2 size={20} className="text-primary-400 animate-spin" />
                            ) : (
                                <User size={20} className="text-dark-400" />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Tooltip Portal-like Overlay */}
            <AnimatePresence>
                {hoveredItem && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, x: hoveredItem.x + 10, y: hoveredItem.y - 10 }}
                        animate={{ opacity: 1, scale: 1, x: hoveredItem.x + 15, y: hoveredItem.y - 12 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className="fixed z-[100] px-3 py-1.5 bg-dark-800/90 border border-dark-600 text-dark-100 text-xs font-medium rounded-lg shadow-2xl backdrop-blur-md pointer-events-none"
                    >
                        {hoveredItem.label}
                    </motion.div>
                )}
            </AnimatePresence>
        </aside>
    )
}
