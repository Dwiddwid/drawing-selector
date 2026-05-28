# drawing-selector

A simple, browser-based **random drawing / winner picker** built for a church
Vacation Bible School (VBS). Import a list of participants from a CSV, then run
a slot-machine–style drawing that picks a random winner, announces them on a
big screen, and makes sure no one wins twice.

Everything runs in the browser. Participant data is cached in `localStorage` and
the app shell is precached by a service worker, so **it works fully offline**
after the first load.

## Features

- **CSV import** — load participants from a spreadsheet export. Only a name is
  required; any other columns you include (grade, bus route, classroom…) are
  shown with the winner.
- **Manual add / delete** — add walk-in participants by name without
  re-importing, or remove individuals from the candidate list.
- **No repeat winners** — a winner is removed from the pool the moment they're
  drawn. Re-importing the same CSV automatically skips anyone who has already
  won.
- **Slot-machine animation** — names cycle quickly and slow to a stop on the
  winner.
- **Offline-first / installable (PWA)** — the app shell and all assets are
  precached by a Workbox service worker; it loads reliably with no network
  connection and can be installed on a device from the browser.
- **Backup & restore** — download winners as a CSV spreadsheet, or export/import
  the full app state as JSON so results survive clearing browser storage or
  moving to another device.
- **Multi-display mode** — open the drawing screen on a projector/second screen
  and trigger each draw from the admin device (synced via `BroadcastChannel`).

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
   at the bottom of the Participants card and click **Add**. To remove someone,
   click the trash icon next to their name.
4. Click **Start drawing** to open the drawing screen, then **GO!** to draw a
   winner. The winner is announced and added to the Winners list.
5. Use **Reset candidates** / **Reset winners** to clear the cached lists.

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

### Run tests

```sh
npm test          # run once
npm run test:watch  # watch mode
```

Tests cover the CSV parser/normalizer (`src/utils/csv.js`), the export helpers
(`src/utils/export.js`), and the drawing store (`src/stores/participants.js`) —
40 tests total.

## Roadmap / future enhancements

- **Scoped / filtered draws.** Draw within a specific grade or bus route — e.g.
  "one winner per bus."
- **Confirm / undo on resets.** A guard before Reset candidates / Reset winners
  to prevent accidental data loss.
- **Broader test coverage.** Component/end-to-end tests for the drawing flow and
  the multi-display (`BroadcastChannel`) path.
- **Code quality.** Add ESLint/Prettier, code-split to shrink the bundle, and
  de-duplicate the inlined SVG backgrounds.
