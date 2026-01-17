import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    User, Coffee, Settings as SettingsIcon, Globe, Info,
    LogOut, RefreshCw, Loader2, Github,
    MessageSquare, X, Play, Download, FolderOpen,
    CheckCircle2, AlertCircle, Trash2, HardDrive, Palette, Type
} from 'lucide-react'

import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { useSettingsStore } from '../../stores/settingsStore'
import FileBrowserModal from './FileBrowserModal'

interface SettingsModalProps {
    isOpen: boolean
    onClose: () => void
}

type TabId = 'account' | 'minecraft' | 'appearance' | 'general' | 'about'

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { t, language, setLanguage, font, setFont, theme, setTheme, mode, setMode } = useUIStore()
    const {
        activeProfile: profile,
        accounts,
        login,
        logout,
        switchAccount,
        removeAccount
    } = useAuthStore()

    const {
        setJavaVersionPath,
        memory, setMemory,
        closeOnLaunch, setCloseOnLaunch,
        maxConcurrentDownloads, setMaxConcurrentDownloads,
        maxConcurrentWrites, setMaxConcurrentWrites,
        launcherPath, setLauncherPath
    } = useSettingsStore()

    const [activeTab, setActiveTab] = useState<TabId>('account')
    const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false)
    const [activeJavaBrowseVersion, setActiveJavaBrowseVersion] = useState<8 | 17 | 21 | 25 | null>(null)

    const tabs = [
        { id: 'account', icon: User, label: t('settings.categories.account') },
        { id: 'minecraft', icon: Coffee, label: t('settings.categories.minecraft') },
        { id: 'appearance', icon: Palette, label: t('settings.appearance.title') },
        { id: 'general', icon: SettingsIcon, label: t('settings.categories.general') },
        { id: 'about', icon: Info, label: t('settings.categories.about') },
    ]

    const handleFileSelect = (path: string) => {
        if (activeJavaBrowseVersion) {
            setJavaVersionPath(activeJavaBrowseVersion, path)
        }
    }

    // Sub-component for Java version row
    const JavaVersionRow = ({ version }: { version: 8 | 17 | 21 | 25 }) => {
        const path = useSettingsStore(state => (state as any)[`java${version}Path`]);
        const [isDetecting, setIsDetecting] = useState(false);
        const [isInstalling, setIsInstalling] = useState(false);
        const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

        const handleDetect = async () => {
            setIsDetecting(true);
            try {
                const result = await window.electronAPI.eml.detectJavaVersion(version);
                if (result && result.path) {
                    setJavaVersionPath(version, result.path);
                }
            } finally {
                setIsDetecting(false);
            }
        };

        const handleInstall = async () => {
            setIsInstalling(true);
            try {
                const result = await window.electronAPI.eml.installJava(version);
                if (result.success && result.path) {
                    setJavaVersionPath(version, result.path);
                }
            } finally {
                setIsInstalling(false);
            }
        };

        const handleTest = async () => {
            if (!path) return;
            const result = await window.electronAPI.eml.testJava(path);
            setTestResult({
                success: result.success,
                msg: result.success ? result.version || 'Valid' : result.error || 'Failed'
            });
            setTimeout(() => setTestResult(null), 3000);
        };

        return (
            <div className="p-4 rounded-2xl bg-dark-800/30 border border-dark-700/50 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                            <Coffee size={20} className="text-orange-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-dark-100">Java {version}</p>
                            <p className="text-[10px] text-dark-500 font-medium uppercase tracking-wider">
                                {version === 21 || version === 17 ? t('settings.minecraft.lts') : version === 25 ? t('settings.minecraft.latest') : t('settings.minecraft.legacy')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {testResult && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${testResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}
                            >
                                {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                {testResult.msg}
                            </motion.div>
                        )}
                        <button
                            onClick={handleTest}
                            disabled={!path}
                            className="p-2 rounded-lg bg-dark-700 text-dark-300 hover:text-white hover:bg-dark-600 transition-all disabled:opacity-30"
                            title={t('settings.minecraft.test_title')}
                        >
                            <Play size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={path}
                        readOnly
                        placeholder={t('settings.minecraft.not_set')}
                        className="flex-1 px-4 py-2 rounded-xl bg-dark-900/50 border border-dark-700/50 text-dark-300 text-xs focus:outline-none"
                    />
                    <div className="flex gap-1">
                        <button
                            onClick={handleInstall}
                            disabled={isInstalling}
                            className="px-3 py-2 rounded-xl bg-primary-600/10 text-primary-400 border border-primary-500/20 hover:bg-primary-600/20 transition-all text-xs font-bold flex items-center gap-2"
                        >
                            {isInstalling ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            {t('settings.minecraft.install')}
                        </button>
                        <button
                            onClick={handleDetect}
                            disabled={isDetecting}
                            className="px-3 py-2 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600/20 transition-all text-xs font-bold flex items-center gap-2"
                        >
                            {isDetecting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            {t('settings.minecraft.detect')}
                        </button>
                        <button
                            onClick={() => {
                                setActiveJavaBrowseVersion(version);
                                setIsFileBrowserOpen(true);
                            }}
                            className="px-3 py-2 rounded-xl bg-dark-700 text-dark-300 hover:text-white hover:bg-dark-600 transition-all text-xs font-bold flex items-center gap-2"
                        >
                            <FolderOpen size={14} />
                            {t('settings.minecraft.browse')}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative z-10 w-full max-w-5xl glass-card h-[85vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="p-6 border-b border-dark-700/50 flex items-center justify-between bg-dark-900/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary-600/20">
                            <SettingsIcon size={24} className="text-primary-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-dark-100 leading-tight">{t('settings.title')}</h2>
                            <p className="text-xs text-dark-400">{t('settings.description')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-dark-800 rounded-lg transition-colors text-dark-400">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Horizontal Tabs */}
                    <div className="w-full border-b border-dark-700/50 bg-dark-950/20 px-6 pt-4 flex gap-2 overflow-x-auto custom-scrollbar">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabId)}
                                className={`relative flex items-center gap-2 px-6 py-4 rounded-t-xl transition-all ${activeTab === tab.id
                                    ? 'bg-dark-950/10 text-primary-400 border-b-2 border-primary-500'
                                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/30'
                                    }`}
                            >
                                <tab.icon size={18} />
                                <span className="font-bold text-sm tracking-wide">{tab.label}</span>
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-dark-950/10">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="max-w-3xl mx-auto"
                            >
                                {activeTab === 'account' && (
                                    <div className="space-y-8">
                                        <div>
                                            <h2 className="text-2xl font-black text-dark-100 mb-1 italic tracking-tight uppercase">{t('settings.account.header_title')}</h2>
                                            <p className="text-sm text-dark-400">{t('settings.account.header_desc')}</p>
                                        </div>

                                        {accounts.length > 0 ? (
                                            <div className="space-y-6">
                                                {profile && (
                                                    <div className="p-6 rounded-3xl bg-primary-600/10 border border-primary-500/20 flex items-center gap-6">
                                                        <div className="w-24 h-24 rounded-2xl bg-dark-700 flex items-center justify-center overflow-hidden border-2 border-primary-500/50 shadow-2xl">
                                                            <img
                                                                src={`https://minotar.net/helm/${profile.name}/128`}
                                                                alt={profile.name}
                                                                className="w-full h-full"
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="text-2xl font-black text-dark-100 tracking-tight">{profile.name}</h3>
                                                                <span className="px-2 py-0.5 rounded-full bg-primary-600 text-[10px] font-bold text-white uppercase tracking-widest shadow-lg shadow-primary-600/40">{t('settings.account.active')}</span>
                                                            </div>
                                                            <p className="text-sm text-dark-500 mt-0.5 font-medium">{t('settings.account.xbox_account')}</p>
                                                            <button
                                                                onClick={logout}
                                                                className="mt-4 flex items-center gap-2 text-sm font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider"
                                                            >
                                                                <LogOut size={16} />
                                                                {t('settings.account.logout_btn')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {accounts.length > 1 && (
                                                    <div className="bg-dark-800/20 rounded-3xl border border-dark-700/50 overflow-hidden">
                                                        <div className="px-6 py-3 border-b border-dark-700/50 bg-dark-900/40 text-[10px] font-black text-dark-500 uppercase tracking-[0.2em]">
                                                            {t('settings.account.other_accounts')}
                                                        </div>
                                                        <div className="divide-y divide-dark-700/30">
                                                            {accounts.filter(a => a.id !== profile?.id).map(acc => (
                                                                <div key={acc.id} className="p-5 flex items-center gap-4 hover:bg-dark-800/40 transition-all group">
                                                                    <img
                                                                        src={`https://minotar.net/helm/${acc.name}/48`}
                                                                        alt={acc.name}
                                                                        className="w-10 h-10 rounded-xl shadow-lg"
                                                                    />
                                                                    <span className="flex-1 text-sm font-bold text-dark-200">{acc.name}</span>
                                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                                        <button
                                                                            onClick={() => switchAccount(acc.id)}
                                                                            className="px-4 py-1.5 rounded-xl bg-dark-700 text-xs font-bold text-dark-200 hover:bg-primary-600 hover:text-white transition-all shadow-md"
                                                                        >
                                                                            {t('settings.account.switch')}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => removeAccount(acc.id)}
                                                                            className="p-2 rounded-xl text-dark-500 hover:text-red-400 transition-colors"
                                                                        >
                                                                            <X size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <button
                                                    onClick={login}
                                                    className="w-full py-5 rounded-3xl border-2 border-dashed border-dark-700 hover:border-primary-500/50 hover:bg-primary-600/5 text-dark-400 hover:text-primary-400 transition-all flex items-center justify-center gap-3 text-sm font-bold uppercase tracking-wider"
                                                >
                                                    <RefreshCw size={18} />
                                                    {t('settings.account.add_account')}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="p-12 rounded-3xl bg-dark-800/30 border-2 border-dashed border-dark-700 text-center">
                                                <div className="w-20 h-20 mx-auto rounded-3xl bg-dark-700/50 flex items-center justify-center mb-6">
                                                    <User size={40} className="text-dark-500" />
                                                </div>
                                                <p className="text-dark-400 mb-8 font-medium">{t('settings.account.not_logged_in')}</p>
                                                <button
                                                    onClick={login}
                                                    className="px-12 py-4 rounded-2xl bg-primary-600 text-white font-black uppercase tracking-[0.15em] transition-all hover:bg-primary-500 shadow-xl shadow-primary-600/30 active:scale-95"
                                                >
                                                    {t('settings.account.login_btn')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'minecraft' && (
                                    <div className="space-y-10">
                                        <div className="space-y-8">
                                            <div>
                                                <h2 className="text-2xl font-black text-dark-100 mb-2 italic tracking-tight uppercase">{t('settings.minecraft.runtime_title')}</h2>
                                                <p className="text-sm text-dark-400 mb-8">{t('settings.minecraft.runtime_desc')}</p>

                                                <div className="space-y-4">
                                                    <p className="text-[10px] font-black text-dark-500 uppercase tracking-[0.3em] mb-4">{t('settings.minecraft.java_installations')}</p>
                                                    <div className="space-y-4">
                                                        <JavaVersionRow version={25} />
                                                        <JavaVersionRow version={21} />
                                                        <JavaVersionRow version={17} />
                                                        <JavaVersionRow version={8} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-dark-800/50">
                                                <h3 className="text-[10px] font-black text-dark-500 uppercase tracking-[0.3em] mb-8 flex items-center justify-between">
                                                    {t('settings.minecraft.ram_allocation')}
                                                    <span className="text-primary-400 font-black tracking-normal text-sm">{memory.min}MB - {memory.max}MB</span>
                                                </h3>

                                                <div className="space-y-10 px-4">
                                                    <div>
                                                        <div className="flex justify-between text-[11px] text-dark-400 mb-4 font-bold uppercase tracking-wider">
                                                            <span>{t('settings.minecraft.min_ram')}</span>
                                                            <span className="text-dark-200">{memory.min} MB</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="512"
                                                            max="16384"
                                                            step="512"
                                                            value={memory.min}
                                                            onChange={(e) => setMemory(parseInt(e.target.value), Math.max(memory.max, parseInt(e.target.value)))}
                                                            className="range-primary w-full"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between text-[11px] text-dark-400 mb-4 font-bold uppercase tracking-wider">
                                                            <span>{t('settings.minecraft.max_ram')}</span>
                                                            <span className="text-dark-200">{memory.max} MB</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="1024"
                                                            max="32768"
                                                            step="512"
                                                            value={memory.max}
                                                            onChange={(e) => setMemory(Math.min(memory.min, parseInt(e.target.value)), parseInt(e.target.value))}
                                                            className="range-primary w-full"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'appearance' && (
                                    <div className="space-y-10">
                                        <div className="space-y-8">
                                            <div>
                                                <h2 className="text-2xl font-black text-dark-100 mb-2 italic tracking-tight uppercase">Appearance</h2>
                                                <p className="text-sm text-dark-400 mb-8">Customize the look and feel of the launcher.</p>

                                                {/* Font Selection */}
                                                <div className="space-y-4 mb-8">
                                                    <p className="text-[10px] font-black text-dark-500 uppercase tracking-[0.3em] mb-4">Font Family</p>
                                                    <div className="grid grid-cols-3 gap-4">
                                                        {[
                                                            { id: 'inter', label: 'Inter (Default)', font: 'font-sans' },
                                                            { id: 'minecraft', label: 'Minecraft', font: 'font-minecraft' },
                                                            { id: 'system', label: 'System UI', font: 'font-sans' },
                                                        ].map((f) => (
                                                            <button
                                                                key={f.id}
                                                                onClick={() => setFont(f.id as any)}
                                                                className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 ${font === f.id
                                                                    ? 'bg-primary-600 border-primary-500 text-white shadow-lg shadow-primary-600/20'
                                                                    : 'bg-dark-800/30 border-dark-700/50 text-dark-300 hover:bg-dark-800/50 hover:text-dark-100'
                                                                    }`}
                                                            >
                                                                <Type size={24} className={font === f.id ? 'text-white' : 'text-dark-400'} />
                                                                <span className={`text-sm font-bold ${f.font}`}>{f.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Theme Selection */}
                                                <div className="space-y-4">
                                                    <p className="text-[10px] font-black text-dark-500 uppercase tracking-[0.3em] mb-4">Color Theme</p>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {[
                                                            { id: 'default', label: 'Violet', color: 'bg-violet-500', from: 'from-violet-500', to: 'to-violet-600', text: 'text-violet-400' },
                                                            { id: 'emerald', label: 'Emerald', color: 'bg-emerald-500', from: 'from-emerald-500', to: 'to-emerald-600', text: 'text-emerald-400' },
                                                            { id: 'rose', label: 'Rose', color: 'bg-rose-500', from: 'from-rose-500', to: 'to-rose-600', text: 'text-rose-400' },
                                                            { id: 'amber', label: 'Amber', color: 'bg-amber-500', from: 'from-amber-500', to: 'to-amber-600', text: 'text-amber-400' },
                                                            { id: 'blue', label: 'Blue', color: 'bg-blue-500', from: 'from-blue-500', to: 'to-blue-600', text: 'text-blue-400' },
                                                            { id: 'orange', label: 'Orange', color: 'bg-orange-500', from: 'from-orange-500', to: 'to-orange-600', text: 'text-orange-400' },
                                                        ].map((t) => (
                                                            <button
                                                                key={t.id}
                                                                onClick={() => setTheme(t.id as any)}
                                                                className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 text-left ${theme === t.id
                                                                    ? 'bg-dark-800 border-primary-500 ring-1 ring-primary-500/50 shadow-xl'
                                                                    : 'bg-dark-800/30 border-dark-700/50 hover:bg-dark-800/50 hover:border-dark-600 hover:-translate-y-1'
                                                                    }`}
                                                            >
                                                                {/* Preview Banner */}
                                                                <div className={`h-24 w-full bg-gradient-to-br ${t.from} ${t.to} relative p-4 flex flex-col justify-end`}>
                                                                    {theme === t.id && (
                                                                        <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-md p-1.5 rounded-full text-white shadow-sm">
                                                                            <CheckCircle2 size={16} />
                                                                        </div>
                                                                    )}

                                                                    {/* Mock UI Elements */}
                                                                    <div className="flex gap-2 mb-2 opacity-80">
                                                                        <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm" />
                                                                        <div className="w-16 h-8 rounded-lg bg-white/20 backdrop-blur-sm" />
                                                                    </div>

                                                                    <p className="text-white font-black text-lg tracking-tight shadow-sm">{t.label}</p>
                                                                </div>

                                                                {/* Details */}
                                                                <div className="p-4 flex items-center justify-between">
                                                                    <div className="flex gap-1.5">
                                                                        <div className={`w-3 h-3 rounded-full ${t.color}`} />
                                                                        <div className={`w-3 h-3 rounded-full ${t.color} opacity-60`} />
                                                                        <div className={`w-3 h-3 rounded-full ${t.color} opacity-30`} />
                                                                    </div>
                                                                    <p className={`text-[10px] font-bold uppercase tracking-wider ${theme === t.id ? t.text : 'text-dark-500 group-hover:text-dark-300'} transition-colors`}>
                                                                        {theme === t.id ? 'Active' : 'Apply'}
                                                                    </p>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Theme Mode Selection */}
                                                <div className="space-y-4">
                                                    <p className="text-[10px] font-black text-dark-500 uppercase tracking-[0.3em] mb-4">Theme Mode</p>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {[
                                                            { id: 'dark', label: 'Dark', bg: 'bg-slate-900', border: 'border-slate-700', text: 'text-slate-200' },
                                                            { id: 'light', label: 'Light', bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800' },
                                                            { id: 'oled', label: 'OLED', bg: 'bg-black', border: 'border-white/10', text: 'text-white' },
                                                            { id: 'system', label: 'System', bg: 'bg-dark-800', border: 'border-dark-600', text: 'text-dark-200' },
                                                        ].map((m) => (
                                                            <button
                                                                key={m.id}
                                                                onClick={() => setMode(m.id as any)}
                                                                className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 text-left h-24 flex items-center ${mode === m.id
                                                                    ? 'bg-dark-800 border-primary-500 ring-1 ring-primary-500/50 shadow-xl'
                                                                    : 'bg-dark-800/30 border-dark-700/50 hover:bg-dark-800/50 hover:border-dark-600 hover:-translate-y-1'
                                                                    }`}
                                                            >
                                                                {/* Preview Area (Left Split) */}
                                                                <div className={`w-20 h-full ${m.bg} ${m.border} border-r relative flex items-center justify-center`}>
                                                                    {/* Mini Mock UI */}
                                                                    <div className="space-y-1.5 w-12 opacity-80">
                                                                        <div className={`h-1.5 rounded-full w-8 ${m.id === 'light' ? 'bg-slate-400' : 'bg-slate-600'}`} />
                                                                        <div className={`h-1.5 rounded-full w-full ${m.id === 'light' ? 'bg-slate-300' : 'bg-slate-700'}`} />
                                                                        <div className={`h-1.5 rounded-full w-10 ${m.id === 'light' ? 'bg-slate-300' : 'bg-slate-700'}`} />
                                                                    </div>

                                                                    {mode === m.id && (
                                                                        <div className="absolute inset-0 bg-primary-500/20 backdrop-blur-[1px] flex items-center justify-center">
                                                                            <CheckCircle2 size={20} className="text-white drop-shadow-md" />
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Label Area */}
                                                                <div className="flex-1 px-5">
                                                                    <p className="font-black text-sm text-dark-100 uppercase tracking-wide">{m.label}</p>
                                                                    <p className="text-[10px] text-dark-500 font-bold mt-1">
                                                                        {mode === m.id ? 'Active Mode' : 'Select Mode'}
                                                                    </p>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'general' && (
                                    <div className="space-y-10">
                                        <div className="space-y-8">
                                            <div>
                                                <h2 className="text-2xl font-black text-dark-100 mb-6 italic tracking-tight uppercase">{t('settings.general.title')}</h2>

                                                <div className="flex items-center justify-between p-6 rounded-3xl bg-dark-800/30 border border-dark-700/50 hover:bg-dark-800/40 transition-colors">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                                                            <Globe size={24} className="text-blue-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-base font-bold text-dark-100">{t('settings.general.language')}</p>
                                                            <p className="text-xs text-dark-500 mt-0.5">{t('settings.general.language_desc')}</p>
                                                        </div>
                                                    </div>
                                                    <select
                                                        value={language}
                                                        onChange={(e) => setLanguage(e.target.value as any)}
                                                        className="bg-dark-700 border-2 border-dark-600 text-dark-200 text-sm font-bold rounded-xl px-4 py-2 focus:outline-none focus:border-primary-500/50 appearance-none min-w-[140px] shadow-lg transition-all"
                                                    >
                                                        <option value="ja-JP">日本語 (Japanese)</option>
                                                        <option value="en-US">English (US)</option>
                                                        <option value="es-ES">Español (Spanish)</option>
                                                        <option value="fr-FR">Français (French)</option>
                                                        <option value="de-DE">Deutsch (German)</option>
                                                        <option value="it-IT">Italiano (Italian)</option>
                                                        <option value="pt-BR">Português (Brazil)</option>
                                                        <option value="ru-RU">Русский (Russian)</option>
                                                        <option value="zh-CN">简体中文 (Simplified Chinese)</option>
                                                        <option value="zh-TW">繁體中文 (Traditional Chinese)</option>
                                                        <option value="ko-KR">한국어 (Korean)</option>
                                                        <option value="tr-TR">Türkçe (Turkish)</option>
                                                        <option value="id-ID">Bahasa Indonesia</option>
                                                        <option value="hi-IN">हिन्दी (Hindi)</option>
                                                        <option value="ar-SA">العربية (Arabic)</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <p className="text-[10px] font-black text-dark-500 uppercase tracking-[0.3em] mb-4">{t('settings.general.launcher_preferences')}</p>
                                                <div
                                                    className="flex items-center justify-between p-6 rounded-3xl bg-dark-800/30 border border-dark-700/50 cursor-pointer hover:bg-dark-800/40 transition-all group"
                                                    onClick={() => setCloseOnLaunch(!closeOnLaunch)}
                                                >
                                                    <div className="flex items-center gap-5">
                                                        <div className={`w-12 h-12 rounded-2xl transition-colors flex items-center justify-center ${closeOnLaunch ? 'bg-primary-600/10' : 'bg-dark-700/50'}`}>
                                                            <LogOut size={24} className={closeOnLaunch ? 'text-primary-400' : 'text-dark-500'} />
                                                        </div>
                                                        <p className="text-base font-bold text-dark-100 group-hover:text-white transition-colors">{t('settings.general.close_on_launch')}</p>
                                                    </div>
                                                    <div className={`w-14 h-7 rounded-full p-1.5 transition-all duration-300 ${closeOnLaunch ? 'bg-primary-600 shadow-lg shadow-primary-600/30' : 'bg-dark-700'}`}>
                                                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${closeOnLaunch ? 'translate-x-7' : 'translate-x-0'}`} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Advanced Settings */}
                                            <div className="space-y-4 pt-6 border-t border-dark-800/50">
                                                <p className="text-[10px] font-black text-dark-500 uppercase tracking-[0.3em] mb-4">{t('settings.general.advanced_title')}</p>

                                                {/* Root Directory */}
                                                <div className="p-6 rounded-3xl bg-dark-800/30 border border-dark-700/50 space-y-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                                            <HardDrive size={20} className="text-purple-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-dark-100">{t('settings.general.root_dir')}</p>
                                                            <p className="text-xs text-dark-500">{t('settings.general.root_dir_desc')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={launcherPath || t('settings.minecraft.not_set')}
                                                            readOnly
                                                            className="flex-1 px-4 py-2 rounded-xl bg-dark-900/50 border border-dark-700/50 text-dark-300 text-xs focus:outline-none"
                                                        />
                                                        <button
                                                            onClick={async () => {
                                                                const result = await window.electronAPI.dialog.openDirectory();
                                                                if (result) setLauncherPath(result);
                                                            }}
                                                            className="px-4 py-2 rounded-xl bg-dark-700 text-dark-300 hover:text-white hover:bg-dark-600 transition-all text-xs font-bold"
                                                        >
                                                            {t('settings.general.change')}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* App Cache */}
                                                <div className="flex items-center justify-between p-6 rounded-3xl bg-dark-800/30 border border-dark-700/50">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                                                            <Trash2 size={24} className="text-orange-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-base font-bold text-dark-100">{t('settings.general.app_cache')}</p>
                                                            <p className="text-xs text-dark-500 mt-0.5">{t('settings.general.app_cache_desc')}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => window.electronAPI.app.clearCache()}
                                                        className="px-4 py-2 rounded-xl bg-dark-700 text-dark-300 hover:text-red-400 hover:bg-dark-600 transition-all text-xs font-bold"
                                                    >
                                                        {t('settings.general.purge_cache')}
                                                    </button>
                                                </div>

                                                {/* Max Concurrent Downloads */}
                                                <div className="p-6 rounded-3xl bg-dark-800/30 border border-dark-700/50 space-y-4">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <div>
                                                            <p className="text-sm font-bold text-dark-100">{t('settings.general.max_downloads')}</p>
                                                            <p className="text-[10px] text-dark-500">{t('settings.general.max_downloads_desc')}</p>
                                                        </div>
                                                        <span className="text-primary-400 font-black text-sm">{maxConcurrentDownloads}</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="1"
                                                        max="10"
                                                        step="1"
                                                        value={maxConcurrentDownloads}
                                                        onChange={(e) => setMaxConcurrentDownloads(parseInt(e.target.value))}
                                                        className="range-primary w-full"
                                                    />
                                                </div>

                                                {/* Max Concurrent Writes */}
                                                <div className="p-6 rounded-3xl bg-dark-800/30 border border-dark-700/50 space-y-4">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <div>
                                                            <p className="text-sm font-bold text-dark-100">{t('settings.general.max_writes')}</p>
                                                            <p className="text-[10px] text-dark-500">{t('settings.general.max_writes_desc')}</p>
                                                        </div>
                                                        <span className="text-primary-400 font-black text-sm">{maxConcurrentWrites}</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="1"
                                                        max="50"
                                                        step="1"
                                                        value={maxConcurrentWrites}
                                                        onChange={(e) => setMaxConcurrentWrites(parseInt(e.target.value))}
                                                        className="range-primary w-full"
                                                    />
                                                </div>

                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'about' && (
                                    <div className="space-y-12 py-4">
                                        <div className="text-center">
                                            <div className="w-28 h-28 mx-auto rounded-[32px] bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-2xl shadow-primary-500/30 mb-8 transform hover:rotate-6 transition-transform">
                                                <span className="text-white font-black text-5xl italic tracking-tighter">R</span>
                                            </div>
                                            <h2 className="text-4xl font-black text-dark-100 italic tracking-tighter uppercase mb-2">ReaLauncher</h2>
                                            <p className="text-dark-400 font-bold uppercase tracking-[0.2em] text-sm">Next-Gen Minecraft Launcher</p>
                                            <p className="inline-block px-4 py-1 rounded-full bg-dark-800/50 text-dark-600 text-[10px] font-black mt-6 tracking-widest border border-dark-700/50">v0.2.0-BETA • PREMIUM BUILD</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <a
                                                href="https://github.com/ReaQwQ/ReaLauncher"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-5 p-6 rounded-3xl bg-dark-800/30 border border-dark-700/50 hover:bg-dark-800/50 transition-all group hover:-translate-y-1"
                                            >
                                                <div className="w-12 h-12 rounded-2xl bg-dark-700 flex items-center justify-center group-hover:bg-dark-600 transition-colors shadow-lg">
                                                    <Github size={24} className="text-dark-200" />
                                                </div>
                                                <div>
                                                    <p className="text-base font-black text-dark-200 tracking-tight">{t('settings.about.github')}</p>
                                                    <p className="text-[10px] text-dark-500 font-bold mt-0.5 group-hover:text-primary-400 transition-colors uppercase tracking-widest">{t('settings.about.source_code')}</p>
                                                </div>
                                            </a>
                                            <a
                                                href="https://discord.com"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-5 p-6 rounded-3xl bg-dark-800/30 border border-dark-700/50 hover:bg-dark-800/50 transition-all group hover:-translate-y-1"
                                            >
                                                <div className="w-12 h-12 rounded-2xl bg-[#5865F2]/10 flex items-center justify-center group-hover:bg-[#5865F2]/20 transition-colors shadow-lg">
                                                    <MessageSquare size={24} className="text-[#5865F2]" />
                                                </div>
                                                <div>
                                                    <p className="text-base font-black text-dark-200 tracking-tight">{t('settings.about.discord')}</p>
                                                    <p className="text-[10px] text-dark-500 font-bold mt-0.5 group-hover:text-primary-400 transition-colors uppercase tracking-widest">{t('settings.about.community')}</p>
                                                </div>
                                            </a>
                                        </div>

                                        <div className="pt-10 border-t border-dark-800 text-center">
                                            <p className="text-[10px] text-dark-600 font-bold uppercase tracking-widest leading-relaxed">
                                                {t('settings.about.copyright')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>

            <FileBrowserModal
                isOpen={isFileBrowserOpen}
                onClose={() => setIsFileBrowserOpen(false)}
                onSelect={handleFileSelect}
                mode="file"
                allowedExtensions={['exe']}
                title={t('settings.minecraft.java_path')}
            />
        </div>
    )
}
