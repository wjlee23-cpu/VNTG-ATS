export function VNTGSymbol({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-2 ${className || ''}`}
      style={{ fontFamily: 'Roboto, sans-serif' }}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded bg-[#0248FF] text-white font-bold text-sm">
        V
      </div>
      <span className="font-bold text-lg text-[#08102B]" style={{ fontFamily: 'Roboto, sans-serif' }}>
        VNTG
      </span>
    </div>
  )
}
