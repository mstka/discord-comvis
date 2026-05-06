import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Bot, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/client'

export default function Login() {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data } = await authApi.login(password)
      login(data.token, data.role)
      navigate('/', { replace: true })
    } catch {
      setError('パスワードが違います')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-discord-blurple flex items-center justify-center mb-4 shadow-lg shadow-discord-blurple/30">
            <Bot size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">ComVis</h1>
          <p className="text-gray-500 text-sm mt-1">Discord コミュニケーション分析</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-5">
            <Lock size={16} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-300">アクセスパスワードを入力</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="パスワード"
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-discord-blurple focus:ring-1 focus:ring-discord-blurple pr-10"
              />
              <button
                type="button"
                onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-xs flex items-center gap-1.5">
                <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-discord-blurple hover:bg-discord-blurple/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  確認中...
                </>
              ) : (
                'ログイン'
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-gray-800">
            <p className="text-gray-600 text-xs text-center leading-relaxed">
              閲覧のみ: 閲覧用パスワードを入力<br />
              管理操作: 管理者パスワードを入力
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
