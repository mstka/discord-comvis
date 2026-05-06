import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('comvis-auth')
    if (raw) {
      const { state } = JSON.parse(raw)
      if (state?.token) {
        config.headers['Authorization'] = `Bearer ${state.token}`
      }
    }
  } catch { /* ignore */ }
  return config
})

// Redirect to /login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('comvis-auth')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Types ──────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  contribution_score: number
  centrality: number
  avg_sentiment: number
  reaction_density: number
  expertise_score: number
  resolved_count: number
  asked_count: number
  unresolved_count: number
}

export interface GraphEdge {
  id: number
  source: string
  target: string
  value: number
  weight: number
  edge_type: string
  channel_id: string
  timestamp: string
  route: string
  confidence: number
}

export interface AnalysisRun {
  id: number
  status: string
  started_at: string
  finished_at: string | null
  messages_total: number | null
  messages_done: number
  fast_count: number
  slow_count: number
  gemini_count: number
  error_message: string | null
}

export interface RankingEntry {
  rank: number
  member_id: string
  display_name: string
  contribution_score: number
  resolved_count: number
  centrality: number
}

export interface UnresolvedQuestion {
  id: number
  author: string
  content: string
  channel_id: string
  created_at: string
}

export interface KPIs {
  total_messages: number
  total_edges: number
  resolved_ratio: number
  active_contributors: number
}

export interface MemberSummary {
  member_id: string
  display_name: string
  avatar_url: string | null
  contribution_score: number
  centrality: number
  resolved_count: number
  expertise_score: number
  avg_sentiment: number
  reaction_density: number
}

export interface RiskMember {
  member_id: string
  display_name: string
  resolved_count: number
  avg_resolved: number
  load_ratio: number
  centrality: number
  risk_level: 'high' | 'medium'
}

export interface OversightCandidate {
  member_id: string
  display_name: string
  contribution_score: number
  centrality: number
  resolved_count: number
  recognition_gap: number
}

export interface ContributionType {
  type: string
  icon: string
  score: number
  count: number | null
  description: string
}

export interface RelationshipAxes {
  育成指数: number
  橋渡し指数: number
  関係の多様性: number
  双方向率: number
  持続性: number
  応答性: number
}

export interface RelationshipAxesResult {
  member_id: string
  display_name: string
  axes: RelationshipAxes
  overall_relationship_score: number
  descriptions: Record<string, string>
}

export interface EvaluationReport {
  member_id: string
  display_name: string
  period: string
  summary: {
    total_resolved: number
    recent_resolved: number
    edges_asked: number
    contribution_score: number
    centrality: number
  }
  contribution_types: { type: string; icon?: string; count?: number; score?: number }[]
  scores: Record<string, number>
  coefficient: number
  relationship_axes: RelationshipAxes
  draft_evaluation_comment: string
  one_on_one_questions: string[]
  manager_checkpoints: { point: string; note: string }[]
}

export interface CoefficientEntry {
  member_id: string
  display_name: string
  scores: Record<string, number>
  coefficient: number
  bonus_ratio: number
}

// ── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (password: string) =>
    api.post<{ token: string; role: 'admin' | 'viewer'; expires_in_hours: number }>('/auth/login', { password }),
  me: () => api.get<{ role: 'admin' | 'viewer' }>('/auth/me'),
}

// ── API helpers ──────────────────────────────────────────────────────────────

export const graphApi = {
  nodes: (params?: object) => api.get<{ nodes: GraphNode[]; total: number }>('/graph/nodes', { params }),
  edges: (params?: object) => api.get<{ edges: GraphEdge[]; total: number }>('/graph/edges', { params }),
  node: (id: string) => api.get(`/graph/node/${id}`),
  stats: () => api.get('/graph/stats'),
}

export const dashboardApi = {
  ranking: (topK = 10) => api.get<RankingEntry[]>('/dashboard/ranking', { params: { top_k: topK } }),
  unresolved: () => api.get<UnresolvedQuestion[]>('/dashboard/unresolved'),
  timeline: (days = 30) => api.get<{ date: string; count: number }[]>('/dashboard/timeline', { params: { days } }),
  kpis: () => api.get<KPIs>('/dashboard/kpis'),
}

export const analyzeApi = {
  run: (guildId: string) => api.post<{ run_id: number }>('/analyze/run', { guild_id: guildId }),
  status: (runId: number) => api.get<AnalysisRun>(`/analyze/status/${runId}`),
  runs: () => api.get<AnalysisRun[]>('/analyze/runs'),
}

export const collectApi = {
  guilds: () => api.get<{ id: string; name: string; icon: string | null }[]>('/collect/guilds'),
  channels: (guildId: string) => api.get(`/collect/guilds/${guildId}/channels`),
  fetch: (params: { channel_id: string; limit?: number }) => api.post('/collect/fetch', params),
  status: () => api.get('/collect/status'),
}

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: object) => api.put('/settings', data),
}

export const evaluationApi = {
  coefficients: () => api.get<CoefficientEntry[]>('/evaluation/coefficients'),
  report: (memberId: string) => api.get<EvaluationReport>(`/evaluation/report/${memberId}`),
  relationshipAxes: (memberId: string) => api.get<RelationshipAxesResult>(`/evaluation/relationship-axes/${memberId}`),
  relationshipAxesAll: () => api.get<RelationshipAxesResult[]>('/evaluation/relationship-axes-all'),
}

export const membersApi = {
  list: () => api.get<MemberSummary[]>('/dashboard/members'),
  riskAnalysis: () => api.get<RiskMember[]>('/dashboard/risk-analysis'),
  oversightCandidates: () => api.get<OversightCandidate[]>('/dashboard/oversight-candidates'),
  contributionTypes: (memberId: string) =>
    api.get<{ types: ContributionType[]; contribution_score: number }>(`/dashboard/contribution-types/${memberId}`),
}

export const healthApi = {
  get: () => api.get<{ bot_ready: boolean; bot_user: string | null; bot_task: string; token_set: boolean }>('/health'),
}

// ── WebSocket factory ─────────────────────────────────────────────────────────

export function createWS(path: string, onMessage: (data: unknown) => void): WebSocket {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/^https?:\/\//, '')
    : window.location.host
  const url = `${proto}//${host}${path}`
  const ws = new WebSocket(url)
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)) } catch { /* ignore */ }
  }
  return ws
}
