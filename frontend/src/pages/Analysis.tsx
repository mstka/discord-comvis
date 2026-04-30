import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyzeApi, collectApi, createWS } from '../api/client'
import { useAnalysisStore } from '../store/analysisStore'

const PHASE_LABELS: Record<string, string> = {
  '1': 'Phase 1: ルート分類',
  '2_fast': 'Phase 2 Fast: 形態素解析',
  '2_slow': 'Phase 2 Slow: ベクトル解析',
  '2.5': 'Phase 2.5: スレッドターゲット判定',
  '3': 'Phase 3: エッジ構築',
  '4': 'Phase 4: グラフ計算',
}

function StepBadge({ n, active }: { n: number; active: boolean }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${active ? 'bg-discord-blurple text-white' : 'bg-gray-800 text-gray-500'}`}>
      {n}
    </div>
  )
}

function PhaseRow({ phaseKey, status, label }: { phaseKey: string; status?: string; label: string }) {
  const icon = status === 'done' ? '✓' : status === 'running' ? '⟳' : status === 'error' ? '✗' : '○'
  const color = status === 'done' ? 'text-discord-green' : status === 'running' ? 'text-discord-yellow' : status === 'error' ? 'text-discord-red' : 'text-gray-600'
  return (
    <div className={`flex items-center gap-3 py-1.5 ${!status || status === 'pending' ? 'opacity-40' : ''}`}>
      <span className={`font-mono text-sm w-4 text-center ${color} ${status === 'running' ? 'animate-spin' : ''}`}>{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
  )
}

export default function Analysis() {
  const { runId, status, phases, guildId, setRunId, setGuildId, setStatus, updatePhase, reset } = useAnalysisStore()
  const wsCollectRef = useRef<WebSocket | null>(null)
  const wsAnalyzeRef = useRef<WebSocket | null>(null)

  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [collectStatus, setCollectStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [collectProgress, setCollectProgress] = useState<{ done: number; total: number | null }>({ done: 0, total: null })
  const [log, setLog] = useState<string[]>([])

  const { data: guilds } = useQuery({
    queryKey: ['guilds'],
    queryFn: () => collectApi.guilds().then(r => r.data),
  })

  const { data: channels } = useQuery({
    queryKey: ['channels', guildId],
    queryFn: () => collectApi.channels(guildId).then(r => r.data),
    enabled: !!guildId,
  })

  const { data: runs } = useQuery({
    queryKey: ['runs'],
    queryFn: () => analyzeApi.runs().then(r => r.data),
    refetchInterval: 10_000,
  })

  useEffect(() => () => {
    wsCollectRef.current?.close()
    wsAnalyzeRef.current?.close()
  }, [])

  const addLog = (line: string) =>
    setLog(prev => [...prev.slice(-79), `${new Date().toLocaleTimeString()} ${line}`])

  // ── Step 1: Collect messages ──────────────────────────────────────────────
  const startCollect = async () => {
    if (!selectedChannels.length) return
    setCollectStatus('running')
    setCollectProgress({ done: 0, total: null })

    wsCollectRef.current?.close()
    const ws = createWS('/ws/collect', (data: unknown) => {
      const msg = data as Record<string, unknown>
      if (msg.type === 'progress') {
        setCollectProgress(prev => ({ done: (prev.done || 0) + 1, total: msg.total as number | null }))
      } else if (msg.type === 'channel_done') {
        addLog(`チャンネル完了: ${msg.done} 件取得`)
      } else if (msg.type === 'done') {
        setCollectStatus('done')
        addLog('全チャンネル収集完了')
      } else if (msg.type === 'error') {
        setCollectStatus('error')
        addLog(`収集エラー: ${msg.message}`)
      }
    })
    wsCollectRef.current = ws

    for (const chId of selectedChannels) {
      try {
        await collectApi.fetch({ channel_id: chId })
        addLog(`チャンネル ${chId} 取得開始`)
      } catch (e) {
        addLog(`チャンネル ${chId} 取得失敗`)
      }
    }
  }

  // ── Step 2: Run analysis pipeline ────────────────────────────────────────
  const startAnalysis = async () => {
    if (!guildId) return
    reset()
    setStatus('running')
    const res = await analyzeApi.run(guildId)
    const id = res.data.run_id
    setRunId(id)
    addLog(`分析開始 run_id=${id}`)

    wsAnalyzeRef.current?.close()
    const ws = createWS(`/ws/analyze?run_id=${id}`, (data: unknown) => {
      const msg = data as Record<string, unknown>
      if (msg.type === 'done') {
        setStatus('done')
        addLog('分析完了')
      } else if (msg.type === 'error') {
        setStatus('error')
        addLog(`分析エラー: ${msg.message}`)
      } else if (msg.phase !== undefined) {
        updatePhase({ phase: String(msg.phase), status: msg.status as 'running' | 'done' | 'error', label: (msg.label as string) ?? '' })
      }
    })
    wsAnalyzeRef.current = ws
  }

  const toggleChannel = (id: string) =>
    setSelectedChannels(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])

  const collectDone = collectStatus === 'done'
  const collectPct = collectProgress.total ? Math.round(collectProgress.done / collectProgress.total * 100) : null

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">分析実行</h1>

      {/* ── Step 1: サーバー・チャンネル選択 ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-3">
          <StepBadge n={1} active={true} />
          <h2 className="font-semibold">メッセージ収集</h2>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">対象サーバー</label>
          <select
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
            value={guildId}
            onChange={e => { setGuildId(e.target.value); setSelectedChannels([]) }}
          >
            <option value="">— サーバーを選択 —</option>
            {guilds?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        {channels && channels.length > 0 && (
          <div>
            <label className="text-xs text-gray-400 block mb-2">取得チャンネル（複数選択可）</label>
            <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-800 rounded p-2">
              {channels.map((ch: { id: string; name: string }) => (
                <label key={ch.id} className="flex items-center gap-2 text-sm text-gray-300 px-2 py-1 rounded hover:bg-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes(ch.id)}
                    onChange={() => toggleChannel(ch.id)}
                    className="accent-discord-blurple"
                  />
                  # {ch.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">{selectedChannels.length} チャンネル選択中</p>
          </div>
        )}

        {collectStatus === 'running' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>収集中...</span>
              <span>{collectProgress.done} 件{collectPct !== null ? ` (${collectPct}%)` : ''}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-discord-blurple rounded-full transition-all" style={{ width: collectPct !== null ? `${collectPct}%` : '30%', animation: collectPct === null ? 'pulse 1.5s infinite' : 'none' }} />
            </div>
          </div>
        )}

        {collectStatus === 'done' && (
          <p className="text-discord-green text-sm">✓ 収集完了 — {collectProgress.done} 件取得</p>
        )}
        {collectStatus === 'error' && (
          <p className="text-discord-red text-sm">✗ 収集エラー（ログを確認）</p>
        )}

        <button
          onClick={startCollect}
          disabled={!selectedChannels.length || collectStatus === 'running'}
          className="px-5 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded font-medium text-sm transition-colors"
        >
          {collectStatus === 'running' ? '収集中...' : collectStatus === 'done' ? '再収集' : 'メッセージ取得'}
        </button>
      </div>

      {/* ── Step 2: パイプライン実行 ── */}
      <div className={`bg-gray-900 border rounded-lg p-5 space-y-4 transition-opacity ${collectDone ? 'border-gray-800 opacity-100' : 'border-gray-800 opacity-50 pointer-events-none'}`}>
        <div className="flex items-center gap-3">
          <StepBadge n={2} active={collectDone} />
          <h2 className="font-semibold">分析パイプライン実行</h2>
        </div>

        {!collectDone && <p className="text-xs text-gray-500">先にStep 1でメッセージを収集してください</p>}

        <button
          onClick={startAnalysis}
          disabled={!guildId || status === 'running' || !collectDone}
          className="px-5 py-2 bg-discord-blurple hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded font-medium text-sm transition-colors"
        >
          {status === 'running' ? '実行中...' : 'パイプライン実行'}
        </button>

        {(status !== 'idle' || phases.length > 0) && (
          <div className="border-t border-gray-800 pt-4 divide-y divide-gray-800/60">
            {Object.entries(PHASE_LABELS).map(([key, label]) => {
              const phase = phases.find(p => String(p.phase) === key)
              return <PhaseRow key={key} phaseKey={key} status={phase?.status} label={label} />
            })}
          </div>
        )}

        {status === 'done' && (
          <div className="p-3 bg-discord-green/10 border border-discord-green/30 rounded text-discord-green text-sm font-medium">
            分析完了！「グラフ」ページで結果を確認してください。
          </div>
        )}
        {status === 'error' && (
          <div className="p-3 bg-red-900/30 border border-red-800 rounded text-discord-red text-sm">
            エラーが発生しました。ログを確認してください。
          </div>
        )}
      </div>

      {/* 実行履歴 */}
      {runs && runs.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h2 className="font-semibold mb-3">実行履歴</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-800">
                <th className="pb-2 font-medium">ID</th>
                <th className="pb-2 font-medium">状態</th>
                <th className="pb-2 font-medium">開始</th>
                <th className="pb-2 font-medium">メッセージ</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.id} className="border-b border-gray-800/50">
                  <td className="py-2 text-gray-400">#{r.id}</td>
                  <td className={`py-2 font-medium ${r.status === 'done' ? 'text-discord-green' : r.status === 'error' ? 'text-discord-red' : 'text-discord-yellow'}`}>{r.status}</td>
                  <td className="py-2 text-gray-400 text-xs">{new Date(r.started_at).toLocaleString('ja-JP')}</td>
                  <td className="py-2 text-gray-400">{r.messages_total ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ログ */}
      {log.length > 0 && (
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-2 font-mono">ログ</p>
          <div className="font-mono text-xs text-gray-400 space-y-0.5 max-h-40 overflow-y-auto">
            {log.map((l, i) => <p key={i}>{l}</p>)}
          </div>
        </div>
      )}
    </div>
  )
}
