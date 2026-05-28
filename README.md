# drawing-selector

A simple, browser-based **random drawing / winner picker** built for a church
Vacation Bible School (VBS). Import a list of participants from a CSV, then run
a slot-machine–style drawing that picks a random winner, announces them on a
big screen, and makes sure no one wins twice.

Everything runs in the browser and the participant list is cached locally, so it
keeps working without a network connection once the page has loaded.

## Features

- **CSV import** — load participants from a spreadsheet export. Only a name is
  required; any other columns you include are shown with the winner.
- **No repeat winners** — a winner is removed from the pool the moment they're
  drawn, and re-importing the same list automatically skips anyone who has
  already won.
- **Slot-machine animation** — names cycle quickly and slow to a stop on the
  winner.
- **Locally cached** — participants and winners are stored in the browser
  (`localStorage`), so a refresh or an offline venue won't lose your data.
- **Multi-display mode** — open the drawing screen on a projector/second screen
  and trigger each draw from the admin device (synced via the browser's
  `BroadcastChannel`).

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
3. Click **Start drawing** to open the drawing screen, then **GO!** to draw a
   winner. The winner is announced and added to the **Winners** list.
4. Use **Reset candidates** / **Reset winners** to clear the cached lists.

### Multi-display mode

Enable **Use multi display mode** on the home screen to separate the operator
controls from the audience display:

- Open the drawing screen (`/drawing`) on the projector/second screen.
- Keep the admin screen on your own device and use **Select winner** to trigger
  the draw remotely. Both screens must be the same origin in the same browser
  profile (it uses `BroadcastChannel`).

## Tech stack

- [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/)
- [Pinia](https://pinia.vuejs.org/) for state
- [Vue Router](https://router.vuejs.org/) (`/` home, `/drawing` display)
- [Vuetify](https://vuetifyjs.com/) + Bootstrap + Font Awesome for UI
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

### Run tests

```sh
npm run test        # run once
npm run test:watch  # watch mode
```

Tests cover the CSV parser/normalizer (`src/utils/csv.js`) and the drawing
store (`src/stores/participants.js`) — including the empty-pool guard,
no-repeat-winner behavior, and re-import de-duplication.

## Roadmap / future enhancements

Planned and proposed improvements, roughly in priority order:

- **Offline-first / installable (PWA).** The participant data is already cached
  locally, but the app shell still needs the network to load. Adding a service
  worker + web manifest (e.g. `vite-plugin-pwa`) would let it launch reliably
  offline and be "installed" on a device.
- **Winner export & backup.** Export winners to CSV/PDF and export/import the
  full state as JSON, so results survive clearing browser data or moving
  between devices.
- **Scoped / filtered draws.** Draw within a specific grade or bus route — e.g.
  "one winner per bus."
- **Manual participant management.** Add, edit, and remove individual
  participants without re-importing the whole file, plus a confirmation/undo on
  the reset buttons.
- **Broader test coverage.** Component/end-to-end tests for the drawing flow and
  the multi-display (`BroadcastChannel`) path.
- **Code quality.** Add ESLint/Prettier, code-split to shrink the bundle, and
  de-duplicate the inlined SVG backgrounds.
