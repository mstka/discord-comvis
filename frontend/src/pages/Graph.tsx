import { useQuery } from '@tanstack/react-query'
import { graphApi } from '../api/client'
import { useGraphStore } from '../store/graphStore'
import GraphCanvas from '../components/GraphCanvas'
import FilterPanel from '../components/FilterPanel'
import NodeDetail from '../components/NodeDetail'

export default function Graph() {
  const { filters } = useGraphStore()

  const { data: nodesData, isLoading: loadingNodes } = useQuery({
    queryKey: ['graph-nodes', filters.minWeight],
    queryFn: () => graphApi.nodes().then((r) => r.data),
    refetchInterval: 60_000,
  })

  const { data: edgesData, isLoading: loadingEdges } = useQuery({
    queryKey: ['graph-edges', filters.minWeight, filters.edgeTypes, filters.channelId],
    queryFn: () =>
      graphApi.edges({ min_weight: filters.minWeight }).then((r) => r.data),
    refetchInterval: 60_000,
  })

  const nodes = nodesData?.nodes ?? []
  const edges = edgesData?.edges ?? []
  const isLoading = loadingNodes || loadingEdges

  return (
    <div className="flex h-full">
      <FilterPanel />

      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 z-20">
            <div className="text-gray-400 text-sm">グラフデータ読み込み中...</div>
          </div>
        )}

        {!isLoading && nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-2">
            <p className="text-lg">データがありません</p>
            <p className="text-sm">まず「分析実行」ページでパイプラインを実行してください</p>
          </div>
        )}

        <GraphCanvas nodes={nodes} edges={edges} />
        <NodeDetail />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-gray-900/90 border border-gray-800 rounded-lg p-3 text-xs space-y-1.5">
          <p className="text-gray-400 font-medium mb-1.5">凡例</p>
          {[
            { color: '#5865F2', label: 'メインエッジ（Fast/直接返信）' },
            { color: '#0891b2', label: 'サブエッジ（会話分岐）' },
            { color: '#059669', label: '全体補足・スレッド' },
            { color: '#d97706', label: '感謝エッジ' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-4 h-0.5 rounded" style={{ background: color }} />
              <span className="text-gray-400">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-1">
            <div className="w-3 h-3 rounded-full bg-discord-blurple" />
            <span className="text-gray-400">ノードサイズ = 媒介中心性</span>
          </div>
        </div>

        {/* Stats */}
        <div className="absolute top-4 left-4 bg-gray-900/90 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-400">
          {nodes.length} ノード　{edges.length} エッジ
        </div>
      </div>
    </div>
  )
}
