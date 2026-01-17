import { create } from 'zustand'

export type NotificationType = 'success' | 'error' | 'info' | 'warning'



export interface Notification {
    id: string
    key?: string // Used to identify/update persistent notifications (e.g. downloads)
    type: NotificationType
    title: string
    message: string
    duration?: number
    progress?: {
        current: number
        total: number
        percentage: number
    }
}

interface NotificationState {
    notifications: Notification[]
    addNotification: (notification: Omit<Notification, 'id'>) => void
    updateNotification: (key: string, updates: Partial<Notification>) => void
    removeNotification: (id: string) => void
    removeNotificationByKey: (key: string) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    addNotification: (notification) => {
        // If key exists, update instead of add
        if (notification.key) {
            set((state) => {
                const existing = state.notifications.find(n => n.key === notification.key)
                if (existing) {
                    // Auto-remove after duration if specified in update
                    if (notification.duration && notification.duration > 0) {
                        setTimeout(() => {
                            set((state) => ({
                                notifications: state.notifications.filter((n) => n.key !== notification.key)
                            }))
                        }, notification.duration)
                    }

                    return {
                        notifications: state.notifications.map(n =>
                            n.key === notification.key ? { ...n, ...notification, id: n.id } : n
                        )
                    }
                }
                const id = Math.random().toString(36).substring(2, 9)
                return { notifications: [...state.notifications, { ...notification, id }] }
            })
        } else {
            const id = Math.random().toString(36).substring(2, 9)
            const newNotification = { ...notification, id }

            set((state) => ({
                notifications: [...state.notifications, newNotification]
            }))

            // Auto-remove after duration
            if (notification.duration !== 0) {
                setTimeout(() => {
                    set((state) => ({
                        notifications: state.notifications.filter((n) => n.id !== id)
                    }))
                }, notification.duration || 5000)
            }
        }
    },
    updateNotification: (key, updates) => {
        set((state) => ({
            notifications: state.notifications.map(n =>
                n.key === key ? { ...n, ...updates } : n
            )
        }))
    },
    removeNotification: (id) => {
        set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id)
        }))
    },
    removeNotificationByKey: (key) => {
        set((state) => ({
            notifications: state.notifications.filter((n) => n.key !== key)
        }))
    }
}))
