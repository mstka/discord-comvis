import { Info } from 'lucide-react'

/** 用語解説ツールチップ */
export const GLOSSARY: Record<string, string> = {
  '認知貢献':
    '他のメンバーの質問に回答・解決した実績から算出。専門知識の活用度と解決件数を組み合わせたスコアです。',
  '関係性貢献':
    'チーム内での情報の橋渡し役としての機能度。会話ネットワークの中心性とコミュニケーションの質から算出します。',
  '未来投資貢献':
    '他のメンバーからのリアクション密度で推定する影響力・知見の波及度の指標です。',
  '賞与参考係数':
    'チャット上で測定可能な3軸（認知・関係性・未来投資）の加重平均から算出した係数です（0.8x〜1.2x）。成果物・売上貢献は含みません。',
  '負荷集中リスク':
    'チーム平均の1.5倍以上の対応を担っているメンバーを検出します。継続するとバーンアウトや離職リスクが高まります。',
  '評価見落とし候補':
    '貢献スコアは高いが、コミュニケーションの可視性（中心性）が低いメンバーです。静かに支えている存在が評価に入りにくい状況を示します。',
  '媒介中心性':
    '情報がどれだけ自分を経由して流れているかを示す指標。値が高いほどチームの情報ハブとして機能しています。',
  '相談対応':
    '他のメンバーの質問・相談に対して回答した件数から算出します。',
  '高認知負荷な応答':
    '専門知識や複雑な判断を要する質問への対応実績です。',
  '橋渡し':
    '異なるグループや話題をつなぐ結節点としての役割。ネットワーク上の中心性から導出されます。',
  '論点整理':
    '複数の会話の流れをまとめ、議論を整理する役割の度合いです。',
  '育成支援':
    '他のメンバーへのポジティブな対応を通じた成長支援の度合いです。',
  '貢献スコア':
    '認知・関係性・未来投資の3軸を加重平均した総合スコアです（0〜1）。',
  '解決件数':
    '分析パイプラインが「回答として有効」と判定したメッセージの数です。',
  '評価補助レポート':
    'AIが抽出した貢献候補をまとめたレポートです。内容の正確性はマネージャーが判断してください。',
}

interface TooltipProps {
  term: string
  children?: React.ReactNode
  showIcon?: boolean
}

/** 用語にカーソルを合わせると説明が表示されるコンポーネント */
export function Tooltip({ term, children, showIcon = true }: TooltipProps) {
  const description = GLOSSARY[term]
  if (!description) return <>{children ?? term}</>

  return (
    <span className="relative group inline-flex items-center gap-1 cursor-help">
      <span className="border-b border-dashed border-gray-500 leading-snug">
        {children ?? term}
      </span>
      {showIcon && (
        <Info size={11} className="text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
      )}
      {/* Tooltip card */}
      <span className="
        pointer-events-none absolute z-50
        bottom-full left-0 mb-2
        w-64 p-3
        bg-gray-800 border border-gray-700 rounded-lg
        text-xs text-gray-300 leading-relaxed
        shadow-xl
        opacity-0 group-hover:opacity-100
        transition-opacity duration-150
      ">
        <span className="block font-medium text-white mb-1">{term}</span>
        {description}
      </span>
    </span>
  )
}
