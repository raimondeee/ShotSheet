# ShotSheet

Youth-hockey shot chart PWA (Vite + vanilla TypeScript). Primary target is **iPad Safari → Add to Home Screen**.

## Rink

The chart is a **vertical attack half** only (goal/crease at the top, center red line at the bottom). There is no full-sheet view.

**Attacking other end** is a horizontal mirror of that same half (`scaleX(-1)` on the rink stage). It does not reveal the other physical end of a full ice sheet.

Shot coordinates are normalized 0–1 in that vertical image (`coordSpace: "vert-half-v1"`): `x` left boards → right boards, `y` goal (top) → center ice (bottom).

Season JSON and `localStorage` from the old full-horizontal rink are migrated **once** on load and on JSON import:

```
// Attack half (x_old >= 0.5): new_x = y_old; new_y = 2 * (1 - x_old)
// Other end   (x_old < 0.5):  new_x = y_old; new_y = 2 * x_old
```

New placements write the vertical-half space only. Do not hand-edit old JSON into the new axes without setting `coordSpace`.

## iPad import

Import JSON and CSV use **visible native** `<input type="file">` controls (Home → Season, Chart → Import/persist, and Chart → Settings). Hidden file inputs inside styled buttons often fail to open Files on iOS Safari / A2HS.

After a Pages deploy, **hard-refresh** the tab or delete and re-add the Home Screen icon so the PWA picks up the new UI.

## Develop / build

```bash
npm install
npm run dev          # vite --host
npm run build        # tsc && vite build; default base ./
VITE_BASE=/ShotSheet/ npm run build   # GitHub Pages project site
```
