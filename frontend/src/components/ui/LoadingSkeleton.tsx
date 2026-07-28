interface Props { rows?: number; className?: string }

export function LoadingSkeleton({ rows = 4, className = '' }: Props) {
  return (
    <div className={`space-y-2 animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 bg-overlay/[0.03]"
          style={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  )
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`goat-card-angular animate-pulse space-y-3 ${className}`}>
      <div className="h-2.5 bg-overlay/[0.05] w-20 rounded-none" />
      <div className="h-8 bg-overlay/[0.05] w-14 rounded-none" />
    </div>
  )
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-overlay/5 animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 pr-4">
          <div className="h-3 bg-overlay/[0.05] rounded-none" style={{ width: `${60 + Math.random() * 30}%` }} />
        </td>
      ))}
    </tr>
  )
}
