import { create } from 'zustand'

interface PhaseProgress {
  phase: string | number
  status: 'pending' | 'running' | 'done' | 'error'
  label?: string
  count?: number
}

interface AnalysisState {
  runId: number | null
  status: 'idle' | 'running' | 'done' | 'error'
  phases: PhaseProgress[]
  guildId: string
  setRunId: (id: number) => void
  setGuildId: (id: string) => void
  setStatus: (s: AnalysisState['status']) => void
  updatePhase: (update: PhaseProgress) => void
  reset: () => void
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  runId: null,
  status: 'idle',
  phases: [],
  guildId: '',
  setRunId: (id) => set({ runId: id }),
  setGuildId: (id) => set({ guildId: id }),
  setStatus: (status) => set({ status }),
  updatePhase: (update) =>
    set((s) => {
      const existing = s.phases.findIndex((p) => String(p.phase) === String(update.phase))
      if (existing >= 0) {
        const phases = [...s.phases]
        phases[existing] = { ...phases[existing], ...update }
        return { phases }
      }
      return { phases: [...s.phases, update] }
    }),
  reset: () => set({ runId: null, status: 'idle', phases: [] }),
}))
