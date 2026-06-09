<script setup>
import { useParticipantStore } from '../stores/participants.js'
import { useSettingsStore, mergeSettings } from '../stores/settings.js'
import { parseParticipantsCsv } from '../utils/csv.js'
import { downloadWinnersCsv, exportStateJson, deserializeState } from '../utils/export.js'
import { ref, computed, watch } from 'vue'
import EventSettings from './EventSettings.vue'

const store = useParticipantStore()
const settings = useSettingsStore()

// --- Large-pool admin helpers ----------------------------------------------
const candidateSearch = ref('')
const winnerSearch = ref('')
const showCandidates = ref(true)
const showWinners = ref(true)
const compact = ref(localStorage.getItem('adminCompact') === 'true')
watch(compact, (v) => localStorage.setItem('adminCompact', String(v)))
const listDensity = computed(() => (compact.value ? 'compact' : 'comfortable'))
const rowHeight = computed(() => (compact.value ? 44 : 56))

const filteredCandidates = computed(() => {
  const q = candidateSearch.value.trim().toLowerCase()
  if (!q) return store.candidates
  return store.candidates.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(q),
  )
})
const filteredWinners = computed(() => {
  const q = winnerSearch.value.trim().toLowerCase()
  if (!q) return store.winners
  return store.winners.filter((w) =>
    `${w.firstName} ${w.lastName}`.toLowerCase().includes(q),
  )
})

// Bulk selection. The Set is reassigned on every change so Vue tracks it.
const selectedIds = ref(new Set())
function toggleSelect(id) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}
const allFilteredSelected = computed(
  () =>
    filteredCandidates.value.length > 0 &&
    filteredCandidates.value.every((c) => selectedIds.value.has(c.id)),
)
function toggleSelectAll() {
  const next = new Set(selectedIds.value)
  if (allFilteredSelected.value) {
    filteredCandidates.value.forEach((c) => next.delete(c.id))
  } else {
    filteredCandidates.value.forEach((c) => next.add(c.id))
  }
  selectedIds.value = next
}
function removeSelected() {
  const ids = [...selectedIds.value]
  if (ids.length === 0) return
  store.removeCandidates(ids)
  selectedIds.value = new Set()
  notify(`Removed ${ids.length} candidate${ids.length === 1 ? '' : 's'}.`, 'info')
}

const myFile = ref(null)
const stateFile = ref(null)
const snackbar = ref(false)
const snackbarColor = ref('success')
const snackbarText = ref('')
const snackbarUndo = ref(null) // function or null — shows "Undo" when set

// Reset-confirmation dialog. `pendingReset` is 'candidates' | 'winners' | null.
const pendingReset = ref(null)
const resetCounts = {
  candidates: () => store.candidates.length,
  winners: () => store.winners.length,
}
const pendingResetCount = computed(() =>
  pendingReset.value ? resetCounts[pendingReset.value]() : 0,
)

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

function notify(text, color, undoAction = null) {
  snackbarText.value = text
  snackbarColor.value = color
  snackbarUndo.value = undoAction
  snackbar.value = true
}

function runUndo() {
  if (typeof snackbarUndo.value === 'function') snackbarUndo.value()
  snackbar.value = false
  snackbarUndo.value = null
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

function askResetCandidates() {
  if (store.candidates.length === 0) {
    // Nothing to lose — just clear quietly without the modal.
    confirmReset('candidates')
    return
  }
  pendingReset.value = 'candidates'
}

function askResetWinners() {
  if (store.winners.length === 0) {
    confirmReset('winners', 'return')
    return
  }
  pendingReset.value = 'winners'
}

function cancelReset() {
  pendingReset.value = null
}

// Called in two ways:
//   confirmReset()                          — from the dialog; reads pendingReset
//   confirmReset('candidates')              — direct bypass when the pool is empty
//   confirmReset('winners', 'return'|'eliminate') — winner reset mode
function confirmReset(kind, mode = 'return') {
  const target = kind ?? pendingReset.value
  pendingReset.value = null
  if (target === 'candidates') {
    const count = store.candidates.length
    store.resetCandidates()
    myFile.value = null
    pendingKey.value = null
    pendingValue.value = null
    editingId.value = null
    selectedIds.value = new Set()
    if (count > 0) {
      notify(
        `Cleared ${count} candidate${count === 1 ? '' : 's'}.`,
        'info',
        () => store.undoResetCandidates(),
      )
    }
  } else if (target === 'winners') {
    const count = store.winners.length
    store.resetWinners(mode)
    if (count > 0) {
      const what = mode === 'return' ? 'returned to the pool' : 'eliminated'
      notify(
        `${count} winner${count === 1 ? '' : 's'} ${what}.`,
        'info',
        () => store.undoResetWinners(),
      )
    }
  }
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
    <template v-slot:title>
      <div class="d-flex align-center">
        <span>Participants ({{ store.candidates.length }})</span>
        <v-spacer />
        <v-switch
          :model-value="compact"
          @update:model-value="compact = $event"
          density="compact"
          hide-details
          color="primary"
          label="Compact"
          class="mr-2 flex-grow-0"
        />
        <v-btn
          icon
          size="small"
          variant="text"
          @click="showCandidates = !showCandidates"
          :aria-label="showCandidates ? 'Collapse list' : 'Expand list'"
        >
          <font-awesome-icon :icon="showCandidates ? 'fas fa-chevron-up' : 'fas fa-chevron-down'" />
        </v-btn>
      </div>
    </template>

    <template v-slot:text>
      <div v-show="showCandidates">
        <v-text-field
          v-model="candidateSearch"
          label="Search participants"
          density="compact"
          hide-details
          clearable
          prepend-inner-icon="fas fa-magnifying-glass"
          class="mb-2"
        />

        <div class="d-flex align-center mb-1">
          <v-checkbox
            :model-value="allFilteredSelected"
            @update:model-value="toggleSelectAll"
            density="compact"
            hide-details
            :label="`Select all (${filteredCandidates.length})`"
            class="flex-grow-0"
          />
          <v-spacer />
          <v-btn
            v-if="selectedIds.size > 0"
            size="small"
            color="error"
            variant="tonal"
            @click="removeSelected"
          >
            Remove selected ({{ selectedIds.size }})
          </v-btn>
        </div>

        <v-virtual-scroll
          v-if="filteredCandidates.length"
          :items="filteredCandidates"
          :height="Math.min(360, filteredCandidates.length * rowHeight)"
          :item-height="rowHeight"
        >
          <template v-slot:default="{ item: participant }">
            <v-list-item :key="participant.id" :density="listDensity">
              <template v-slot:prepend>
                <v-checkbox
                  :model-value="selectedIds.has(participant.id)"
                  @update:model-value="toggleSelect(participant.id)"
                  density="compact"
                  hide-details
                  class="flex-grow-0"
                />
              </template>

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
          </template>
        </v-virtual-scroll>
        <p v-else class="text-body-2 text-medium-emphasis">
          {{ store.candidates.length ? 'No matches for that search.' : 'No participants yet.' }}
        </p>
      </div>

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
    <template v-slot:title>
      <div class="d-flex align-center">
        <span>Winners ({{ store.winners.length }})</span>
        <v-spacer />
        <v-btn
          icon
          size="small"
          variant="text"
          @click="showWinners = !showWinners"
          :aria-label="showWinners ? 'Collapse list' : 'Expand list'"
        >
          <font-awesome-icon :icon="showWinners ? 'fas fa-chevron-up' : 'fas fa-chevron-down'" />
        </v-btn>
      </div>
    </template>

    <template v-slot:text>
      <div v-show="showWinners">
        <v-text-field
          v-if="store.winners.length > 8"
          v-model="winnerSearch"
          label="Search winners"
          density="compact"
          hide-details
          clearable
          prepend-inner-icon="fas fa-magnifying-glass"
          class="mb-2"
        />
        <v-virtual-scroll
          v-if="filteredWinners.length"
          :items="filteredWinners"
          :height="Math.min(320, filteredWinners.length * rowHeight)"
          :item-height="rowHeight"
        >
          <template v-slot:default="{ item: participant }">
            <v-list-item
              :key="participant.id"
              :density="listDensity"
              :title="participant.firstName + ' ' + participant.lastName"
            />
          </template>
        </v-virtual-scroll>
        <p v-else class="text-body-2 text-medium-emphasis">
          {{ store.winners.length ? 'No matches for that search.' : 'No winners yet.' }}
        </p>
      </div>
    </template>
  </v-card>

  <v-card prepend-icon="fas fa-book" variant="outlined">
    <template v-slot:title> Manage </template>

    <template v-slot:text>
      <p>Choose a .csv file of candidates to import.</p>

      <v-file-input label="Import CSV" ref="myFile" @change="selectedFile" accept=".csv" />
      <v-btn class="mr-2 mb-2" @click="askResetCandidates">Reset candidates</v-btn>
      <v-btn class="mb-2" @click="askResetWinners">Reset winners</v-btn>
    </template>
  </v-card>

  <v-dialog :model-value="pendingReset !== null" @update:model-value="(v) => !v && cancelReset()" max-width="460">
    <v-card v-if="pendingReset === 'candidates'">
      <v-card-title>Reset candidates?</v-card-title>
      <v-card-text>
        This will clear
        <strong>{{ pendingResetCount }}</strong>
        candidate{{ pendingResetCount === 1 ? '' : 's' }}.
        You'll get a short window to undo from the toast.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancelReset">Cancel</v-btn>
        <v-btn color="error" variant="elevated" @click="confirmReset('candidates')">Reset</v-btn>
      </v-card-actions>
    </v-card>

    <v-card v-else-if="pendingReset === 'winners'">
      <v-card-title>Reset winners?</v-card-title>
      <v-card-text>
        You have <strong>{{ pendingResetCount }}</strong>
        winner{{ pendingResetCount === 1 ? '' : 's' }}. Choose what happens to them:
        <ul class="mt-2">
          <li><strong>Return to pool</strong> — they can be drawn again.</li>
          <li><strong>Eliminate</strong> — they're removed from the running entirely.</li>
        </ul>
        You'll get a short window to undo from the toast.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancelReset">Cancel</v-btn>
        <v-btn color="primary" variant="tonal" @click="confirmReset('winners', 'return')">
          Return to pool
        </v-btn>
        <v-btn color="error" variant="elevated" @click="confirmReset('winners', 'eliminate')">
          Eliminate
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

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

  <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="6000">
    {{ snackbarText }}
    <template v-if="snackbarUndo" v-slot:actions>
      <v-btn variant="text" @click="runUndo">Undo</v-btn>
    </template>
  </v-snackbar>
</template>
