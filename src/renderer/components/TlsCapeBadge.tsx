import type { LoaderType } from '@shared/types'
import { findTlsCapeArtifact } from '@shared/tlskincape'
import { cn } from '../lib/utils'
import { Badge } from './ui/primitives'

/**
 * Shows whether Newbie can place TLauncher's TLSkinCape mod for this exact
 * loader + Minecraft version combination.
 */
export function TlsCapeBadge({
  loader,
  versionId,
  short = false,
  className
}: {
  loader: LoaderType
  versionId: string | undefined | null
  short?: boolean
  className?: string
}) {
  const artifact = findTlsCapeArtifact(loader, versionId)
  const title = artifact
    ? `TLSkinCape ${artifact.modVersion} is available for ${loader} ${versionId}`
    : loader === 'fabric' || loader === 'forge'
      ? `No TLSkinCape build for ${loader} ${versionId ?? 'this version'}`
      : `TLSkinCape requires Fabric or Forge — ${loader} is not supported`
  return (
    <span title={title} className="inline-flex">
      <Badge
        tone={artifact ? 'green' : 'neutral'}
        className={cn('h-5 px-1.5 text-[8.5px]', !artifact && 'text-muted/60', className)}
      >
        {artifact ? (short ? 'TL' : 'TL skin') : short ? 'No TL' : 'No TL skin'}
      </Badge>
    </span>
  )
}
