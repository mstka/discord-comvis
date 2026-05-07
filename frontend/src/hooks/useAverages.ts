/**
 * useAverages — 全メンバーの平均スコアを返すカスタムフック
 *
 * - 3軸スコア・係数・貢献スコア・解決件数: バックエンド /evaluation/averages から取得
 * - 6軸関係性指数: /evaluation/relationship-axes-all をフロントで集計
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { evaluationApi, type FullAverages, type RelationshipAxes } from '../api/client'

const AXIS_KEYS: (keyof RelationshipAxes)[] = [
  '育成指数', '橋渡し指数', '関係の多様性', '双方向率', '持続性', '応答性',
]

export function useAverages(): FullAverages | undefined {
  const { data: avgs } = useQuery({
    queryKey: ['score-averages'],
    queryFn: () => evaluationApi.averages().then(r => r.data),
    staleTime: 60_000,
  })

  const { data: axesAll } = useQuery({
    queryKey: ['relationship-axes-all'],
    queryFn: () => evaluationApi.relationshipAxesAll().then(r => r.data),
    staleTime: 60_000,
  })

  return useMemo(() => {
    if (!avgs) return undefined

    const relAxes: RelationshipAxes = {
      育成指数: 0, 橋渡し指数: 0, 関係の多様性: 0, 双方向率: 0, 持続性: 0, 応答性: 0,
    }
    if (axesAll && axesAll.length > 0) {
      const n = axesAll.length
      const sums = Object.fromEntries(AXIS_KEYS.map(k => [k, 0])) as Record<string, number>
      for (const entry of axesAll) {
        for (const k of AXIS_KEYS) sums[k] += entry.axes[k] ?? 0
      }
      for (const k of AXIS_KEYS) relAxes[k] = Math.round(sums[k] / n * 1000) / 1000
    }

    return { ...avgs, relationship_axes: relAxes }
  }, [avgs, axesAll])
}

/** 値が平均より高いか低いかを示すラベル */
export function deltaLabel(value: number, avg: number, unit = 'pts'): string {
  const d = Math.round((value - avg) * 100)
  if (d === 0) return '平均並み'
  return `${d > 0 ? '+' : ''}${d} ${unit}`
}
