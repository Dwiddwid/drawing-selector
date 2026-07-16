<script setup>
import { ref, computed } from 'vue'
import { useParticipantStore } from '../../stores/participants.js'
import { useSettingsStore, mergeSettings } from '../../stores/settings.js'
import { parseCsv, tabularizeJsonList, normalizeWithMapping } from '../../utils/csv.js'
import { collectFieldKeys } from '../../utils/winnerDisplay.js'
import { exportStateJson, deserializeState } from '../../utils/export.js'
import CsvMappingDialog from './CsvMappingDialog.vue'
import PasteListDialog from './PasteListDialog.vue'

const emit = defineEmits(['notify'])

const store = useParticipantStore()
const settings = useSettingsStore()

// Excel import needs SheetJS, which the portable single-file build excludes
// (the flag is replaced at build time, so the whole code path — and the lazy
// xlsx chunk behind it — drops out of that bundle).
const excelSupported = typeof __PORTABLE_BUILD__ === 'undefined' || !__PORTABLE_BUILD__
const importAccept = excelSupported ? '.csv,.tsv,.txt,.xlsx,.json' : '.csv,.tsv,.txt,.json'

const myFile = ref(null)
const stateFile = ref(null)

// Column-mapping dialog state. `pendingCsv` holds the parsed table until the
// user confirms a mapping. For delimited-text sources (file or paste),
// `pendingRaw`/`pendingHasHeader`/`pendingDelimiter` keep the original input so
// the dialog's delimiter override can re-parse it; `pendingParseOptions` is
// false for sources with no delimiter (Excel sheets, JSON lists).
const mappingOpen = ref(false)
const pendingCsv = ref({ headers: [], rows: [] })
const pendingRaw = ref('')
const pendingHasHeader = ref(true)
const pendingDelimiter = ref(',')
const pendingRagged = ref(0)
const pendingParseOptions = ref(true)

const pasteOpen = ref(false)

// Sheet picker for multi-sheet Excel workbooks.
const sheetChoices = ref([]) // [{ name, headers, rows }]
const sheetPickerOpen = ref(false)

// Reset-confirmation dialog. `pendingReset` is 'candidates' | 'winners' | null.
const pendingReset = ref(null)
const resetCounts = {
  candidates: () => store.candidates.length,
  winners: () => store.winners.length,
}
const pendingResetCount = computed(() =>
  pendingReset.value ? resetCounts[pendingReset.value]() : 0,
)

function notify(text, color, undoAction = null) {
  emit('notify', text, color, undoAction)
}

// Funnel any delimited-text source (file or paste) through one parse + dialog
// path. Re-invoked with an explicit delimiter when the operator overrides the
// auto-detected one in the mapping dialog.
function openMapping(rawText, { hasHeader = true, delimiter } = {}) {
  const { headers, rows, delimiter: used, raggedRows } = parseCsv(rawText, {
    hasHeader,
    delimiter,
  })
  if (headers.length === 0 || rows.length === 0) {
    notify('No participants found in that file.', 'warning')
    return
  }
  pendingRaw.value = rawText
  pendingHasHeader.value = hasHeader
  pendingDelimiter.value = used
  pendingRagged.value = raggedRows
  pendingParseOptions.value = true
  pendingCsv.value = { headers, rows }
  mappingOpen.value = true
}

// A table that arrived without a delimiter (Excel sheet, JSON list) — no
// separator override to offer, nothing to re-parse.
function openMappingForTable({ headers, rows }) {
  if (headers.length === 0 || rows.length === 0) {
    notify('No participants found in that file.', 'warning')
    return
  }
  pendingRaw.value = ''
  pendingRagged.value = 0
  pendingParseOptions.value = false
  pendingCsv.value = { headers, rows }
  mappingOpen.value = true
}

function onDelimiterOverride(delimiter) {
  // Only delimited-text sources keep the raw input around.
  if (!pendingRaw.value) return
  openMapping(pendingRaw.value, { hasHeader: pendingHasHeader.value, delimiter })
}

function onPasteConfirm({ text, hasHeader }) {
  openMapping(text, { hasHeader })
}

async function importExcelFile(file) {
  // Static flag check keeps SheetJS (and this whole path) out of the portable
  // single-file build.
  if (!excelSupported) {
    notify('Excel import isn’t available in the Offline Edition — save the sheet as CSV instead.', 'error')
    return
  }
  try {
    const { parseWorkbook } = await import('../../utils/excel.js')
    const buffer = await file.arrayBuffer()
    const sheets = await parseWorkbook(buffer)
    if (sheets.length === 0) {
      notify('No participants found in that workbook.', 'warning')
      return
    }
    if (sheets.length === 1) {
      openMappingForTable(sheets[0])
    } else {
      sheetChoices.value = sheets
      sheetPickerOpen.value = true
    }
  } catch {
    notify('Could not read that Excel file.', 'error')
  }
}

function chooseSheet(sheet) {
  sheetPickerOpen.value = false
  sheetChoices.value = []
  openMappingForTable(sheet)
}

function importJsonList(text) {
  // Two kinds of .json can land here: a plain participant array (import it
  // through the mapping dialog) or a full state backup (point at Restore).
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    notify('Invalid JSON file.', 'error')
    return
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
      (Array.isArray(parsed.candidates) || Array.isArray(parsed.winners))) {
    notify('This looks like a full backup — use “Import state (JSON)” under Backup / Restore below.', 'warning')
    return
  }
  try {
    openMappingForTable(tabularizeJsonList(parsed))
  } catch (err) {
    notify(err.message || 'Could not read that file.', 'error')
  }
}

function selectedFile() {
  const file = myFile.value?.files?.[0]
  if (!file) return

  const name = file.name || ''
  if (/\.xlsx$/i.test(name)) {
    importExcelFile(file)
    return
  }

  const isJson = /\.json$/i.test(name) || (file.type && file.type.includes('json'))
  const looksLikeText =
    isJson ||
    /\.(csv|tsv|txt)$/i.test(name) ||
    (file.type && (file.type.includes('csv') || file.type.startsWith('text/')))
  if (!looksLikeText) {
    notify(
      excelSupported
        ? 'Please choose a .csv, .tsv, .txt, .xlsx or .json file.'
        : 'Please choose a .csv, .tsv, .txt or .json file.',
      'error',
    )
    return
  }

  const reader = new FileReader()
  reader.readAsText(file, 'UTF-8')
  reader.onload = (evt) => {
    try {
      if (isJson) importJsonList(evt.target.result)
      else openMapping(evt.target.result)
    } catch (err) {
      notify(err.message || 'Could not read that file.', 'error')
    }
  }
  reader.onerror = () => {
    notify('Could not read that file.', 'error')
  }
}

function onMappingConfirm({ mapping, mode }) {
  mappingOpen.value = false
  const list = normalizeWithMapping(pendingCsv.value.rows, mapping)
  if (list.length === 0) {
    notify('No participants found with that mapping.', 'warning')
    return
  }
  const { imported, skipped, merged } = store.importParticipants(list, mode)
  // Register any new columns so they show up in the winner-display editor.
  settings.syncFields(collectFieldKeys(store.getParticipants))
  // Apply the headline (name) fields chosen in the dialog. Replace swaps them
  // out; append/accumulate union with whatever is already configured.
  const nameKeys = mapping
    .filter((m) => m.include && m.role === 'name')
    .map((m) => (m.label || m.key).trim())
  if (mode === 'replace') {
    settings.setNameKeys(nameKeys)
  } else {
    settings.setNameKeys([...new Set([...settings.winnerDisplay.nameKeys, ...nameKeys])])
  }
  // Build a message that reads naturally whether the import only added new
  // people, only topped up entries for returning ones (accumulate), or both.
  const verb = mode === 'replace' ? 'Imported' : 'Added'
  const parts = []
  if (imported || !merged) parts.push(`${imported} participant${imported === 1 ? '' : 's'}`)
  if (merged) parts.push(`entries to ${merged} returning participant${merged === 1 ? '' : 's'}`)
  let message = `${verb} ${parts.join(' and ')}`
  const notes = []
  if (skipped) notes.push(`skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}`)
  // Rows normalizeWithMapping dropped for having no name / no display fields.
  const skippedEmpty = pendingCsv.value.rows.length - list.length
  if (skippedEmpty > 0) notes.push(`${skippedEmpty} row${skippedEmpty === 1 ? '' : 's'} skipped — no name`)
  if (notes.length) message += ` (${notes.join('; ')})`
  notify(message, 'success')
  // A pool where every entry count is 0 imports fine but can never draw —
  // easier to hear it now than on the projector screen later.
  if (store.candidates.length > 0 && store.totalEntries === 0) {
    notify('Heads up: every candidate has 0 entries, so no one can be drawn.', 'warning')
  }
  resetFileInput()
}

function onMappingCancel() {
  mappingOpen.value = false
  resetFileInput()
}

// Clear the file input so re-selecting the same file fires @change again.
function resetFileInput() {
  pendingCsv.value = { headers: [], rows: [] }
  pendingRaw.value = ''
  pendingHasHeader.value = true
  pendingDelimiter.value = ','
  pendingRagged.value = 0
  pendingParseOptions.value = true
  myFile.value = null
}

function askResetCandidates() {
  if (store.candidates.length === 0) {
    // Nothing to lose — just clear quietly without the modal.
    confirmResetCandidates()
    return
  }
  pendingReset.value = 'candidates'
}

function askResetWinners() {
  if (store.winners.length === 0) {
    // Nothing to return or remove — clear quietly without the modal.
    store.resetWinners('remove')
    return
  }
  pendingReset.value = 'winners'
}

function cancelReset() {
  pendingReset.value = null
}

function confirmResetCandidates() {
  pendingReset.value = null
  const count = store.candidates.length
  store.resetCandidates()
  myFile.value = null
  if (count > 0) {
    notify(
      `Cleared ${count} candidate${count === 1 ? '' : 's'}.`,
      'info',
      () => store.undoResetCandidates(),
    )
  }
}

// Winners reset — the operator picks what happens to past winners:
//   'return' — back into the candidate pool for re-drawing
//   'remove' — gone entirely (until the undo toast expires)
function confirmResetWinners(mode) {
  pendingReset.value = null
  const count = store.winners.length
  store.resetWinners(mode)
  if (count > 0) {
    notify(
      mode === 'return'
        ? `Returned ${count} winner${count === 1 ? '' : 's'} to the candidate pool.`
        : `Removed ${count} winner${count === 1 ? '' : 's'}.`,
      'info',
      () => store.undoResetWinners(),
    )
  }
}

function exportState() {
  exportStateJson(store.candidates, store.winners, {
    isPro: settings.isPro,
    theme: settings.theme,
    winnerDisplay: settings.winnerDisplay,
    animationStyle: settings.animationStyle,
    drawTiming: settings.drawTiming,
    drawCount: settings.drawCount,
    multiWinnerReveal: settings.multiWinnerReveal,
    celebration: settings.celebration,
    spinner: settings.spinner,
    participantList: settings.participantList,
  })
}

function importStateFile() {
  const file = stateFile.value?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.readAsText(file, 'UTF-8')
  reader.onload = (evt) => {
    try {
      const state = deserializeState(evt.target.result)
      store.importState(state)
      if (state.settings) {
        const merged = mergeSettings(state.settings)
        settings.setIsPro(merged.isPro)
        settings.updateTheme(merged.theme)
        settings.updateWinnerDisplay(merged.winnerDisplay)
        settings.setAnimationStyle(merged.animationStyle)
        settings.updateDrawTiming(merged.drawTiming)
        settings.setDrawCount(merged.drawCount)
        settings.setMultiWinnerReveal(merged.multiWinnerReveal)
        settings.updateCelebration(merged.celebration)
        settings.updateSpinner(merged.spinner)
        settings.updateParticipantList(merged.participantList)
      }
      notify(
        `Restored ${state.candidates.length} candidate${state.candidates.length === 1 ? '' : 's'} and ${state.winners.length} winner${state.winners.length === 1 ? '' : 's'}.`,
        'success',
      )
    } catch (err) {
      notify(err.message || 'Could not read that file.', 'error')
    }
  }
  reader.onerror = () => notify('Could not read that file.', 'error')
}
</script>

<template>
  <v-card prepend-icon="fas fa-book" variant="outlined" class="mb-4">
    <template v-slot:title> Manage </template>

    <template v-slot:text>
      <p>
        Import candidates from a file
        ({{ excelSupported ? 'CSV, TSV, Excel or JSON' : 'CSV, TSV or JSON' }})
        or paste a list straight from a spreadsheet.
      </p>

      <v-file-input
        label="Import participants"
        ref="myFile"
        @change="selectedFile"
        :accept="importAccept"
      />
      <v-btn class="mr-2 mb-2" prepend-icon="fas fa-paste" @click="pasteOpen = true">
        Paste a list
      </v-btn>
      <v-btn class="mr-2 mb-2" @click="askResetCandidates">Reset candidates</v-btn>
      <v-btn class="mb-2" @click="askResetWinners">Reset winners</v-btn>
    </template>
  </v-card>

  <CsvMappingDialog
    v-model="mappingOpen"
    :headers="pendingCsv.headers"
    :preview="pendingCsv.rows"
    :row-count="pendingCsv.rows.length"
    :delimiter="pendingDelimiter"
    :ragged-rows="pendingRagged"
    :show-parse-options="pendingParseOptions"
    @update:delimiter="onDelimiterOverride"
    @confirm="onMappingConfirm"
    @cancel="onMappingCancel"
  />

  <PasteListDialog v-model="pasteOpen" @confirm="onPasteConfirm" />

  <v-dialog v-model="sheetPickerOpen" max-width="460">
    <v-card>
      <v-card-title>Choose a sheet</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-2">
          This workbook has several sheets with data — pick the one to import.
        </p>
        <v-list density="compact">
          <v-list-item
            v-for="sheet in sheetChoices"
            :key="sheet.name"
            :title="sheet.name"
            :subtitle="`${sheet.rows.length} row${sheet.rows.length === 1 ? '' : 's'}`"
            @click="chooseSheet(sheet)"
          />
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="sheetPickerOpen = false">Cancel</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-card prepend-icon="fas fa-floppy-disk" variant="outlined">
    <template v-slot:title> Backup / Restore </template>
    <template v-slot:text>
      <p class="text-body-2 mb-3">
        Save or load the full app state as JSON so data survives clearing browser storage or
        moving between devices.
      </p>
      <v-btn class="mr-2 mb-2" prepend-icon="fas fa-file-export" @click="exportState">
        Export state (JSON)
      </v-btn>
      <v-file-input
        label="Import state (JSON)"
        ref="stateFile"
        accept=".json"
        class="mt-2"
        @change="importStateFile"
      />
    </template>
  </v-card>

  <v-dialog
    :model-value="pendingReset !== null"
    @update:model-value="(v) => !v && cancelReset()"
    max-width="460"
  >
    <v-card v-if="pendingReset === 'candidates'">
      <v-card-title> Reset candidates? </v-card-title>
      <v-card-text>
        This will clear
        <strong>{{ pendingResetCount }}</strong>
        candidate{{ pendingResetCount === 1 ? '' : 's' }}. You'll get a short window to undo from
        the toast.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancelReset">Cancel</v-btn>
        <v-btn color="error" variant="elevated" @click="confirmResetCandidates">Reset</v-btn>
      </v-card-actions>
    </v-card>

    <v-card v-else>
      <v-card-title> Reset winners? </v-card-title>
      <v-card-text>
        What should happen to the
        <strong>{{ pendingResetCount }}</strong>
        past winner{{ pendingResetCount === 1 ? '' : 's' }}?
        <em>Return to pool</em> puts them back into the draw;
        <em>Remove permanently</em> deletes them. Either way you'll get a short window to undo
        from the toast.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancelReset">Cancel</v-btn>
        <v-btn color="primary" variant="elevated" @click="confirmResetWinners('return')">
          Return to pool
        </v-btn>
        <v-btn color="error" variant="elevated" @click="confirmResetWinners('remove')">
          Remove permanently
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
