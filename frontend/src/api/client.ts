import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

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

// ── WebSocket factory ─────────────────────────────────────────────────────────

export function createWS(path: string, onMessage: (data: unknown) => void): WebSocket {
  const url = `ws://127.0.0.1:8000${path}`
  const ws = new WebSocket(url)
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)) } catch { /* ignore */ }
  }
  return ws
}
