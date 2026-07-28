interface Props {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: string
}

export function EmptyState({ title, description, action, icon = '—' }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
      <div className="w-14 h-14 border border-overlay/10 flex items-center justify-center mb-5 clip-corner-sm">
        <span className="text-steel-gray text-xl">{icon}</span>
      </div>
      <h3 className="text-off-white font-display text-lg mb-2">{title}</h3>
      {description && (
        <p className="text-steel-gray text-sm max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
