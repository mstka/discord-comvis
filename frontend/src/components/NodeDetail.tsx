import { useQuery } from '@tanstack/react-query'
import { graphApi } from '../api/client'
import { useGraphStore } from '../store/graphStore'

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-discord-blurple rounded-full" style={{ width: `${value * 100}%` }} />
        </div>
        <span className="text-white w-10 text-right">{value.toFixed(2)}</span>
      </div>
    </div>
  )
}

export default function NodeDetail() {
  const { selectedNodeId, setSelectedNode } = useGraphStore()

  const { data: node } = useQuery({
    queryKey: ['node', selectedNodeId],
    queryFn: () => graphApi.node(selectedNodeId!).then(r => r.data),
    enabled: !!selectedNodeId,
  })

  if (!selectedNodeId) return null

  return (
    <div className="absolute top-4 right-4 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-5 z-10">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {node?.avatar_url ? (
            <img src={node.avatar_url} className="w-10 h-10 rounded-full" alt="" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-discord-blurple flex items-center justify-center text-white font-bold">
              {(node?.display_name || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-white">{node?.display_name}</p>
            <p className="text-xs text-gray-500">@{node?.username}</p>
          </div>
        </div>
        <button onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
      </div>

      {node?.score && (
        <div className="space-y-2 mb-4">
          <ScoreRow label="総合貢献スコア" value={node.score.contribution_score} />
          <ScoreRow label="媒介中心性" value={node.score.centrality} />
          <ScoreRow label="感謝率" value={node.score.avg_sentiment} />
          <ScoreRow label="リアクション密度" value={node.score.reaction_density} />
          <ScoreRow label="専門性" value={node.score.expertise_score} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
        <div className="bg-gray-800 rounded p-2">
          <p className="text-discord-green font-bold text-lg">{node?.score?.resolved_count ?? 0}</p>
          <p className="text-gray-400">解決</p>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <p className="text-discord-yellow font-bold text-lg">{node?.score?.asked_count ?? 0}</p>
          <p className="text-gray-400">質問</p>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <p className="text-discord-red font-bold text-lg">{node?.score?.unresolved_count ?? 0}</p>
          <p className="text-gray-400">未解決</p>
        </div>
      </div>

      {node?.helped && node.helped.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">サポートした相手 Top 5</p>
          {node.helped.slice(0, 5).map((e: { target: string; weight: number }, i: number) => (
            <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-800/50">
              <span className="text-gray-300 truncate">{e.target}</span>
              <span className="text-gray-500 ml-2">{e.weight.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
