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
 * class SUFFIX (`_railMark`) — the module hash prefix changes with every
 * upstream build (0.1.5 `_muAxG_`, 0.2.1 `Wl6W_`), while the suffixed key is
 * stable. The brand button height is the EZAI 60px row geometry, matching
 * the 0.2.x sidebar logo row height.
 */
const SIDEBAR_MARK_CSS = `
.ezaiBrandMarkImg{display:block;height:40px;width:auto;}
[class*="_railMark"] .ezaiBrandMarkImg{height:24px;width:24px;}
button[class*="_brand"]{height:60px;min-width:0;color:inherit;cursor:pointer;}
`

/**
 * EZAI green brand basis. The 0.2.x theme derives every interactive blue
 * (links, primary buttons, focus rings, business states) from the
 * `--dsw-static-deepseek-*` ramp; recoloring that ramp at `body` level turns
 * the whole chrome green without touching component code. `!important` keeps
 * the skin winning when the theme re-injects its own stylesheet on dark-mode
 * switches. Values follow the EZAI palette (#265C5A primary teal, #98C455
 * accent green), keeping enough contrast for white text on 400/500 fills.
 */
const EZAI_GREEN_THEME_CSS = `
body{
  --dsw-static-deepseek-50:#f0f6ec !important;
  --dsw-static-deepseek-100:#e2eed3 !important;
  --dsw-static-deepseek-200:#c8dfb0 !important;
  --dsw-static-deepseek-300:#a9cd7f !important;
  --dsw-static-deepseek-400:#98C455 !important;
  --dsw-static-deepseek-450:#82ad43 !important;
  --dsw-static-deepseek-500:#2e6d64 !important;
  --dsw-static-deepseek-600:#265C5A !important;
  --dsw-static-deepseek-800:#2f4441 !important;
  --dsw-static-deepseek-900:#22302d !important;
}
body[data-ds-dark-theme]{
  --dsw-static-deepseek-50:#22302d !important;
  --dsw-static-deepseek-100:#2f4441 !important;
  --dsw-static-deepseek-200:#265C5A !important;
  --dsw-static-deepseek-300:#2e6d64 !important;
  --dsw-static-deepseek-400:#4d8a7d !important;
  --dsw-static-deepseek-450:#98C455 !important;
  --dsw-static-deepseek-500:#a9cd7f !important;
  --dsw-static-deepseek-600:#c8dfb0 !important;
  --dsw-static-deepseek-800:#e2eed3 !important;
  --dsw-static-deepseek-900:#f0f6ec !important;
}
`

/**
 * Render the EZAI mark for the sidebar brand row and the collapsed rail.
 * @returns the EZAI artwork image plus its rail-scoped stylesheet.
 */
export function EzaiBrandMark(_props: BrandMarkProps): ReactElement {
  return (
    <>
      <style>{SIDEBAR_MARK_CSS}</style>
      <style>{EZAI_GREEN_THEME_CSS}</style>
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
