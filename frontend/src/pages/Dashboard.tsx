import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import { dashboardApi } from '../api/client'

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const { data: kpis } = useQuery({ queryKey: ['kpis'], queryFn: () => dashboardApi.kpis().then(r => r.data), refetchInterval: 30_000 })
  const { data: ranking } = useQuery({ queryKey: ['ranking'], queryFn: () => dashboardApi.ranking().then(r => r.data), refetchInterval: 30_000 })
  const { data: timeline } = useQuery({ queryKey: ['timeline'], queryFn: () => dashboardApi.timeline().then(r => r.data), refetchInterval: 60_000 })
  const { data: unresolved } = useQuery({ queryKey: ['unresolved'], queryFn: () => dashboardApi.unresolved().then(r => r.data) })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="総メッセージ数" value={kpis?.total_messages?.toLocaleString() ?? '—'} />
        <StatCard label="エッジ数" value={kpis?.total_edges?.toLocaleString() ?? '—'} />
        <StatCard label="解決率" value={kpis ? `${(kpis.resolved_ratio * 100).toFixed(1)}%` : '—'} />
        <StatCard label="貢献者数" value={kpis?.active_contributors ?? '—'} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contribution ranking bar chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-4">貢献度ランキング Top 10</h2>
          {ranking && ranking.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ranking} layout="vertical" margin={{ left: 80, right: 20 }}>
                <XAxis type="number" domain={[0, 1]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="display_name"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  width={78}
                />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 6 }}
                  labelStyle={{ color: '#f9fafb' }}
                  formatter={(v: number) => [v.toFixed(3), '貢献スコア']}
                />
                <Bar dataKey="contribution_score" fill="#5865F2" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm">データなし</p>
          )}
        </div>

        {/* Timeline line chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-4">コミュニケーション量（直近30日）</h2>
          {timeline && timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timeline} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 6 }}
                  labelStyle={{ color: '#f9fafb' }}
                />
                <Line type="monotone" dataKey="count" stroke="#57F287" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm">データなし</p>
          )}
        </div>
      </div>

      {/* Unresolved questions */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold mb-4">未解決の質問</h2>
        {unresolved && unresolved.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-800">
                <th className="pb-2 font-medium">投稿者</th>
                <th className="pb-2 font-medium">内容</th>
                <th className="pb-2 font-medium">日時</th>
              </tr>
            </thead>
            <tbody>
              {unresolved.map((q) => (
                <tr key={q.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">{q.author}</td>
                  <td className="py-2 pr-4 text-gray-400 truncate max-w-xs">{q.content}</td>
                  <td className="py-2 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(q.created_at).toLocaleDateString('ja-JP')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 text-sm">未解決の質問はありません</p>
        )}
      </div>
    </div>
  )
}
