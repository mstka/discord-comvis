/**
 * Member PDF Report — generated client-side with @react-pdf/renderer.
 *
 * Design: clean dark-on-white professional layout
 * Sections:
 *   1. Header (name, period, coefficient)
 *   2. 3-axis contribution radar summary (bar representation)
 *   3. 6-axis relationship index (radar bars)
 *   4. Key stats table
 *   5. Draft evaluation comment
 *   6. 1on1 question checklist
 *   7. Manager checkpoints
 */
import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer'
import type { EvaluationReport, RelationshipAxes, FullAverages } from '../api/client'

// ── Japanese font registration ────────────────────────────────────────────────
// Font files are committed to src/assets/fonts/ as static OTF (non-variable).
// Vite bundles them as hashed assets at build time — no CDN or nginx path
// dependency at runtime. The ?url suffix gives the browser-resolvable URL.
import regularFontUrl from '../assets/fonts/NotoSansJP-Regular.otf?url'
import boldFontUrl    from '../assets/fonts/NotoSansJP-Bold.otf?url'

Font.register({
  family: 'NotoSansJP',
  fonts: [
    { src: regularFontUrl, fontWeight: 'normal' },
    { src: boldFontUrl,    fontWeight: 'bold'   },
  ],
})

// Suppress hyphenation (not applicable to Japanese)
Font.registerHyphenationCallback((word) => [word])

// ── styles ────────────────────────────────────────────────────────────────────

const C = {
  primary: '#5865F2',
  dark: '#111827',
  mid: '#374151',
  muted: '#6B7280',
  light: '#F9FAFB',
  white: '#FFFFFF',
  accent1: '#10B981',  // green – cognitive
  accent2: '#8B5CF6',  // purple – relational
  accent3: '#F59E0B',  // amber – future
  border: '#E5E7EB',
} as const

const FONT = 'NotoSansJP'

const s = StyleSheet.create({
  page: { backgroundColor: C.white, padding: 40, fontFamily: FONT },

  // header
  headerBand: { backgroundColor: C.primary, borderRadius: 8, padding: '18 20', marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerLeft: {},
  headerTitle: { color: C.white, fontSize: 18, fontFamily: FONT, fontWeight: 'bold', marginBottom: 3 },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 9 },
  headerRight: { alignItems: 'flex-end' },
  coeffLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 8, marginBottom: 2 },
  coeffValue: { color: C.white, fontSize: 26, fontFamily: FONT, fontWeight: 'bold' },
  coeffSuffix: { color: 'rgba(255,255,255,0.75)', fontSize: 10 },

  // section
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 9, fontFamily: FONT, fontWeight: 'bold', color: C.muted, marginBottom: 8, letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: C.border, marginBottom: 12 },

  // row
  row2: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  card: { flex: 1, backgroundColor: C.light, borderRadius: 6, padding: 12 },
  cardLabel: { fontSize: 8, color: C.muted, marginBottom: 2 },
  cardValue: { fontSize: 18, fontFamily: FONT, fontWeight: 'bold', color: C.dark },

  // axis bar
  axisRow: { marginBottom: 6 },
  axisHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  axisLabel: { fontSize: 8.5, color: C.mid },
  axisScore: { fontSize: 8.5, fontFamily: FONT, fontWeight: 'bold', color: C.dark },
  barBg: { height: 6, backgroundColor: C.border, borderRadius: 3 },
  barFill: { height: 6, borderRadius: 3 },

  // table
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 6 },
  tableHeader: { backgroundColor: C.light, borderRadius: 4 },
  tableCell: { fontSize: 8.5 },
  tableCellL: { flex: 2, fontSize: 8.5, color: C.dark },
  tableCellR: { flex: 3, fontSize: 8.5, color: C.muted },

  // text blocks
  comment: { fontSize: 9, color: C.mid, lineHeight: 1.6, backgroundColor: '#EFF6FF', borderLeftWidth: 3, borderLeftColor: C.primary, padding: '8 10', borderRadius: 4 },
  checkItem: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  bullet: { width: 14, height: 14, borderWidth: 1.5, borderColor: C.muted, borderRadius: 2, marginTop: 2 },
  checkText: { flex: 1, fontSize: 8.5, color: C.mid, lineHeight: 1.6 },
  qItem: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  qBullet: { fontSize: 8.5, color: C.primary, fontFamily: FONT, fontWeight: 'bold' },
  qText: { flex: 1, fontSize: 8.5, color: C.mid, lineHeight: 1.5 },

  // footer
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.muted },
})

// ── sub-components ────────────────────────────────────────────────────────────

function AxisBar({ label, value, avg, color }: { label: string; value: number; avg?: number; color: string }) {
  const score = Math.round(value * 100)
  const avgScore = avg !== undefined ? Math.round(avg * 100) : null
  const delta = avgScore !== null ? score - avgScore : null
  const pct = `${score}%`

  return (
    <View style={s.axisRow}>
      <View style={s.axisHeader}>
        <Text style={s.axisLabel}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {delta !== null && (
            <Text style={{ fontSize: 7, color: delta >= 0 ? '#10B981' : '#EF4444' }}>
              {delta >= 0 ? '▲' : '▼'}{Math.abs(delta)} vs 平均
            </Text>
          )}
          {avgScore !== null && (
            <Text style={{ fontSize: 7, color: '#9CA3AF' }}>平均{avgScore}</Text>
          )}
          <Text style={s.axisScore}>{score}</Text>
        </View>
      </View>
      <View style={[s.barBg, { position: 'relative' }]}>
        <View style={[s.barFill, { width: pct, backgroundColor: color }]} />
        {avgScore !== null && (
          <View style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${avgScore}%`, width: 1.5,
            backgroundColor: 'rgba(255,255,255,0.4)',
          }} />
        )}
      </View>
    </View>
  )
}

const AXIS_COLORS: Record<string, string> = {
  '認知貢献': C.accent1,
  '関係性貢献': C.accent2,
  '未来投資貢献': C.accent3,
  '育成指数': '#06B6D4',
  '橋渡し指数': C.primary,
  '関係の多様性': '#EC4899',
  '双方向率': '#F97316',
  '持続性': C.accent1,
  '応答性': '#14B8A6',
}

// ── document ──────────────────────────────────────────────────────────────────

function ReportDocument({ report, axes, averages }: { report: EvaluationReport; axes: RelationshipAxes; averages?: FullAverages }) {
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  const avgCoeff = averages?.coefficient
  const coeffDelta = avgCoeff !== undefined ? report.coefficient - avgCoeff : null

  return (
    <Document title={`${report.display_name} 評価補助レポート`}>
      <Page size="A4" style={s.page}>

        {/* ── HEADER ── */}
        <View style={s.headerBand}>
          <View style={s.headerLeft}>
            <Text style={s.headerTitle}>{report.display_name}</Text>
            <Text style={s.headerSub}>評価補助レポート　{report.period}　生成日: {today}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.coeffLabel}>コミュニケーション係数</Text>
            <Text style={s.coeffValue}>{report.coefficient.toFixed(2)}<Text style={s.coeffSuffix}>x</Text></Text>
            {avgCoeff !== undefined && (
              <Text style={{ fontSize: 8, color: coeffDelta! >= 0 ? '#57F287' : '#ED4245', marginTop: 2 }}>
                {coeffDelta! >= 0 ? '▲' : '▼'}{Math.abs(Math.round(coeffDelta! * 100))}pts　平均 {avgCoeff.toFixed(2)}x
              </Text>
            )}
          </View>
        </View>

        {/* ── KEY STATS ── */}
        <View style={s.row2}>
          <View style={s.card}>
            <Text style={s.cardLabel}>解決件数（累計）</Text>
            <Text style={s.cardValue}>{report.summary.total_resolved}</Text>
            {averages && <Text style={{ fontSize: 7, color: C.muted, marginTop: 2 }}>平均 {averages.resolved_count.toFixed(1)}件</Text>}
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>直近30日</Text>
            <Text style={s.cardValue}>{report.summary.recent_resolved}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>貢献スコア</Text>
            <Text style={s.cardValue}>{(report.summary.contribution_score * 100).toFixed(0)}</Text>
            {averages && <Text style={{ fontSize: 7, color: C.muted, marginTop: 2 }}>平均 {(averages.contribution_score * 100).toFixed(0)}%</Text>}
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>中心性</Text>
            <Text style={s.cardValue}>{(report.summary.centrality * 100).toFixed(0)}</Text>
          </View>
        </View>

        {/* ── 3-AXIS ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>3軸　貢献スコア</Text>
          <View style={s.divider} />
          {Object.entries(report.scores).map(([k, v]) => (
            <AxisBar key={k} label={k} value={v} avg={averages?.scores[k]} color={AXIS_COLORS[k] ?? C.primary} />
          ))}
        </View>

        {/* ── 6-AXIS ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>6軸　関係性指数</Text>
          <View style={s.divider} />
          {Object.entries(axes).map(([k, v]) => (
            <AxisBar key={k} label={k} value={v} avg={averages?.relationship_axes?.[k as keyof RelationshipAxes]} color={AXIS_COLORS[k] ?? C.primary} />
          ))}
        </View>

        {/* ── DRAFT COMMENT ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>評価コメント草案</Text>
          <View style={s.divider} />
          <Text style={s.comment}>{report.draft_evaluation_comment}</Text>
        </View>

        {/* ── 1on1 QUESTIONS ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>1on1 確認事項</Text>
          <View style={s.divider} />
          {report.one_on_one_questions.map((q, i) => (
            <View key={i} style={s.qItem}>
              <Text style={s.qBullet}>Q{i + 1}</Text>
              <Text style={s.qText}>{q}</Text>
            </View>
          ))}
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>CBReview — このレポートはチャット分析に基づく補助資料です</Text>
          <Text style={s.footerText}>{today}</Text>
        </View>
      </Page>
    </Document>
  )
}

// ── download helper ───────────────────────────────────────────────────────────

export async function downloadMemberPDF(report: EvaluationReport, axes: RelationshipAxes, averages?: FullAverages) {
  const blob = await pdf(<ReportDocument report={report} axes={axes} averages={averages} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${report.display_name}_評価レポート.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
