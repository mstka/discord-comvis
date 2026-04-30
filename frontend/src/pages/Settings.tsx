import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi, collectApi } from '../api/client'

function Field({ label, name, value, onChange, type = 'text', step }: {
  label: string; name: string; value: string | number; onChange: (v: string) => void
  type?: string; step?: string
}) {
  return (
    <div>
      <label className="text-sm text-gray-400 block mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-discord-blurple"
      />
    </div>
  )
}

export default function Settings() {
  const qc = useQueryClient()
  const { data: current } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get().then(r => r.data) })

  const [form, setForm] = useState<Record<string, string | number>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (current) setForm(current)
  }, [current])

  const mutation = useMutation({
    mutationFn: (data: object) => settingsApi.update(data),
    onSuccess: () => {
      setSaved(true)
      qc.invalidateQueries({ queryKey: ['settings'] })
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const set = (key: string) => (v: string) => setForm((f) => ({ ...f, [key]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(form)
  }

  const [botStatus, setBotStatus] = useState<'unknown' | 'ok' | 'error'>('unknown')
  const testBot = async () => {
    try {
      await collectApi.guilds()
      setBotStatus('ok')
    } catch {
      setBotStatus('error')
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">設定</h1>
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* API Keys */}
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
          <h2 className="font-semibold">APIキー</h2>
          <p className="text-xs text-gray-500">値は .env ファイルに保存されます。変更後はサーバーを再起動してください。</p>

          <div>
            <Field
              label="Discord Bot Token"
              name="discord_bot_token"
              value={form.discord_bot_token ?? ''}
              onChange={set('discord_bot_token')}
              type="password"
            />
            <div className="flex items-center gap-3 mt-2">
              <button type="button" onClick={testBot} className="text-xs text-discord-blurple hover:underline">
                接続テスト
              </button>
              {botStatus === 'ok' && <span className="text-xs text-discord-green">接続OK</span>}
              {botStatus === 'error' && <span className="text-xs text-discord-red">接続失敗</span>}
            </div>
          </div>

          <Field
            label="Gemini API Key"
            name="gemini_api_key"
            value={form.gemini_api_key ?? ''}
            onChange={set('gemini_api_key')}
            type="password"
          />
        </section>

        {/* Slow Route coefficients */}
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
          <h2 className="font-semibold">Slow Route 係数</h2>
          <p className="text-xs text-gray-500">S_slow = α·S_CCA + β·S_diff + γ·S_bilinear + δ·e^(-λΔt)</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="α (CCA重み)" name="slow_alpha" value={form.slow_alpha ?? 0.35} onChange={set('slow_alpha')} type="number" step="0.05" />
            <Field label="β (差分ベクトル)" name="slow_beta" value={form.slow_beta ?? 0.25} onChange={set('slow_beta')} type="number" step="0.05" />
            <Field label="γ (双線形写像)" name="slow_gamma" value={form.slow_gamma ?? 0.25} onChange={set('slow_gamma')} type="number" step="0.05" />
            <Field label="δ (時間減衰)" name="slow_delta" value={form.slow_delta ?? 0.15} onChange={set('slow_delta')} type="number" step="0.05" />
            <Field label="λ デフォルト" name="slow_lambda_default" value={form.slow_lambda_default ?? 0.10} onChange={set('slow_lambda_default')} type="number" step="0.01" />
          </div>
        </section>

        {/* Thresholds */}
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
          <h2 className="font-semibold">閾値設定</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="エッジ信頼度閾値" name="edge_confidence_threshold" value={form.edge_confidence_threshold ?? 0.30} onChange={set('edge_confidence_threshold')} type="number" step="0.05" />
            <Field label="OpenSocketタイムアウト（時間）" name="open_socket_timeout_hours" value={form.open_socket_timeout_hours ?? 48} onChange={set('open_socket_timeout_hours')} type="number" />
          </div>
        </section>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2 bg-discord-blurple hover:bg-indigo-500 disabled:opacity-40 rounded font-medium text-sm transition-colors"
          >
            {mutation.isPending ? '保存中...' : '設定を保存'}
          </button>
          {saved && <span className="text-discord-green text-sm">保存しました</span>}
          {mutation.isError && <span className="text-discord-red text-sm">保存に失敗しました</span>}
        </div>
      </form>
    </div>
  )
}
