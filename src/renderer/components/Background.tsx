export function Background() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="grid-overlay absolute inset-0" />
      <div className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-grass/[0.045] blur-[100px]" />
      <div className="absolute bottom-0 left-1/4 h-[260px] w-[520px] rounded-full bg-gold/[0.03] blur-[110px]" />
      <div className="noise absolute inset-0" />
    </div>
  )
}
