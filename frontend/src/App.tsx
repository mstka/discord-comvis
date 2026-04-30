import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import Graph from './pages/Graph'
import Analysis from './pages/Analysis'
import Settings from './pages/Settings'

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })

const NAV = [
  { to: '/', label: 'ダッシュボード' },
  { to: '/graph', label: 'グラフ' },
  { to: '/analyze', label: '分析実行' },
  { to: '/settings', label: '設定' },
]

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <nav className="w-52 bg-gray-900 border-r border-gray-800 flex flex-col py-6 px-3 gap-1 shrink-0">
            <div className="text-discord-blurple font-bold text-lg mb-6 px-2">Discord ComVis</div>
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-discord-blurple text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Main content */}
          <main className="flex-1 overflow-auto bg-gray-950">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/graph" element={<Graph />} />
              <Route path="/analyze" element={<Analysis />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
