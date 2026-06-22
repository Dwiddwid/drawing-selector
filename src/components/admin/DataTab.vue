<script setup>
import { ref, computed } from 'vue'
import { useParticipantStore } from '../../stores/participants.js'
import { useSettingsStore, mergeSettings } from '../../stores/settings.js'
import { parseCsv, normalizeWithMapping } from '../../utils/csv.js'
import { collectFieldKeys } from '../../utils/winnerDisplay.js'
import { exportStateJson, deserializeState } from '../../utils/export.js'
import CsvMappingDialog from './CsvMappingDialog.vue'

const emit = defineEmits(['notify'])

const store = useParticipantStore()
const settings = useSettingsStore()

const myFile = ref(null)
const stateFile = ref(null)

// CSV column-mapping dialog state. `pendingCsv` holds the parsed file until the
// user confirms a mapping.
const mappingOpen = ref(false)
const pendingCsv = ref({ headers: [], rows: [] })

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

function selectedFile() {
  const file = myFile.value?.files?.[0]
  if (!file) return

  const looksLikeCsv = /\.csv$/i.test(file.name) || (file.type && file.type.includes('csv'))
  if (!looksLikeCsv) {
    notify('Please choose a .csv file.', 'error')
    return
  }

  const reader = new FileReader()
  reader.readAsText(file, 'UTF-8')
  reader.onload = (evt) => {
    try {
      const { headers, rows } = parseCsv(evt.target.result)
      if (headers.length === 0 || rows.length === 0) {
        notify('No participants found in that file.', 'warning')
        return
      }
      pendingCsv.value = { headers, rows }
      mappingOpen.value = true
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
  const verb = mode === 'replace' ? 'Imported' : 'Added'
  const extras = []
  if (merged) extras.push(`added entries to ${merged} returning`)
  if (skipped) extras.push(`skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}`)
  notify(
    `${verb} ${imported} participant${imported === 1 ? '' : 's'}` +
      (extras.length ? ` (${extras.join(', ')})` : ''),
    'success',
  )
  resetFileInput()
}

function onMappingCancel() {
  mappingOpen.value = false
  resetFileInput()
}

// Clear the file input so re-selecting the same file fires @change again.
function resetFileInput() {
  pendingCsv.value = { headers: [], rows: [] }
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
      <p>Choose a .csv file of candidates to import.</p>

      <v-file-input label="Import CSV" ref="myFile" @change="selectedFile" accept=".csv" />
      <v-btn class="mr-2 mb-2" @click="askResetCandidates">Reset candidates</v-btn>
      <v-btn class="mb-2" @click="askResetWinners">Reset winners</v-btn>
    </template>
  </v-card>

  <CsvMappingDialog
    v-model="mappingOpen"
    :headers="pendingCsv.headers"
    :preview="pendingCsv.rows"
    :row-count="pendingCsv.rows.length"
    @confirm="onMappingConfirm"
    @cancel="onMappingCancel"
  />

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
