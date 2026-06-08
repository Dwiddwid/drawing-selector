# drawing-selector

A browser-based **random drawing / winner picker** built for a church Vacation
Bible School (VBS) and adaptable to any raffle or giveaway. Import a list of
participants from a CSV, then run a slot-machine–style drawing that picks a
random winner, announces them on a big screen, and makes sure no one wins twice.
**Pro** features add custom branding/theming and a fully configurable winner
display.

Everything runs in the browser. Participant data is cached in `localStorage` and
the app shell is precached by a service worker, so **it works fully offline**
after the first load.

## Features

- **CSV import** — load participants from a spreadsheet export. Only a name is
  required; any other columns you include (grade, bus route, classroom…) are
  shown with the winner.
- **Manual add / edit / delete** — add walk-in participants by name without
  re-importing, edit a name inline, or remove individuals from the candidate
  list.
- **No repeat winners** — a winner is removed from the pool the moment they're
  drawn. Re-importing the same CSV automatically skips anyone who has already
  won.
- **Scoped / filtered draws** — narrow the pool by any column before drawing
  (e.g. "one winner per bus route" or "3rd grade only"). Stack multiple filters
  to combine criteria.
- **Slot-machine animation** — names cycle quickly and slow to a stop on the
  winner. **Pro** users can switch the reveal to a spinning wheel or a vertical
  reel, and trigger confetti + a celebratory chime on each winner.
- **Offline-first / installable (PWA)** — the app shell and all assets are
  precached by a Workbox service worker; it loads reliably with no network
  connection and can be installed on a device from the browser.
- **Backup & restore** — download winners as a CSV spreadsheet, or export/import
  the full app state (participants, winners, **and your Pro settings**) as JSON
  so results survive clearing browser storage or moving to another device.
- **Multi-display mode** — open the drawing screen on a projector/second screen
  and trigger each draw from the admin device (synced via `BroadcastChannel`).

### Pro features

Premium presentation features for branded events. They are built and usable now
behind an `isPro` flag; licensing/payment enforcement is planned for a later
release.

- **Custom theming** — set your own primary/secondary/accent/background/surface
  colors, choose a font, and add a custom event title. Pick a waves, solid, or
  uploaded-image background. Changes apply live to both the admin and drawing
  screens.
- **Event branding** — upload a logo shown above the drawing card.
- **Configurable winner display** — choose how the winner's name is formatted
  (`First Last`, `First` only, or `Last, First`), pick which detail fields are
  shown, rename their labels, reorder them, and toggle whether labels are shown
  at all.
- **Reveal animation styles** — choose Classic slot machine, Spinning wheel,
  Giant wheel (an oversized wheel whose center sits off-screen so names scroll
  past the pointer — every entry appears on the wheel), or Vertical reel per
  event.
- **Celebration effects** — confetti burst and a short celebratory chime on
  each winner reveal (either can be toggled off independently).
- **Portable "Offline Edition"** — build the entire app as a single
  self-contained `index.html` you can copy to a USB stick and open directly
  (`file://`) on a computer with no network or installation. See
  [Portable build](#portable-build-offline-edition) below.

All Pro settings are persisted to `localStorage` and included in the JSON
backup/restore so they travel with your event.

## CSV format

The importer expects a header row. **`First Name` and `Last Name` are the only
required columns.** Header matching is case-insensitive and tolerant of spacing
(`First Name`, `firstname`, `first` all work).

Every other column is optional and is displayed generically on the drawing
screen as `Header: value` — so grades, bus routes, classrooms, etc. all work
without any code changes.

```csv
First Name,Last Name,School Grade,Bus Route
Ada,Lovelace,3,12B
Alan,"Turing, Jr.",5,7A
```

Quoted fields (e.g. a comma inside a name) and `\r\n`/`\n` line endings are
handled correctly.

## Usage

1. Open the app — the **home/admin screen** is shown.
2. In the **Manage** panel, choose a `.csv` file to import. A message confirms
   how many participants were imported (and how many prior winners were
   skipped).
3. To add a walk-in, type their name into the **First name / Last name** fields
   at the bottom of the Participants card and click **Add**. Click a participant
   to edit their name inline, or click the trash icon next to their name to
   remove them.
4. *(Optional)* Add one or more **filters** to scope the draw to a subset of the
   pool — e.g. a specific grade or bus route. Only participants matching every
   active filter are eligible.
5. Click **Start drawing** to open the drawing screen, then **GO!** to draw a
   winner. The winner is announced and added to the Winners list.
6. Use **Reset candidates** / **Reset winners** to clear the cached lists.
   A confirmation prompt and a short-window **Undo** in the toast guard against
   accidental data loss.

### Theming & winner display (Pro)

Open the **Event Settings** panel on the admin screen to customize the look and
the winner announcement:

- **Theme** — colors, font, event title, background style (waves / solid /
  image), and a logo upload. Updates apply live.
- **Winner display** — name format, which detail fields appear, their labels and
  order, and whether labels are shown.

Settings are saved automatically and included in the JSON backup.

### Backup & restore

Open the **Backup / Restore** panel on the admin screen to:

- **Download winners CSV** — saves the current winners list as a `.csv` file.
- **Export state (JSON)** — saves both the candidate pool and winners list so
  you can restore them exactly on another device or after clearing storage.
- **Import state (JSON)** — restores a previously exported state file.

### Multi-display mode

Enable **Use multi display mode** on the home screen to separate the operator
controls from the audience display:

- Open the drawing screen (`/drawing`) on the projector/second screen.
- Keep the admin screen on your own device and use **Select winner** to trigger
  the draw remotely. Both screens must be the same origin in the same browser
  profile (uses `BroadcastChannel`).

> Multi-display works in the portable Offline Edition too. `BroadcastChannel`
> can't connect between `file://` pages, so the portable build automatically
> falls back to a `localStorage`-based cross-tab trigger — open both tabs from
> the same `index.html` in the same browser profile.

## Tech stack

- [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/)
- [Pinia](https://pinia.vuejs.org/) for state
- [Vue Router](https://router.vuejs.org/) (`/` home, `/drawing` display)
- [Vuetify](https://vuetifyjs.com/) + Bootstrap + Font Awesome for UI
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (Workbox) for offline / PWA
- [Vitest](https://vitest.dev/) for unit tests
- Deployed as an Azure Static Web App (see `.github/workflows/` and
  `staticwebapp.config.json`)

## Project setup

```sh
npm install
```

### Develop (hot reload)

```sh
npm run dev
```

### Build for production

```sh
npm run build
```

The build emits `dist/sw.js` (service worker) and `dist/manifest.webmanifest`
alongside the usual JS/CSS bundles.

### Portable build (Offline Edition)

```sh
npm run build:portable
```

This produces a **single self-contained file** at `dist-portable/index.html`
with all JavaScript, CSS, and styles inlined. Copy it to a USB stick (or email
it) and open it directly in a browser — no web server, no install, no network.
Ideal for no-network venues like church camps.

How it differs from the standard build:

- All assets are inlined into one HTML file (via `vite-plugin-singlefile`).
- The PWA service worker is omitted (it can't register from `file://`).
- The router uses hash history (`/#/drawing`) so routes resolve without a server.
- Multi-display still works, via a `localStorage` cross-tab trigger instead of
  `BroadcastChannel` (which can't bridge `file://` tabs).

Custom theming and all other settings still work, since they persist to
`localStorage`, which is available under `file://`.

### Run tests

```sh
npm test          # run once
npm run test:watch  # watch mode
```

Tests cover the CSV parser/normalizer (`src/utils/csv.js`), the export helpers
(`src/utils/export.js`), the winner-display formatting (`src/utils/winnerDisplay.js`),
the drawing store (`src/stores/participants.js`) including all three animation
styles and reset/undo, the settings store (`src/stores/settings.js`), the
celebration helpers (`src/utils/celebration.js`), the platform/portable helpers
(`src/utils/platform.js`), and an end-to-end multi-display integration that
wires the trigger channel into the store in both transports
(`src/utils/multiDisplay.test.js`) — 109 tests total.

## Roadmap / future enhancements

- **Licensing / payment enforcement.** Gate the Pro features behind a real
  license check (the `isPro` flag is the scaffold for this).
