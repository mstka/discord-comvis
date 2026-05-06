import { BrowserRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Network, PlayCircle, Users, ClipboardList,
  Settings, Bot, ChevronRight, Wifi, WifiOff, Loader2,
  LogOut, ShieldCheck, Eye,
} from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Graph from './pages/Graph'
import Analysis from './pages/Analysis'
import SettingsPage from './pages/Settings'
import MemberView from './pages/MemberView'
import ManagerView from './pages/ManagerView'
import Login from './pages/Login'
import { healthApi } from './api/client'
import { useAuthStore } from './store/authStore'

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })

const NAV = [
  { to: '/', label: 'ダッシュボード', icon: LayoutDashboard, end: true },
  { to: '/graph', label: '関係性グラフ', icon: Network, end: false },
  { to: '/analyze', label: '分析実行', icon: PlayCircle, end: false },
  { to: '/member', label: 'メンバー確認', icon: Users, end: false },
  { to: '/manager', label: 'マネージャー', icon: ClipboardList, end: false },
  { to: '/settings', label: '設定', icon: Settings, end: false },
]

function BotStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: () => healthApi.get().then(r => r.data),
    refetchInterval: 10_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 text-gray-400 text-xs">
        <Loader2 size={12} className="animate-spin" />
        <span>接続確認中...</span>
      </div>
    )
  }

  if (data?.bot_ready) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-950/60 border border-green-800/40 text-xs">
        <Wifi size={12} className="text-discord-green" />
        <span className="text-green-400 font-medium truncate">{data.bot_user ?? 'Bot接続済み'}</span>
      </div>
    )
  }

  return (
    <NavLink to="/settings" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/60 border border-red-800/40 text-xs hover:bg-red-900/50 transition-colors">
      <WifiOff size={12} className="text-discord-red" />
      <span className="text-red-400 font-medium">Bot未接続 →設定</span>
    </NavLink>
  )
}

function RoleBadge() {
  const { role, logout } = useAuthStore()
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/40 text-xs">
      <div className="flex items-center gap-1.5">
        {role === 'admin'
          ? <ShieldCheck size={12} className="text-discord-blurple" />
          : <Eye size={12} className="text-gray-400" />
        }
        <span className={role === 'admin' ? 'text-discord-blurple font-medium' : 'text-gray-400'}>
          {role === 'admin' ? '管理者' : '閲覧者'}
        </span>
      </div>
      <button
        onClick={logout}
        className="text-gray-600 hover:text-gray-300 transition-colors"
        title="ログアウト"
      >
        <LogOut size={12} />
      </button>
    </div>
  )
}

function Sidebar() {
  return (
    <nav className="w-60 bg-gray-950 border-r border-gray-800/60 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-discord-blurple flex items-center justify-center shrink-0">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">CBReview</p>
            <p className="text-gray-500 text-xs mt-0.5">Discord分析</p>
          </div>
        </div>
      </div>

      {/* Status widgets */}
      <div className="px-3 pb-2 space-y-2">
        <BotStatus />
        <RoleBadge />
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-gray-800/60 mb-3" />

      {/* Nav */}
      <div className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-discord-blurple/15 text-discord-blurple border border-discord-blurple/25'
                  : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200 border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className={isActive ? 'text-discord-blurple' : 'text-gray-500 group-hover:text-gray-300'} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={12} className="text-discord-blurple/60" />}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-800/60">
        <p className="text-gray-600 text-xs">CBReview v1.0</p>
      </div>
    </nav>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/graph" element={<Graph />} />
          <Route path="/analyze" element={<Analysis />} />
          <Route path="/member" element={<MemberView />} />
          <Route path="/member/:memberId" element={<MemberView />} />
          <Route path="/manager" element={<ManagerView />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
