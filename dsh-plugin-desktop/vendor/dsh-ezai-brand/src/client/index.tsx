// EZAI brand occupants for the web client shell slots.
//
// The sidebar declares `sidebar.brand.mark` / `sidebar.brand.name` and the
// blank-session hero declares `conversation.hero.brand.mark`; this plugin
// occupies all three with the repository-owned EZAI artwork (generated from
// dsh-plugin-desktop/build/app-icon.png through build/tray-icon.svg) and the
// 金石易服/EZAI wordmark stack, restoring the pre-0.1.5 desktop presentation:
//
//   expanded sidebar: [EZAI mark, 40px tall] [金石易服 (16px/600)
//                     over EZAI (13px/500, secondary ink)]
//   collapsed rail:   [EZAI mark, 24px square]
//   blank hero:       [EZAI mark, ~47px tall] + host headline

import type { ReactElement } from 'react'
import { EZAI_MARK_DATA_URI } from './artwork.ts'

/** Props supplied by the sidebar brand-mark slot owner. */
interface BrandMarkProps {
  /** Requested square edge in pixels (ignored: the pre-migration desktop
   *  rendered the expanded mark 40px tall regardless of the host ask). */
  size: number
}

/** Props supplied by the conversation hero brand-mark slot owner. */
interface HeroBrandMarkProps extends BrandMarkProps {
  /** Host class preserving the surrounding mark geometry. */
  className?: string | undefined
}

/**
 * Scoped companion stylesheet for the sidebar brand occupant. The expanded
 * brand row and the collapsed rail share one slot with identical owner props,
 * so the rail resize is anchored on the vendored sidebar's rail wrapper
 * class (`_muAxG_railMark`, pinned by the 0.1.5-rc.2 vendored runtime). The
 * brand button height restores the pre-migration 35px row geometry.
 */
const SIDEBAR_MARK_CSS = `
.ezaiBrandMarkImg{display:block;height:40px;width:auto;}
._muAxG_railMark .ezaiBrandMarkImg{height:24px;width:24px;}
._muAxG_brand{height:35px;min-width:0;color:inherit;cursor:pointer;}
`

/**
 * Render the EZAI mark for the sidebar brand row and the collapsed rail.
 * @returns the EZAI artwork image plus its rail-scoped stylesheet.
 */
export function EzaiBrandMark(_props: BrandMarkProps): ReactElement {
  return (
    <>
      <style>{SIDEBAR_MARK_CSS}</style>
      <img
        className="ezaiBrandMarkImg"
        src={EZAI_MARK_DATA_URI}
        alt=""
        aria-hidden="true"
      />
    </>
  )
}

/**
 * Render the EZAI mark inside the blank-session hero headline. The
 * pre-migration hero rendered the artwork 60px wide (~47px tall for the
 * original 3005x2357 artwork); the square re-render keeps that presence.
 * @param props - Host-supplied mark presentation.
 * @returns the EZAI artwork image (decorative brand art).
 */
export function EzaiHeroBrandMark({ className }: HeroBrandMarkProps): ReactElement {
  return (
    <img
      src={EZAI_MARK_DATA_URI}
      alt=""
      aria-hidden="true"
      height={47}
      className={className}
      style={{ display: 'block', width: 'auto' }}
    />
  )
}

/**
 * Render the 金石易服/EZAI wordmark stack beside the expanded sidebar mark,
 * matching the pre-migration two-line fallback (figma brand group): 金石易服
 * in 16px/600 primary ink over EZAI in 13px/500 secondary ink with 0.05em
 * letter spacing.
 * @returns the two-line wordmark stack (decorative brand art).
 */
export function EzaiBrandName(): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'baseline',
        gap: 4,
        marginTop: 4,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1.1,
          color: 'var(--dsw-alias-label-primary)',
        }}
      >
        金石易服
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.1,
          letterSpacing: '0.05em',
          color: 'var(--dsw-alias-label-secondary)',
        }}
      >
        EZAI
      </span>
    </div>
  )
}

/** Required service: the UI slot registry. */
export const inject = ['slots']

/**
 * Fill the brand slots as one declaration-aware registration set. The nested
 * `inject` calls wait on the sidebar declaration so the pair registers (and
 * withdraws) together; the hero occupant waits on the conversation shell.
 * @param ctx - Client root context.
 */
export function apply(ctx: {
  slots: {
    inject: (name: string, body: () => unknown) => unknown
    register: (entry: { name: string }, component: unknown) => () => void
  }
}): void {
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register({ name: 'sidebar.brand.mark' }, EzaiBrandMark)
      yield ctx.slots.register({ name: 'sidebar.brand.name' }, EzaiBrandName)
    }),
  )
  ctx.slots.inject('conversation.hero.brand.mark', function* () {
    yield ctx.slots.register({ name: 'conversation.hero.brand.mark' }, EzaiHeroBrandMark)
  })
}
