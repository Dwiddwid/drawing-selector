<script setup>
import { useParticipantStore } from '../stores/participants.js'
import { useSettingsStore, mergeSettings } from '../stores/settings.js'
import { parseParticipantsCsv } from '../utils/csv.js'
import { downloadWinnersCsv, exportStateJson, deserializeState } from '../utils/export.js'
import { ref, computed } from 'vue'
import EventSettings from './EventSettings.vue'

const store = useParticipantStore()
const settings = useSettingsStore()

const myFile = ref(null)
const stateFile = ref(null)
const snackbar = ref(false)
const snackbarColor = ref('success')
const snackbarText = ref('')

const newFirst = ref('')
const newLast = ref('')

const editingId = ref(null)
const editFirst = ref('')
const editLast = ref('')

const pendingKey = ref(null)
const pendingValue = ref(null)

const availableFilterKeys = computed(() => {
  const activeKeys = new Set(store.filters.map((f) => f.key))
  return [...new Set(store.candidates.flatMap((c) => Object.keys(c.extras ?? {})))].filter(
    (k) => !activeKeys.has(k),
  )
})

const availableFilterValues = computed(() =>
  pendingKey.value
    ? [...new Set(store.candidates.map((c) => c.extras?.[pendingKey.value]).filter(Boolean))]
    : [],
)

function startEdit(participant) {
  editingId.value = participant.id
  editFirst.value = participant.firstName
  editLast.value = participant.lastName
}

function saveEdit() {
  if (!editingId.value) return
  const first = editFirst.value.trim()
  const last = editLast.value.trim()
  if (!first && !last) {
    notify('Enter at least a first or last name.', 'warning')
    return
  }
  store.updateCandidate(editingId.value, { firstName: first, lastName: last })
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

function onPendingKeyChange(key) {
  pendingKey.value = key
  pendingValue.value = null
}

function addFilter() {
  if (!pendingKey.value || !pendingValue.value) return
  store.addFilter(pendingKey.value, pendingValue.value)
  pendingKey.value = null
  pendingValue.value = null
}

function notify(text, color) {
  snackbarText.value = text
  snackbarColor.value = color
  snackbar.value = true
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
      const participants = parseParticipantsCsv(evt.target.result)
      if (participants.length === 0) {
        notify('No participants found in that file.', 'warning')
        return
      }
      const { imported, skipped } = store.importParticipants(participants)
      notify(
        `Imported ${imported} participant${imported === 1 ? '' : 's'}` +
          (skipped ? ` (skipped ${skipped} previous winner${skipped === 1 ? '' : 's'})` : ''),
        'success',
      )
    } catch (err) {
      notify(err.message || 'Could not read that file.', 'error')
    }
  }
  reader.onerror = () => {
    notify('Could not read that file.', 'error')
  }
}

function resetCandidates() {
  store.resetCandidates()
  myFile.value = null
  pendingKey.value = null
  pendingValue.value = null
  editingId.value = null
}

function resetWinners() {
  store.resetWinners()
}

function addParticipant() {
  const first = newFirst.value.trim()
  const last = newLast.value.trim()
  if (!first && !last) {
    notify('Enter at least a first or last name.', 'warning')
    return
  }
  store.addCandidate({ firstName: first, lastName: last })
  newFirst.value = ''
  newLast.value = ''
}

function exportWinners() {
  const ok = downloadWinnersCsv(store.winners)
  if (!ok) notify('No winners to export yet.', 'warning')
}

function exportState() {
  exportStateJson(store.candidates, store.winners, {
    isPro: settings.isPro,
    theme: settings.theme,
    winnerDisplay: settings.winnerDisplay,
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
  <v-card prepend-icon="fas fa-people-group" variant="outlined">
    <template v-slot:title> Participants </template>

    <template v-slot:text>
      <v-list lines="one" density="compact">
        <v-list-item
          v-for="participant in store.candidates"
          :key="participant.id"
          :value="participant"
        >
          <template v-if="editingId === participant.id">
            <v-row dense align="center" class="py-1">
              <v-col cols="5">
                <v-text-field
                  v-model="editFirst"
                  label="First"
                  density="compact"
                  hide-details
                  @keyup.enter="saveEdit"
                  @keyup.escape="cancelEdit"
                />
              </v-col>
              <v-col cols="5">
                <v-text-field
                  v-model="editLast"
                  label="Last"
                  density="compact"
                  hide-details
                  @keyup.enter="saveEdit"
                  @keyup.escape="cancelEdit"
                />
              </v-col>
            </v-row>
          </template>
          <template v-else>
            {{ participant.firstName }} {{ participant.lastName }}
          </template>

          <template v-slot:append>
            <template v-if="editingId === participant.id">
              <v-btn
                icon
                size="x-small"
                variant="text"
                color="success"
                @click="saveEdit"
                aria-label="Save"
              >
                <font-awesome-icon icon="fas fa-check" />
              </v-btn>
              <v-btn
                icon
                size="x-small"
                variant="text"
                @click="cancelEdit"
                aria-label="Cancel"
              >
                <font-awesome-icon icon="fas fa-xmark" />
              </v-btn>
            </template>
            <template v-else>
              <v-btn
                icon
                size="x-small"
                variant="text"
                @click="startEdit(participant)"
                aria-label="Edit participant"
              >
                <font-awesome-icon icon="fas fa-pencil" />
              </v-btn>
              <v-btn
                icon
                size="x-small"
                variant="text"
                color="error"
                @click="store.removeCandidate(participant.id)"
                aria-label="Remove participant"
              >
                <font-awesome-icon icon="fas fa-trash" />
              </v-btn>
            </template>
          </template>
        </v-list-item>
      </v-list>

      <v-row class="mt-2" dense>
        <v-col cols="5">
          <v-text-field
            v-model="newFirst"
            label="First name"
            density="compact"
            hide-details
            @keyup.enter="addParticipant"
          />
        </v-col>
        <v-col cols="5">
          <v-text-field
            v-model="newLast"
            label="Last name"
            density="compact"
            hide-details
            @keyup.enter="addParticipant"
          />
        </v-col>
        <v-col cols="2" class="d-flex align-center">
          <v-btn size="small" color="primary" @click="addParticipant">Add</v-btn>
        </v-col>
      </v-row>
    </template>
  </v-card>

  <v-card prepend-icon="fas fa-filter" variant="outlined">
    <template v-slot:title> Draw Filter </template>
    <template v-slot:text>
      <p class="text-body-2 mb-3">
        Restrict the draw to candidates matching all selected field values.
      </p>

      <v-row dense align="center">
        <v-col cols="5">
          <v-select
            :model-value="pendingKey"
            :items="availableFilterKeys"
            label="Field"
            density="compact"
            hide-details
            :disabled="availableFilterKeys.length === 0"
            @update:model-value="onPendingKeyChange"
          />
        </v-col>
        <v-col cols="5">
          <v-select
            v-model="pendingValue"
            :items="availableFilterValues"
            label="Value"
            density="compact"
            hide-details
            :disabled="!pendingKey || availableFilterValues.length === 0"
          />
        </v-col>
        <v-col cols="2" class="d-flex align-center">
          <v-btn
            size="small"
            color="primary"
            :disabled="!pendingKey || !pendingValue"
            @click="addFilter"
          >
            Add
          </v-btn>
        </v-col>
      </v-row>

      <div v-if="store.filters.length > 0" class="mt-3">
        <v-chip
          v-for="f in store.filters"
          :key="f.key"
          class="mr-1 mb-1"
          closable
          @click:close="store.removeFilter(f.key)"
        >
          {{ f.key }}: {{ f.value }}
        </v-chip>
        <v-btn size="x-small" variant="text" class="mb-1" @click="store.clearFilters()">
          Clear all
        </v-btn>
        <p class="text-body-2 mt-1">
          {{ store.filteredCandidates.length }} of {{ store.candidates.length }} candidates match.
        </p>
      </div>
    </template>
  </v-card>

  <v-card prepend-icon="fas fa-gift" variant="outlined">
    <template v-slot:title> Winners </template>

    <template v-slot:text>
      <v-list lines="one" density="compact">
        <v-list-item
          v-for="participant in store.winners"
          :key="participant.id"
          :title="participant.firstName + ' ' + participant.lastName"
          :value="participant"
        />
      </v-list>
    </template>
  </v-card>

  <v-card prepend-icon="fas fa-book" variant="outlined">
    <template v-slot:title> Manage </template>

    <template v-slot:text>
      <p>Choose a .csv file of candidates to import.</p>

      <v-file-input label="Import CSV" ref="myFile" @change="selectedFile" accept=".csv" />
      <v-btn class="mr-2 mb-2" @click="resetCandidates">Reset candidates</v-btn>
      <v-btn class="mb-2" @click="resetWinners">Reset winners</v-btn>
    </template>
  </v-card>

  <v-expansion-panels>
    <v-expansion-panel>
      <v-expansion-panel-title prepend-icon="fas fa-floppy-disk">
        Backup / Restore
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <p class="text-body-2 mb-3">
          Export winners to a CSV spreadsheet, or save/load the full app state as JSON so data
          survives clearing browser storage or moving between devices.
        </p>
        <v-btn class="mr-2 mb-2" prepend-icon="fas fa-download" @click="exportWinners">
          Download winners CSV
        </v-btn>
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
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>

  <EventSettings @notify="notify" />

  <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="4000">
    {{ snackbarText }}
  </v-snackbar>
</template>
