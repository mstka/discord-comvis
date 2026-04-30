interface Props {
  value: number   // 0-100
  label?: string
  color?: string
}

export default function ProgressBar({ value, label, color = 'bg-discord-blurple' }: Props) {
  return (
    <div className="w-full">
      {label && <p className="text-xs text-gray-400 mb-1">{label}</p>}
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}
