import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { User, ExternalLink, MessageCircle, Brain, GitMerge, Award, Sprout } from 'lucide-react'
import { membersApi, evaluationApi, type MemberSummary } from '../api/client'
import { Tooltip } from '../components/Tooltip'

const TYPE_ICONS: Record<string, React.ElementType> = {
  '相談対応': MessageCircle,
  '高認知負荷な応答': Brain,
  '橋渡し': GitMerge,
  '論点整理': Award,
  '育成支援': Sprout,
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <Tooltip term={label}>{label}</Tooltip>
        <span className="text-gray-300 font-medium tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-discord-blurple to-purple-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function MemberCard({ member, selected, onClick }: { member: MemberSummary; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-all ${
        selected
          ? 'bg-discord-blurple/15 border border-discord-blurple/40'
          : 'bg-gray-800/50 border border-transparent hover:border-gray-700 hover:bg-gray-800'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
          {member.avatar_url ? (
            <img src={member.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
          ) : (
            <User size={15} className="text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{member.display_name}</p>
          <p className="text-xs text-gray-500">{member.resolved_count}件対応</p>
        </div>
        <p className="text-xs font-bold text-discord-blurple shrink-0 tabular-nums">
          {(member.contribution_score * 100).toFixed(0)}%
        </p>
      </div>
    </button>
  )
}

export default function MemberView() {
  const { memberId: paramId } = useParams<{ memberId?: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(paramId ?? null)

  const { data: members } = useQuery({
    queryKey: ['members-list'],
    queryFn: () => membersApi.list().then(r => r.data),
  })

  const selectedMember = members?.find(m => m.member_id === selectedId)

  const { data: contribTypes } = useQuery({
    queryKey: ['contrib-types', selectedId],
    queryFn: () => membersApi.contributionTypes(selectedId!).then(r => r.data),
    enabled: !!selectedId,
  })

  const { data: report } = useQuery({
    queryKey: ['eval-report', selectedId],
    queryFn: () => evaluationApi.report(selectedId!).then(r => r.data),
    enabled: !!selectedId,
  })

  const filtered = (members ?? []).filter(m =>
    m.display_name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (id: string) => {
    setSelectedId(id)
    navigate(`/member/${id}`, { replace: true })
  }

  return (
    <div className="flex h-full">
      {/* Member list */}
      <div className="w-72 border-r border-gray-800/60 bg-gray-950 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-800/60">
          <h2 className="text-sm font-bold text-white mb-3">メンバー一覧</h2>
          <input
            type="text"
            placeholder="名前で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-discord-blurple"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {filtered.length === 0 && (
            <p className="text-gray-600 text-xs text-center py-8">
              {members === undefined ? '読み込み中...' : '分析を実行するとメンバーが表示されます'}
            </p>
          )}
          {filtered.map(m => (
            <MemberCard
              key={m.member_id}
              member={m}
              selected={m.member_id === selectedId}
              onClick={() => handleSelect(m.member_id)}
            />
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedMember ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-600">
            <User size={40} className="mb-3 opacity-20" />
            <p className="text-sm font-medium text-gray-500">メンバーを選択してください</p>
            <p className="text-xs text-gray-600 mt-1">左のリストから選択すると貢献候補が表示されます</p>
          </div>
        ) : (
          <div className="max-w-3xl space-y-5">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center shrink-0">
                {selectedMember.avatar_url ? (
                  <img src={selectedMember.avatar_url} className="w-12 h-12 rounded-xl object-cover" alt="" />
                ) : (
                  <User size={20} className="text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-white">{selectedMember.display_name}</h1>
                <p className="text-gray-500 text-sm mt-0.5">今月の認知貢献候補</p>
              </div>
              <div className="flex gap-3">
                <div className="text-center px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500 mb-0.5">
                    <Tooltip term="貢献スコア">貢献スコア</Tooltip>
                  </p>
                  <p className="text-xl font-bold text-discord-blurple tabular-nums">
                    {(selectedMember.contribution_score * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-center px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500 mb-0.5">
                    <Tooltip term="解決件数">解決件数</Tooltip>
                  </p>
                  <p className="text-xl font-bold text-discord-green tabular-nums">
                    {selectedMember.resolved_count}
                  </p>
                </div>
              </div>
            </div>

            {/* 貢献タイプ */}
            <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-5">
              <h2 className="font-semibold mb-4 text-white text-sm">貢献タイプ別内訳</h2>
              {contribTypes && contribTypes.types.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {contribTypes.types.map(t => {
                    const Icon = TYPE_ICONS[t.type] ?? Award
                    const pct = Math.round(t.score * 100)
                    return (
                      <div key={t.type} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/40">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon size={13} className="text-gray-400 shrink-0" />
                          <Tooltip term={t.type}>
                            <span className="font-medium text-sm text-white">{t.type}</span>
                          </Tooltip>
                          {t.count !== null && (
                            <span className="ml-auto text-xs text-gray-500 tabular-nums">{t.count}件</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1.5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-discord-blurple to-purple-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500">{t.description}</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-gray-600 text-sm">NodeScoreが未計算です。分析パイプラインを実行してください。</p>
              )}
            </div>

            {/* 3軸スコア */}
            {report && (
              <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-5">
                <h2 className="font-semibold mb-4 text-white text-sm">3軸スコア</h2>
                <div className="space-y-3">
                  {(['認知貢献', '関係性貢献', '未来投資貢献'] as const).map(key => (
                    <ScoreBar key={key} label={key} value={report.scores[key] ?? 0} />
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                  <Tooltip term="賞与参考係数">
                    <span className="text-sm text-gray-400">賞与参考係数</span>
                  </Tooltip>
                  <span className="text-xl font-bold text-discord-yellow tabular-nums">
                    {report.coefficient.toFixed(2)}x
                  </span>
                </div>
              </div>
            )}

            {/* 評価コメント草案 */}
            {report && (
              <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-5">
                <h2 className="font-semibold mb-3 text-white text-sm">
                  <Tooltip term="評価補助レポート">評価コメント草案</Tooltip>
                </h2>
                <div className="bg-gray-800/60 rounded-lg p-4 text-sm text-gray-300 leading-relaxed border-l-2 border-discord-blurple">
                  {report.draft_evaluation_comment}
                </div>
                <p className="text-xs text-gray-600 mt-2">マネージャーが内容を確認・編集してください</p>
              </div>
            )}

            <button
              onClick={() => navigate('/manager')}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl text-gray-400 hover:text-white text-sm transition-colors"
            >
              <ExternalLink size={13} />
              マネージャー評価画面を開く
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
