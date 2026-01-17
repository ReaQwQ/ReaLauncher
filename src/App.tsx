import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import Discover from './pages/Discover'
import Instances from './pages/Instances'
import InstanceDetail from './pages/InstanceDetail'
import Console from './pages/Console'
import ContentDetail from './pages/ContentDetail'
import CreateInstance from './pages/CreateInstance'
import Settings from './pages/Settings'
import { useUIStore } from './stores/uiStore'
import { useSettingsStore } from './stores/settingsStore'
function App() {
    const { t } = useUIStore()

    useEffect(() => {
        // Initialize settings
        useSettingsStore.getState().fetchLauncherPath()

        // Global Log Listener
        const unsubscribeLogs = window.electronAPI.eml.onLog((data: { level: any; message: string, instanceId?: string }) => {
            import('./stores/logStore').then(({ useLogStore }) => {
                useLogStore.getState().addLog(data.level, data.message, data.instanceId)
            })
        })

        // Global Progress Listener
        const unsubscribeProgress = window.electronAPI.eml.onDownloadProgress((data: any) => {
            // data: { type: string; current: number; total: number; percentage: number; filename: string }
            // We use data.type as the key to group notifications (e.g. 'minecraft', 'modpack', 'hash')

            // Map backend types to friendly titles
            let title = t('app.notifications.downloading')
            switch (data.type) {
                case 'minecraft': title = t('app.notifications.downloading_mc'); break;
                case 'modpack': title = t('app.notifications.downloading_modpack'); break;
                case 'java': title = t('app.notifications.installing_java'); break;
                case 'loader': title = t('app.notifications.installing_loader'); break;
                case 'assets': title = t('app.notifications.downloading_assets'); break;
                case 'hash': title = t('app.notifications.verifying'); break;
                case 'detect': title = t('app.notifications.detecting'); break;
                case 'game': title = t('app.notifications.loading_game'); break;
                default: title = data.filename || t('app.notifications.downloading'); break;
            }

            // Auto-dismiss when complete
            const isComplete = data.percentage >= 100
            const duration = isComplete ? 2000 : 0 // 0 means persistent until manually removed or updated

            import('./stores/notificationStore').then(({ useNotificationStore }) => {
                useNotificationStore.getState().addNotification({
                    key: data.type, // Use type as key to identify and update this notification
                    type: 'info',
                    title: title,
                    message: `${data.filename || ''}`,
                    duration: duration,
                    progress: {
                        current: data.current,
                        total: data.total,
                        percentage: data.percentage
                    }
                })
            })
        })

        return () => {
            unsubscribeLogs()
            unsubscribeProgress()
        }
    }, [])

    return (
        <HashRouter>
            <Layout>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/discover" element={<Discover />} />
                    <Route path="/mods" element={<Discover />} />
                    <Route path="/mod/:source/:id" element={<ContentDetail type="mod" />} />
                    <Route path="/modpack/:source/:id" element={<ContentDetail type="modpack" />} />
                    <Route path="/instances" element={<Instances />} />
                    <Route path="/instances/create" element={<CreateInstance />} />
                    <Route path="/instances/:instanceId" element={<InstanceDetail />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/console" element={<Console />} />
                </Routes>
            </Layout>
        </HashRouter>
    )
}

export default App
