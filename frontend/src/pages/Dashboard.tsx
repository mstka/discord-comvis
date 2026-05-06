import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
} from 'recharts'
import { AlertTriangle, Eye, TrendingUp, MessageSquare, GitFork, CheckCircle, Users } from 'lucide-react'
import { dashboardApi, membersApi } from '../api/client'
import { Tooltip } from '../components/Tooltip'

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: React.ElementType; accent: string }) {
  return (
    <div className={`bg-gray-900 border border-gray-800/80 rounded-xl p-5 flex items-center gap-4`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-gray-400 text-xs mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  )
}

function RiskBadge({ level }: { level: 'high' | 'medium' }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      level === 'high' ? 'bg-red-950 text-red-400 border border-red-800/60' : 'bg-amber-950 text-amber-400 border border-amber-800/60'
    }`}>
      {level === 'high' ? '⚠ 高リスク' : '△ 中リスク'}
    </span>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: kpis } = useQuery({ queryKey: ['kpis'], queryFn: () => dashboardApi.kpis().then(r => r.data), refetchInterval: 30_000 })
  const { data: ranking } = useQuery({ queryKey: ['ranking'], queryFn: () => dashboardApi.ranking().then(r => r.data), refetchInterval: 30_000 })
  const { data: timeline } = useQuery({ queryKey: ['timeline'], queryFn: () => dashboardApi.timeline().then(r => r.data), refetchInterval: 60_000 })
  const { data: unresolved } = useQuery({ queryKey: ['unresolved'], queryFn: () => dashboardApi.unresolved().then(r => r.data) })
  const { data: risks } = useQuery({ queryKey: ['risk-analysis'], queryFn: () => membersApi.riskAnalysis().then(r => r.data) })
  const { data: oversight } = useQuery({ queryKey: ['oversight'], queryFn: () => membersApi.oversightCandidates().then(r => r.data) })

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ダッシュボード</h1>
          <p className="text-gray-400 text-sm mt-0.5">チームのコミュニケーション可視化</p>
        </div>
        <span className="text-xs text-gray-500 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg">
          {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })} 時点
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="総メッセージ数" value={kpis?.total_messages?.toLocaleString() ?? '—'} icon={MessageSquare} accent="bg-discord-blurple" />
        <StatCard label="関係性エッジ" value={kpis?.total_edges?.toLocaleString() ?? '—'} icon={GitFork} accent="bg-purple-700" />
        <StatCard label="解決率" value={kpis ? `${(kpis.resolved_ratio * 100).toFixed(1)}%` : '—'} icon={CheckCircle} accent="bg-green-700" />
        <StatCard label="貢献者数" value={kpis?.active_contributors ?? '—'} icon={Users} accent="bg-cyan-700" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contribution ranking */}
        <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-5">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-discord-blurple" />
            貢献度ランキング Top 10
          </h2>
          {ranking && ranking.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ranking} layout="vertical" margin={{ left: 80, right: 20 }}>
                <XAxis type="number" domain={[0, 1]} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis type="category" dataKey="display_name" tick={{ fill: '#9ca3af', fontSize: 11 }} width={78} />
                <RechartsTooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#f9fafb' }}
                  formatter={(v: number) => [v.toFixed(3), '貢献スコア']}
                />
                <Bar dataKey="contribution_score" fill="#5865F2" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-600 text-sm">分析実行後に表示されます</div>
          )}
        </div>

        {/* 関係性変化グラフ */}
        <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-5">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <GitFork size={16} className="text-purple-400" />
            関係性変化グラフ（直近30日）
          </h2>
          {timeline && timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={timeline} margin={{ left: 0, right: 10 }}>
                <defs>
                  <linearGradient id="edgeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5865F2" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#5865F2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                <RechartsTooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#f9fafb' }}
                  formatter={(v: number) => [v, '関係エッジ数']}
                />
                <Area type="monotone" dataKey="count" stroke="#5865F2" strokeWidth={2} fill="url(#edgeGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-600 text-sm">分析実行後に表示されます</div>
          )}
        </div>
      </div>

      {/* Risk & Oversight row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 負荷集中リスク */}
        <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-5">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            <Tooltip term="負荷集中リスク">負荷集中リスク</Tooltip>
          </h2>
          <p className="text-gray-500 text-xs mb-4">平均の1.5倍以上の対応を担っているメンバー</p>
          {risks && risks.length > 0 ? (
            <div className="space-y-3">
              {risks.map(r => (
                <div key={r.member_id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigate(`/member/${r.member_id}`)}
                      className="font-medium text-sm text-white hover:text-discord-blurple truncate block"
                    >
                      {r.display_name}
                    </button>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${r.risk_level === 'high' ? 'bg-red-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(100, (r.load_ratio / 4) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{r.resolved_count}件 ({r.load_ratio}x)</span>
                    </div>
                  </div>
                  <RiskBadge level={r.risk_level} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-20 text-gray-600 text-sm">
              {risks === undefined ? '読み込み中...' : '負荷集中なし ✓'}
            </div>
          )}
        </div>

        {/* 評価見落とし候補 */}
        <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-5">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Eye size={16} className="text-cyan-400" />
            <Tooltip term="評価見落とし候補">評価見落とし候補</Tooltip>
          </h2>
          <p className="text-gray-500 text-xs mb-4">貢献度が高いが可視性が低いメンバー</p>
          {oversight && oversight.length > 0 ? (
            <div className="space-y-2">
              {oversight.slice(0, 5).map(c => (
                <div key={c.member_id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigate(`/member/${c.member_id}`)}
                      className="font-medium text-sm text-white hover:text-discord-blurple truncate block"
                    >
                      {c.display_name}
                    </button>
                    <p className="text-xs text-gray-500 mt-0.5">
                      貢献: <span className="text-cyan-400">{(c.contribution_score * 100).toFixed(0)}%</span>
                      　可視性: <span className="text-gray-400">{(c.centrality * 100).toFixed(0)}%</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-xs text-gray-500">ギャップ</span>
                    <p className="text-sm font-bold text-cyan-400">+{(c.recognition_gap * 100).toFixed(0)}%</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-20 text-gray-600 text-sm">
              {oversight === undefined ? '読み込み中...' : '見落とし候補なし'}
            </div>
          )}
        </div>
      </div>

      {/* Unresolved */}
      <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4">未解決の質問</h2>
        {unresolved && unresolved.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left border-b border-gray-800">
                  <th className="pb-2 font-medium pr-4">投稿者</th>
                  <th className="pb-2 font-medium">内容</th>
                  <th className="pb-2 font-medium pl-4 text-right whitespace-nowrap">日時</th>
                </tr>
              </thead>
              <tbody>
                {unresolved.map((q) => (
                  <tr key={q.id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                    <td className="py-2.5 pr-4 text-gray-300 whitespace-nowrap font-medium">{q.author}</td>
                    <td className="py-2.5 pr-4 text-gray-400 truncate max-w-xs">{q.content}</td>
                    <td className="py-2.5 text-gray-600 whitespace-nowrap text-xs text-right pl-4">
                      {new Date(q.created_at).toLocaleDateString('ja-JP')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600 text-sm py-4 text-center">未解決の質問はありません</p>
        )}
      </div>
    </div>
  )
}
