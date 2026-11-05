import { useState } from 'react'
import { cn, initials } from '../../lib/utils'

export function SkinFace({
  skinUrl,
  name,
  size = 36,
  className
}: {
  skinUrl?: string
  name: string
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const [source, setSource] = useState({ width: 64, height: 64 })
  const scale = size / 8
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-elevated',
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {skinUrl && !failed ? (
        <img
          src={skinUrl}
          alt=""
          draggable={false}
          onLoad={(event) => {
            const image = event.currentTarget
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
              setSource({ width: image.naturalWidth, height: image.naturalHeight })
            }
          }}
          onError={() => setFailed(true)}
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: source.width * scale,
            height: source.height * scale,
            maxWidth: 'none',
            maxHeight: 'none',
            transform: `translate(${-8 * scale}px, ${-8 * scale}px)`,
            imageRendering: 'pixelated'
          }}
        />
      ) : (
        <span className="font-display text-[11px] font-semibold text-grass">{initials(name)}</span>
      )}
    </span>
  )
}

export function ProjectIcon({
  url,
  name,
  size = 40,
  className
}: {
  url?: string
  name: string
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-elevated',
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {url && !failed ? (
        <img
          src={url}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="font-display font-semibold text-muted" style={{ fontSize: size * 0.32 }}>
          {initials(name)}
        </span>
      )}
    </span>
  )
}

export function BlockIcon({
  name,
  color,
  iconUrl,
  size = 48,
  className
}: {
  name: string
  color: string
  iconUrl?: string
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  return (
    <span
      className={cn(
        'block-art relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 shadow-inner',
        className
      )}
      style={{ width: size, height: size, backgroundColor: iconUrl && !failed ? '#1A241B' : color }}
      aria-hidden="true"
    >
      {iconUrl && !failed ? (
        <img
          src={iconUrl}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="font-display font-bold text-[#08120B] drop-shadow-[0_1px_0_rgba(255,255,255,0.18)]"
          style={{ fontSize: size * 0.38 }}
        >
          {initials(name)}
        </span>
      )}
      <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
    </span>
  )
}
