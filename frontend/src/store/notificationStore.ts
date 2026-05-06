import { create } from 'zustand'

export type NotificationType = 'forbidden' | 'error' | 'info'

interface Notification {
  id: number
  type: NotificationType
  title: string
  message: string
}

interface NotificationState {
  notifications: Notification[]
  push: (type: NotificationType, title: string, message: string) => void
  dismiss: (id: number) => void
}

let _seq = 0

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  push: (type, title, message) => {
    const id = ++_seq
    set((s) => ({ notifications: [...s.notifications, { id, type, title, message }] }))
    // 自動消去 (4秒)
    setTimeout(() => {
      set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }))
    }, 4000)
  },
  dismiss: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
}))
