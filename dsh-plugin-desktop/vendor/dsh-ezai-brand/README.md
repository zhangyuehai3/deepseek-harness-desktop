# dsh-ezai-brand

EZAI brand occupants for the DSH web client shell slots.

The upstream shell declares three brand slots and renders its own fallbacks:

- `sidebar.brand.mark` / `sidebar.brand.name` (declared by `dsh-client-ui-sidebar`)
- `conversation.hero.brand.mark` (declared by `dsh-client-ui-conversation`)

This plugin occupies all three with the repository-owned EZAI artwork — the
same raster pipeline that produces the tray icons and window icons
(`build/app-icon.png` → `build/tray-icon.svg`) — and the 金石易服 wordmark.
Upstream's `dsh-client-ui-brand-official` stays disabled in the desktop
profile; occupying a slot is the only composition route.

## Build

```
yarn workspace dsh-ezai-brand build
```

`build.mjs` first extracts the embedded artwork data URI from
`dsh-plugin-desktop/build/tray-icon.svg` into `src/client/artwork.ts`
(generated file, committed), then bundles the client entry into
`lib/client.js` in the `window.__ModuleLoader__` handoff format.

## Test

```
yarn workspace dsh-ezai-brand test
```
