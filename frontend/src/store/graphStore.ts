import { create } from 'zustand'
import type { GraphNode, GraphEdge } from '../api/client'

export interface GraphFilters {
  minWeight: number
  edgeTypes: string[]
  channelId: string | null
  highlightHubs: boolean
}

interface GraphState {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedNodeId: string | null
  filters: GraphFilters
  setNodes: (nodes: GraphNode[]) => void
  setEdges: (edges: GraphEdge[]) => void
  setSelectedNode: (id: string | null) => void
  setFilter: <K extends keyof GraphFilters>(key: K, value: GraphFilters[K]) => void
  resetFilters: () => void
}

const DEFAULT_FILTERS: GraphFilters = {
  minWeight: 0,
  edgeTypes: ['main', 'sub', 'distributed', 'thanks'],
  channelId: null,
  highlightHubs: false,
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  filters: DEFAULT_FILTERS,
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
}))
