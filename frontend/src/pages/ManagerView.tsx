import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
} from 'recharts'
import {
  ClipboardList, AlertTriangle, Eye, Award, CheckSquare,
  ChevronDown, ChevronUp, User, FileText, Download, Loader2,
} from 'lucide-react'
import { membersApi, evaluationApi, type EvaluationReport, type RelationshipAxes } from '../api/client'
import { Tooltip } from '../components/Tooltip'

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
        active
          ? 'bg-discord-blurple/15 text-discord-blurple border border-discord-blurple/30'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
      }`}
    >
      {label}
    </button>
  )
}

function CheckItem({ point, note, done, onToggle }: { point: string; note: string; done: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-800/30 transition-colors">
      <button
        onClick={onToggle}
        className={`mt-0.5 w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors ${
          done ? 'bg-discord-green border-discord-green' : 'border-gray-600 hover:border-gray-400'
        }`}
      >
        {done && <CheckSquare size={12} className="text-gray-950" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'line-through text-gray-500' : 'text-white'}`}>{point}</p>
        <p className="text-xs text-gray-500 mt-0.5">{note}</p>
      </div>
    </div>
  )
}

// ── Axis bar display ──────────────────────────────────────────────────────────

const AXIS_COLORS: Record<string, string> = {
  '育成指数': '#06B6D4',
  '橋渡し指数': '#5865F2',
  '関係の多様性': '#EC4899',
  '双方向率': '#F97316',
  '持続性': '#10B981',
  '応答性': '#14B8A6',
}
const AXIS_DESCRIPTIONS: Record<string, string> = {
  '育成指数': '支援した相手がその後他者を助けた割合',
  '橋渡し指数': '複数チャンネルにまたがる関与度',
  '関係の多様性': '交流した相手の多様さ',
  '双方向率': '互いにやり取りした相手の割合',
  '持続性': '貢献が時間的に分散している安定度',
  '応答性': '質問への返答速度（中央値ベース）',
}

function AxisBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const color = AXIS_COLORS[label] ?? '#5865F2'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <Tooltip term={label}><span className="text-gray-300">{label}</span></Tooltip>
        <span className="font-medium text-white">{pct}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ── Report card ───────────────────────────────────────────────────────────────

function ReportCard({ report }: { report: EvaluationReport }) {
  const [expanded, setExpanded] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [pdfLoading, setPdfLoading] = useState(false)

  const toggle = (point: string) => setChecked(prev => ({ ...prev, [point]: !prev[point] }))

  const radarData = Object.entries(report.scores).map(([key, val]) => ({
    axis: key.replace('貢献', ''),
    score: Math.round(val * 100),
  }))

  const axes6 = report.relationship_axes as RelationshipAxes | undefined

  const handlePDF = async () => {
    setPdfLoading(true)
    try {
      const { downloadMemberPDF } = await import('../components/MemberPDFReport')
      await downloadMemberPDF(report, axes6 ?? {
        育成指数: 0, 橋渡し指数: 0, 関係の多様性: 0, 双方向率: 0, 持続性: 0, 応答性: 0,
      })
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800/80 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
          <User size={18} className="text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white">{report.display_name}</h3>
          <p className="text-xs text-gray-500">
            {report.period} · 解決 {report.summary.total_resolved}件 · 直近30日 {report.summary.recent_resolved}件
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-xs text-gray-500">係数</p>
            <p className="font-bold text-discord-yellow">{report.coefficient.toFixed(2)}x</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">貢献</p>
            <p className="font-bold text-discord-blurple">{(report.summary.contribution_score * 100).toFixed(0)}%</p>
          </div>
          {/* PDF download */}
          <button
            onClick={handlePDF}
            disabled={pdfLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
          >
            {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            PDF
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-800 p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Radar chart — 3 axes */}
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">3軸スコア</p>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Radar dataKey="score" stroke="#5865F2" fill="#5865F2" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* 6-axis bars */}
            {axes6 && (
              <div>
                <p className="text-xs text-gray-500 mb-3 font-medium">6軸 関係性指数</p>
                <div className="space-y-3">
                  {Object.entries(axes6).map(([k, v]) => (
                    <AxisBar key={k} label={k} value={v} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Draft comment */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium flex items-center gap-1">
              <FileText size={12} />
              評価コメント草案
            </p>
            <div className="bg-gray-800/60 rounded-lg p-4 text-sm text-gray-300 leading-relaxed border-l-2 border-discord-blurple">
              {report.draft_evaluation_comment}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Manager checkpoints */}
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">評価確認チェックリスト</p>
              <div className="space-y-1">
                {report.manager_checkpoints.map(cp => (
                  <CheckItem
                    key={cp.point}
                    point={cp.point}
                    note={cp.note}
                    done={!!checked[cp.point]}
                    onToggle={() => toggle(cp.point)}
                  />
                ))}
              </div>
            </div>

            {/* 1on1 questions */}
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">1on1で確認すべき質問</p>
              <div className="space-y-1.5">
                {report.one_on_one_questions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-400">
                    <span className="shrink-0 mt-0.5 text-discord-blurple font-mono text-xs">Q{i + 1}.</span>
                    <span>{q}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Coefficients tab ──────────────────────────────────────────────────────────

const AXIS_LABELS: Record<string, string> = {
  '認知貢献': '認知',
  '関係性貢献': '関係性',
  '未来投資貢献': '未来',
}

function CoefficientsTab() {
  const { data } = useQuery({
    queryKey: ['coefficients'],
    queryFn: () => evaluationApi.coefficients().then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-5">
        <h3 className="font-semibold text-white mb-1">Phase 5: 給与・賞与反映係数</h3>
        <p className="text-xs text-gray-500 mb-4">3軸スコアから算出した賞与参考係数（0.8x〜1.2x）</p>

        {!data || data.length === 0 ? (
          <p className="text-gray-600 text-sm py-8 text-center">分析を実行してください</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
              <BarChart data={data} layout="vertical" margin={{ left: 90, right: 20 }}>
                <XAxis type="number" domain={[0.7, 1.3]} tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={v => `${v.toFixed(1)}x`} />
                <YAxis type="category" dataKey="display_name" tick={{ fill: '#9ca3af', fontSize: 11 }} width={88} />
                <RechartsTooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(v: number) => [`${v.toFixed(3)}x`, '係数']}
                />
                <Bar dataKey="coefficient" fill="#5865F2" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    <th className="pb-2 text-left font-medium">メンバー</th>
                    {Object.keys(AXIS_LABELS).map(k => (
                      <th key={k} className="pb-2 text-center font-medium">
                        <Tooltip term={k}>{AXIS_LABELS[k]}</Tooltip>
                      </th>
                    ))}
                    <th className="pb-2 text-right font-medium">
                      <Tooltip term="賞与参考係数">係数</Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(row => (
                    <tr key={row.member_id} className="border-b border-gray-800/40">
                      <td className="py-2.5 text-white font-medium">{row.display_name}</td>
                      {Object.keys(AXIS_LABELS).map(k => (
                        <td key={k} className="py-2.5 text-center text-gray-400 text-xs">
                          {(row.scores[k] * 100).toFixed(0)}%
                        </td>
                      ))}
                      <td className="py-2.5 text-right font-bold text-discord-yellow">{row.coefficient.toFixed(2)}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-600 mt-3">
              ※ 係数はコミュニケーション分析による補助指標です。売上・成果物などの業績評価は別途組み合わせてください。
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Evaluation tab ────────────────────────────────────────────────────────────

function EvaluationTab() {
  const { data: members } = useQuery({
    queryKey: ['members-list'],
    queryFn: () => membersApi.list().then(r => r.data),
  })

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [reports, setReports] = useState<EvaluationReport[]>([])
  const [loading, setLoading] = useState(false)

  const generateReports = async () => {
    if (!selectedIds.length) return
    setLoading(true)
    try {
      const results = await Promise.all(
        selectedIds.map(id => evaluationApi.report(id).then(r => r.data))
      )
      setReports(results)
    } finally {
      setLoading(false)
    }
  }

  const toggleMember = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div className="space-y-5">
      <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-5">
        <h3 className="font-semibold text-white mb-1">Phase 4: 月次評価補助レポート</h3>
        <p className="text-xs text-gray-500 mb-4">レポートを生成するメンバーを選択してください（PDFダウンロード可）</p>

        {members && members.length > 0 ? (
          <>
            <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-800 rounded-lg p-2 mb-4">
              {members.map(m => (
                <label key={m.member_id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-gray-800/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.member_id)}
                    onChange={() => toggleMember(m.member_id)}
                    className="accent-discord-blurple"
                  />
                  <span className="text-sm text-gray-300">{m.display_name}</span>
                  <span className="ml-auto text-xs text-gray-500">{m.resolved_count}件</span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedIds(members.map(m => m.member_id))} className="text-xs text-gray-400 hover:text-white">全選択</button>
              <button onClick={() => setSelectedIds([])} className="text-xs text-gray-400 hover:text-white">クリア</button>
              <button
                onClick={generateReports}
                disabled={!selectedIds.length || loading}
                className="ml-auto px-4 py-2 bg-discord-blurple hover:bg-indigo-500 disabled:opacity-40 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? '生成中...' : `レポート生成 (${selectedIds.length}人)`}
              </button>
            </div>
          </>
        ) : (
          <p className="text-gray-600 text-sm py-4 text-center">分析を実行するとメンバーが表示されます</p>
        )}
      </div>

      {reports.map(r => (
        <ReportCard key={r.member_id} report={r} />
      ))}
    </div>
  )
}

// ── Risk tab ──────────────────────────────────────────────────────────────────

function RiskTab() {
  const navigate = useNavigate()
  const { data: risks } = useQuery({ queryKey: ['risk-analysis'], queryFn: () => membersApi.riskAnalysis().then(r => r.data) })
  const { data: oversight } = useQuery({ queryKey: ['oversight'], queryFn: () => membersApi.oversightCandidates().then(r => r.data) })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-5">
        <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
          <AlertTriangle size={15} className="text-amber-400" />
          <Tooltip term="負荷集中リスク">負荷集中リスク</Tooltip>
        </h3>
        <p className="text-xs text-gray-500 mb-4">平均1.5倍以上の対応を担うメンバー</p>
        {risks && risks.length > 0 ? (
          <div className="space-y-3">
            {risks.map(r => (
              <div key={r.member_id} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => navigate(`/member/${r.member_id}`)} className="font-medium text-sm text-white hover:text-discord-blurple">{r.display_name}</button>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.risk_level === 'high' ? 'bg-red-950 text-red-400 border border-red-800/40' : 'bg-amber-950 text-amber-400 border border-amber-800/40'}`}>
                    {r.risk_level === 'high' ? '高リスク' : '中リスク'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between"><span>対応件数</span><span className="text-white">{r.resolved_count}件</span></div>
                  <div className="flex justify-between"><span>負荷倍率</span><span className={r.risk_level === 'high' ? 'text-red-400' : 'text-amber-400'}>{r.load_ratio}x</span></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm py-6 text-center">負荷集中なし</p>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-5">
        <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
          <Eye size={15} className="text-cyan-400" />
          <Tooltip term="評価見落とし候補">評価見落とし候補</Tooltip>
        </h3>
        <p className="text-xs text-gray-500 mb-4">貢献度が高いが可視性が低いメンバー</p>
        {oversight && oversight.length > 0 ? (
          <div className="space-y-3">
            {oversight.map(c => (
              <div key={c.member_id} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => navigate(`/member/${c.member_id}`)} className="font-medium text-sm text-white hover:text-discord-blurple">{c.display_name}</button>
                  <span className="text-xs text-cyan-400 font-bold">+{(c.recognition_gap * 100).toFixed(0)}%</span>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between"><span>貢献スコア</span><span className="text-white">{(c.contribution_score * 100).toFixed(0)}%</span></div>
                  <div className="flex justify-between"><span>可視性</span><span className="text-gray-400">{(c.centrality * 100).toFixed(0)}%</span></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm py-6 text-center">見落とし候補なし</p>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ManagerView() {
  const [activeTab, setActiveTab] = useState<'evaluation' | 'risk' | 'coefficients'>('evaluation')

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ClipboardList size={22} className="text-discord-blurple" />
          マネージャー評価補助
        </h1>
        <p className="text-gray-400 text-sm mt-1">コミュニケーション分析による貢献の可視化と評価サポート</p>
      </div>

      <div className="bg-discord-blurple/10 border border-discord-blurple/20 rounded-xl p-4 text-sm text-gray-300">
        <p className="font-medium text-white mb-2">マネージャーの確認観点</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-xs text-gray-400">
          {['本当に評価に入れるべきか', '通常業務の範囲内か', '期待値を超えているか',
            '負荷が偏っていないか', '本人の成長・役割と合っているか', '事業成果との関連があるか'].map(p => (
            <div key={p} className="flex items-center gap-1">
              <Award size={10} className="text-discord-blurple shrink-0" />
              <span>{p}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-800 pb-3">
        <Tab label="評価補助レポート" active={activeTab === 'evaluation'} onClick={() => setActiveTab('evaluation')} />
        <Tab label="リスク分析" active={activeTab === 'risk'} onClick={() => setActiveTab('risk')} />
        <Tab label="給与係数" active={activeTab === 'coefficients'} onClick={() => setActiveTab('coefficients')} />
      </div>

      {activeTab === 'evaluation' && <EvaluationTab />}
      {activeTab === 'risk' && <RiskTab />}
      {activeTab === 'coefficients' && <CoefficientsTab />}
    </div>
  )
}
