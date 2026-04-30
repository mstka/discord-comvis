import { useGraphStore } from '../store/graphStore'

const EDGE_TYPES = [
  { value: 'main', label: 'メイン（直接返信）' },
  { value: 'sub', label: 'サブ（会話分岐）' },
  { value: 'distributed', label: '全体補足' },
  { value: 'thanks', label: '感謝' },
]

export default function FilterPanel() {
  const { filters, setFilter, resetFilters } = useGraphStore()

  const toggleEdgeType = (type: string) => {
    const current = filters.edgeTypes
    if (current.includes(type)) {
      setFilter('edgeTypes', current.filter((t) => t !== type))
    } else {
      setFilter('edgeTypes', [...current, type])
    }
  }

  return (
    <div className="w-56 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-5 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">フィルター</h3>
        <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-white transition-colors">
          リセット
        </button>
      </div>

      {/* Min weight slider */}
      <div>
        <label className="text-xs text-gray-400 block mb-2">
          最小エッジ重み: <span className="text-white">{filters.minWeight.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min={0} max={1} step={0.05}
          value={filters.minWeight}
          onChange={(e) => setFilter('minWeight', parseFloat(e.target.value))}
          className="w-full accent-discord-blurple"
        />
      </div>

      {/* Edge type checkboxes */}
      <div>
        <p className="text-xs text-gray-400 mb-2">エッジ種別</p>
        {EDGE_TYPES.map(({ value, label }) => (
          <label key={value} className="flex items-center gap-2 text-sm text-gray-300 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.edgeTypes.includes(value)}
              onChange={() => toggleEdgeType(value)}
              className="accent-discord-blurple"
            />
            {label}
          </label>
        ))}
      </div>

      {/* Highlight hubs */}
      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.highlightHubs}
          onChange={(e) => setFilter('highlightHubs', e.target.checked)}
          className="accent-discord-blurple"
        />
        情報ハブを強調
      </label>
    </div>
  )
}
