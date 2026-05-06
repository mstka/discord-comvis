import { ShieldAlert, X, Info, AlertCircle } from 'lucide-react'
import { useNotificationStore, type NotificationType } from '../store/notificationStore'

const CONFIG: Record<NotificationType, {
  icon: React.ElementType
  iconClass: string
  borderClass: string
  titleClass: string
}> = {
  forbidden: {
    icon: ShieldAlert,
    iconClass: 'text-amber-400',
    borderClass: 'border-amber-800/60',
    titleClass: 'text-amber-300',
  },
  error: {
    icon: AlertCircle,
    iconClass: 'text-red-400',
    borderClass: 'border-red-800/60',
    titleClass: 'text-red-300',
  },
  info: {
    icon: Info,
    iconClass: 'text-discord-blurple',
    borderClass: 'border-discord-blurple/40',
    titleClass: 'text-discord-blurple',
  },
}

export default function NotificationToast() {
  const { notifications, dismiss } = useNotificationStore()

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 pointer-events-none">
      {notifications.map((n) => {
        const { icon: Icon, iconClass, borderClass, titleClass } = CONFIG[n.type]
        return (
          <div
            key={n.id}
            className={`pointer-events-auto w-80 bg-gray-900 border ${borderClass} rounded-xl shadow-2xl shadow-black/50 p-4 flex gap-3 animate-slide-in`}
          >
            <Icon size={18} className={`${iconClass} shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${titleClass} mb-0.5`}>{n.title}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{n.message}</p>
            </div>
            <button
              onClick={() => dismiss(n.id)}
              className="text-gray-600 hover:text-gray-300 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
