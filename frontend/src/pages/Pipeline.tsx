/**
 * Pipeline visualization — graphical walkthrough of the analysis algorithm.
 * Shows the full Phase 1→2Fast→2Slow→Gemini→3→4→Output flow with real run stats.
 */
import { useQuery } from '@tanstack/react-query'
import {
  MessageSquare, Zap, BrainCircuit, Sparkles, Link2,
  BarChart3, TrendingUp, CheckCircle2, XCircle, ArrowRight,
  GitBranch, Clock, Layers, Hash,
} from 'lucide-react'
import { analyzeApi } from '../api/client'
import type { AnalysisRun } from '../api/client'

// ── Flow connector ────────────────────────────────────────────────────────────

function FlowLine({ color = '#5865F2', delay = '0s' }: { color?: string; delay?: string }) {
  return (
    <div className="flex justify-center my-1">
      <div className="relative w-0.5 h-10 bg-gray-800 overflow-hidden">
        <div
          className="absolute w-full h-6 animate-flow-down rounded-full"
          style={{
            background: `linear-gradient(to bottom, transparent, ${color}, transparent)`,
            animationDelay: delay,
          }}
        />
      </div>
    </div>
  )
}

// ── Threshold badge ───────────────────────────────────────────────────────────

function ThresholdRow({
  threshold, label, color, icon: Icon,
}: { threshold: string; label: string; color: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon size={11} style={{ color }} />
      <span className="font-mono text-gray-300">{threshold}</span>
      <ArrowRight size={9} className="text-gray-600" />
      <span style={{ color }}>{label}</span>
    </div>
  )
}

// ── Formula line ──────────────────────────────────────────────────────────────

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-xs text-gray-300 bg-gray-950/60 rounded-lg px-3 py-2 border border-gray-800/60 leading-relaxed">
      {children}
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs" style={{ background: `${color}18`, border: `1px solid ${color}40` }}>
      <span className="font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-gray-500">{label}</span>
    </div>
  )
}

// ── Phase card ────────────────────────────────────────────────────────────────

function PhaseCard({
  phase, title, subtitle, color, icon: Icon, children, stats, delay = '0ms',
}: {
  phase: string
  title: string
  subtitle: string
  color: string
  icon: React.ElementType
  children: React.ReactNode
  stats?: React.ReactNode
  delay?: string
}) {
  return (
    <div
      className="rounded-xl border bg-gray-900/80 backdrop-blur overflow-hidden animate-fade-in-up"
      style={{ borderColor: `${color}40`, animationDelay: delay }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: `${color}25`, background: `${color}0d` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
            <Icon size={14} style={{ color }} />
          </div>
          <div>
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color }}>{phase}</span>
            <p className="text-white text-sm font-semibold leading-tight">{title}</p>
          </div>
        </div>
        {stats && <div className="flex items-center gap-2">{stats}</div>}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        <p className="text-xs text-gray-500">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}

// ── Branch box ────────────────────────────────────────────────────────────────

function BranchBox({
  label, note, color, icon: Icon,
}: { label: string; note: string; color: string; icon: React.ElementType }) {
  return (
    <div
      className="flex-1 rounded-lg px-3 py-2 border text-center"
      style={{ borderColor: `${color}40`, background: `${color}0d` }}
    >
      <Icon size={13} style={{ color }} className="mx-auto mb-1" />
      <p className="text-xs font-semibold" style={{ color }}>{label}</p>
      <p className="text-xs text-gray-600 mt-0.5">{note}</p>
    </div>
  )
}

// ── Axis radar mini ───────────────────────────────────────────────────────────

const AXES = ['育成', '橋渡し', '多様性', '双方向', '持続性', '応答性']
const AXIS_COLORS = ['#06B6D4', '#5865F2', '#EC4899', '#F97316', '#10B981', '#14B8A6']

function AxisGrid() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {AXES.map((ax, i) => (
        <div
          key={ax}
          className="rounded-lg px-3 py-2 border text-center"
          style={{ borderColor: `${AXIS_COLORS[i]}40`, background: `${AXIS_COLORS[i]}0d` }}
        >
          <p className="text-xs font-semibold" style={{ color: AXIS_COLORS[i] }}>{ax}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Pipeline() {
  const { data: runs } = useQuery({
    queryKey: ['analyze-runs'],
    queryFn: () => analyzeApi.runs().then(r => r.data),
  })

  const latest: AnalysisRun | undefined = runs?.[0]
  const total = latest?.messages_total ?? 0
  const fast  = latest?.fast_count ?? 0
  const slow  = latest?.slow_count ?? 0
  const gem   = latest?.gemini_count ?? 0

  return (
    <div className="min-h-full bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto">

        {/* ── Header ── */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl font-bold text-white mb-1">アルゴリズムパイプライン</h1>
          <p className="text-gray-500 text-sm">Discord チャットから「誰が誰を助けたか」を検出する分析フロー</p>
          {latest && latest.status === 'done' && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-gray-600">直近の実行結果</span>
              <StatPill label="メッセージ" value={total.toLocaleString()} color="#5865F2" />
              <StatPill label="Fast確定"   value={fast}                   color="#10B981" />
              <StatPill label="Slow通過"   value={slow}                   color="#8B5CF6" />
              <StatPill label="Gemini判定" value={gem}                    color="#F59E0B" />
            </div>
          )}
        </div>

        {/* ── Entry point ── */}
        <div className="flex justify-center mb-1 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-700 bg-gray-900 text-sm text-gray-300">
            <MessageSquare size={13} className="text-gray-400" />
            Discord メッセージ
            {total > 0 && <span className="ml-1 text-xs text-gray-600">({total.toLocaleString()} 件)</span>}
          </div>
        </div>

        <FlowLine color="#3B82F6" />

        {/* ── Phase 1 ── */}
        <PhaseCard
          phase="Phase 1"
          title="ルート分類"
          subtitle="メッセージを種類ごとに振り分け、未解決の質問には OpenSocket（チケット）を発行する"
          color="#3B82F6"
          icon={GitBranch}
          delay="100ms"
        >
          <div className="grid grid-cols-3 gap-2">
            <BranchBox label="直接返信" note="reference_id あり → 即確定 0.70" color="#10B981" icon={CheckCircle2} />
            <BranchBox label="@メンション" note="相手が明確 → 即確定 0.70" color="#10B981" icon={Hash} />
            <BranchBox label="質問検出" note="OpenSocket 発行 → Phase 2 へ" color="#3B82F6" icon={MessageSquare} />
          </div>
          <Formula>
            {'Stage 1: 正規表現  (？/ か？ / どうすれば / 教えてください …)\n'}
            {'Stage 2: GiNZA 形態素解析  (疑問詞 / 文末助詞 / 疑問パターン)'}
          </Formula>
        </PhaseCard>

        <FlowLine color="#10B981" delay="0.3s" />

        {/* ── Phase 2 Fast ── */}
        <PhaseCard
          phase="Phase 2  Fast Route"
          title="形態素解析による QA ペア検出"
          subtitle="OpenSocket の質問に対し、同チャンネルの後続メッセージ最大5件を形態素解析でスコアリングする"
          color="#10B981"
          icon={Zap}
          delay="200ms"
          stats={fast > 0 ? <StatPill label="確定" value={fast} color="#10B981" /> : undefined}
        >
          <Formula>
            {'Score = 0.30 × 応答開始語\n'}
            {'      + 0.30 × 固有表現重複（NER Jaccard）\n'}
            {'      + 0.25 × モダリティ対称性（疑問文↔断定文）\n'}
            {'      + 0.15 × 共参照スコア'}
          </Formula>
          <div className="space-y-1.5">
            <ThresholdRow threshold="≥ 0.65" label="確定 → Phase 3"           color="#10B981" icon={CheckCircle2} />
            <ThresholdRow threshold="0.40~"  label="モダリティ補正 → 再判定"  color="#F59E0B" icon={ArrowRight}   />
            <ThresholdRow threshold="< 0.40" label="Slow Route へ"            color="#8B5CF6" icon={BrainCircuit} />
          </div>
        </PhaseCard>

        <FlowLine color="#8B5CF6" delay="0.6s" />

        {/* ── Phase 2 Slow ── */}
        <PhaseCard
          phase="Phase 2  Slow Route"
          title="埋め込みベクトルによる精密 QA 検出"
          subtitle="Gemini Embedding API で 768 次元ベクトル化し、4つのスコアを合成して判定する"
          color="#8B5CF6"
          icon={BrainCircuit}
          delay="300ms"
          stats={slow > 0 ? <StatPill label="通過" value={slow} color="#8B5CF6" /> : undefined}
        >
          {/* CCA explanation */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2.5 space-y-2">
            <p className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
              <Layers size={11} /> CCA（正準相関分析）
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              直前 5 件のコンテキスト群と返信メッセージを CCA で射影し、<br />
              最大相関方向でのコサイン類似度をスコア化
            </p>
          </div>

          {/* Kalman explanation */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2.5 space-y-1">
            <p className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
              <TrendingUp size={11} /> カルマンフィルタ（トピックシフト検出）
            </p>
            <p className="text-xs text-gray-500">
              チャンネルごとに話題ベクトルをトラッキング。マハラノビス距離 &gt; 5.0 で「話題変化」と判定し時間減衰を半減
            </p>
          </div>

          <Formula>
            {'S = 0.35 × S_CCA\n'}
            {'  + 0.25 × S_diff  (差分ベクトル方向)\n'}
            {'  + 0.25 × S_bilinear  (双線形スコア)\n'}
            {'  + 0.15 × e^(−λt)  × カルマン補正'}
          </Formula>
          <div className="space-y-1.5">
            <ThresholdRow threshold="≥ 0.80" label="確定 → Phase 3"    color="#10B981" icon={CheckCircle2} />
            <ThresholdRow threshold="0.60~"  label="Gemini API へ"     color="#F59E0B" icon={Sparkles}    />
            <ThresholdRow threshold="< 0.60" label="別話題（エッジなし）" color="#EF4444" icon={XCircle}    />
          </div>
        </PhaseCard>

        <FlowLine color="#F59E0B" delay="0.9s" />

        {/* ── Gemini ── */}
        <PhaseCard
          phase="Gemini API"
          title="グレーゾーン最終判定"
          subtitle="スコアが 0.60〜0.79 の判断困難なペアのみ LLM に最終判断を委ねる"
          color="#F59E0B"
          icon={Sparkles}
          delay="400ms"
          stats={gem > 0 ? <StatPill label="判定" value={gem} color="#F59E0B" /> : undefined}
        >
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 space-y-1">
            <p className="text-xs text-gray-400 font-mono">model: gemini-2.0-flash  |  temperature: 0.0</p>
            <p className="text-xs text-gray-300 italic">
              「このメッセージは質問と回答の対応関係にありますか？ true / false のみ返答」
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Clock size={11} />
            <span>レート制限: 1 req/s  |  指数バックオフ: 2s → 4s → 8s  |  最大 3 回リトライ</span>
          </div>
        </PhaseCard>

        <FlowLine color="#06B6D4" delay="1.2s" />

        {/* ── Phase 3 ── */}
        <PhaseCard
          phase="Phase 3"
          title="エッジ構築"
          subtitle="Fast / Slow / Gemini の結果を統合し、有向グラフの辺（誰が誰を助けたか）を生成する"
          color="#06B6D4"
          icon={Link2}
          delay="500ms"
        >
          <Formula>
            {'weight = confidence × bonus\n\n'}
            {'bonus  = 1.0 + 0.1 × 感謝系リアクション数  （上限 1.5×）\n'}
            {'感謝系: 🙏 ✅ 👍 🎉 ❤️  など'}
          </Formula>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
              <p className="text-gray-300 font-medium mb-0.5">感謝メッセージ検出</p>
              <p>「ありがとう / 解決しました / thx」→ 直前の返答者を自動でエッジ化（weight 0.7）</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
              <p className="text-gray-300 font-medium mb-0.5">タイムアウト処理</p>
              <p>48h 未解決の OpenSocket → timeout に変更し未解決カウントを加算</p>
            </div>
          </div>
        </PhaseCard>

        <FlowLine color="#6366F1" delay="1.5s" />

        {/* ── Phase 4 ── */}
        <PhaseCard
          phase="Phase 4"
          title="グラフ解析・スコア算出"
          subtitle="NetworkX の有向グラフで媒介中心性を計算し、メンバーごとの貢献スコアを確定する"
          color="#6366F1"
          icon={BarChart3}
          delay="600ms"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5">
              <p className="text-xs font-semibold text-indigo-400 mb-1">媒介中心性</p>
              <p className="text-xs text-gray-500">「自分を経由しないと繋がれないノードペアの割合」<br />情報ハブ度を 0〜1 で表す</p>
            </div>
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5">
              <p className="text-xs font-semibold text-indigo-400 mb-1">専門性スコア</p>
              <p className="text-xs text-gray-500">解決メッセージを K-Means でクラスタリング<br />シャノンエントロピーの逆数 = 専門特化度</p>
            </div>
          </div>
          <Formula>
            {'Contribution = 0.35 × 媒介中心性\n'}
            {'             + 0.25 × 感謝率\n'}
            {'             + 0.20 × リアクション密度\n'}
            {'             + 0.20 × 解決数（正規化）'}
          </Formula>
        </PhaseCard>

        <FlowLine color="#F59E0B" delay="1.8s" />

        {/* ── Output ── */}
        <PhaseCard
          phase="OUTPUT"
          title="評価係数・関係性指数"
          subtitle="チャット分析の最終出力。マネージャーの評価補助・報酬算定の参考値として使う"
          color="#F59E0B"
          icon={TrendingUp}
          delay="700ms"
        >
          {/* Coefficient */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-400 mb-0.5">コミュニケーション係数</p>
              <Formula>{'0.8 + 加重平均スコア × 0.4'}</Formula>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-amber-400 tabular-nums">×1.2</p>
              <p className="text-xs text-gray-600">範囲: 0.8 〜 1.2</p>
            </div>
          </div>

          {/* 6-axis */}
          <div>
            <p className="text-xs text-gray-500 mb-2">6 軸 関係性指数</p>
            <AxisGrid />
          </div>
        </PhaseCard>

        <div className="mt-8 mb-2 text-center text-xs text-gray-700">
          CBReview  —  Powered by Gemini Embedding · NetworkX · GiNZA · Kalman Filter
        </div>
      </div>
    </div>
  )
}
