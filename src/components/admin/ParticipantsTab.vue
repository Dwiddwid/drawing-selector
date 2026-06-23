<script setup>
import { ref, computed, watch } from 'vue'
import { useParticipantStore } from '../../stores/participants.js'
import { useSettingsStore } from '../../stores/settings.js'
import { filterParticipants } from '../../utils/search.js'
import { formatWinnerName, collectFieldKeys } from '../../utils/winnerDisplay.js'
import { entryWeight } from '../../utils/csv.js'
import { postManualTrigger } from '../../utils/sync.js'

const emit = defineEmits(['notify'])

const store = useParticipantStore()
const settings = useSettingsStore()

// The fields that compose the headline drive the add/edit inputs. Fall back to
// a single generic "Name" field for a fresh pool with no name config yet.
const nameKeys = computed(() => {
  const keys = settings.winnerDisplay.nameKeys
  return keys && keys.length ? keys : ['Name']
})
function labelFor(key) {
  const f = settings.winnerDisplay.fields.find((f) => f.key === key)
  return f?.label || key
}
function colSpan(count) {
  return Math.max(2, Math.floor(10 / count))
}
// Narrower budget for the add row, which also hosts the entries + Add columns.
function addColSpan(count) {
  return Math.max(2, Math.floor(8 / count))
}
const displayName = (p) => formatWinnerName(p, settings.winnerDisplay) || '(no name)'
const entriesOf = (p) => entryWeight(p)

// Whether any candidate carries a non-default entry count — drives whether the
// per-row ×N badge and the total-entries summary are worth showing.
const hasWeights = computed(() => store.candidates.some((c) => entryWeight(c) !== 1))

// Search + pagination keep the list usable with large pools (hundreds or
// thousands of rows) instead of rendering everything at once.
const PAGE_SIZE = 50
const search = ref('')
const page = ref(1)

const matchedCandidates = computed(() => {
  let list = filterParticipants(store.candidates, search.value)
  if (settings.participantList.hideZeroEntries) {
    list = list.filter((p) => entryWeight(p) !== 0)
  }
  return list
})
const pageCount = computed(() => Math.max(1, Math.ceil(matchedCandidates.value.length / PAGE_SIZE)))
const pagedCandidates = computed(() =>
  matchedCandidates.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
)

watch(search, () => {
  page.value = 1
})
// Keep the page in range when the list shrinks (removals, resets, new search).
watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

// Add/edit inputs keyed by name field. Reset when the set of name fields changes.
const newFields = ref({})
const newEntries = ref(1)
const editingId = ref(null)
const editFields = ref({})

watch(nameKeys, () => {
  newFields.value = {}
  newEntries.value = 1
})

const pendingKey = ref(null)
const pendingValue = ref(null)

// Filterable keys are detail fields (exclude the headline/name fields) that
// aren't already an active filter.
const availableFilterKeys = computed(() => {
  const activeKeys = new Set(store.filters.map((f) => f.key))
  const names = new Set(nameKeys.value)
  return collectFieldKeys(store.candidates).filter((k) => !activeKeys.has(k) && !names.has(k))
})

const availableFilterValues = computed(() =>
  pendingKey.value
    ? [...new Set(store.candidates.map((c) => c.fields?.[pendingKey.value]).filter(Boolean))]
    : [],
)

const editEntries = ref(1)

function startEdit(participant) {
  editingId.value = participant.id
  const e = {}
  for (const k of nameKeys.value) e[k] = participant.fields?.[k] ?? ''
  editFields.value = e
  editEntries.value = entryWeight(participant)
}

function saveEdit() {
  if (!editingId.value) return
  const fields = {}
  for (const k of nameKeys.value) fields[k] = (editFields.value[k] ?? '').trim()
  if (Object.values(fields).every((v) => !v)) {
    emit('notify', 'Enter at least one name field.', 'warning')
    return
  }
  const entries = Math.max(0, Math.floor(Number(editEntries.value) || 0))
  store.updateCandidate(editingId.value, { fields, entries })
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

function addParticipant() {
  const fields = {}
  for (const k of nameKeys.value) {
    const v = (newFields.value[k] ?? '').trim()
    if (v) fields[k] = v
  }
  if (Object.keys(fields).length === 0) {
    emit('notify', 'Enter at least one name field.', 'warning')
    return
  }
  const entries = Math.max(0, Math.floor(Number(newEntries.value) || 0))
  store.addCandidate(fields, entries)
  newFields.value = {}
  newEntries.value = 1
}

// Delete with an undo affordance, matching how resets behave. Capture the row
// and its position first so the toast's Undo can splice it back where it was.
function removeParticipant(participant) {
  const index = store.candidates.findIndex((c) => c.id === participant.id)
  if (index === -1) return
  const snapshot = { ...participant, fields: { ...(participant.fields ?? {}) } }
  store.removeCandidate(participant.id)
  emit('notify', `Removed ${displayName(participant)}.`, 'info', () =>
    store.insertCandidate(snapshot, index),
  )
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

function manualWin(participant, show) {
  if (show) {
    postManualTrigger(participant.id)
    emit('notify', `${displayName(participant)} sent to drawing screen.`, 'success')
  } else {
    store.manuallySelectWinner(participant.id)
    emit('notify', `${displayName(participant)} added to winners.`, 'success')
  }
}
</script>

<template>
  <v-card prepend-icon="fas fa-people-group" variant="outlined" class="mb-4">
    <template v-slot:title> Participants </template>

    <template v-slot:text>
      <v-text-field
        v-model="search"
        label="Search by name or any field"
        prepend-inner-icon="fas fa-magnifying-glass"
        density="compact"
        hide-details
        clearable
        class="mb-2"
      />
      <p class="text-body-2 text-medium-emphasis mb-1">
        {{ matchedCandidates.length }} of {{ store.candidates.length }} candidate{{
          store.candidates.length === 1 ? '' : 's'
        }}<template v-if="search"> match</template><template v-if="hasWeights">
          · {{ store.totalEntries }} total entr{{ store.totalEntries === 1 ? 'y' : 'ies' }}</template>
      </p>

      <v-list lines="one" density="compact">
        <v-list-item
          v-for="participant in pagedCandidates"
          :key="participant.id"
          :value="participant"
        >
          <template v-if="editingId === participant.id">
            <v-row dense align="center" class="py-1">
              <v-col v-for="key in nameKeys" :key="key" :cols="colSpan(nameKeys.length)">
                <v-text-field
                  v-model="editFields[key]"
                  :label="labelFor(key)"
                  density="compact"
                  hide-details
                  @keyup.enter="saveEdit"
                  @keyup.escape="cancelEdit"
                />
              </v-col>
              <v-col cols="2">
                <v-text-field
                  v-model.number="editEntries"
                  label="Entries"
                  type="number"
                  min="0"
                  density="compact"
                  hide-details
                  @keyup.enter="saveEdit"
                  @keyup.escape="cancelEdit"
                />
              </v-col>
            </v-row>
          </template>
          <template v-else>
            {{ displayName(participant) }}
            <v-chip
              v-if="entriesOf(participant) !== 1"
              size="x-small"
              variant="tonal"
              color="primary"
              class="ml-2"
            >
              ×{{ entriesOf(participant) }}
            </v-chip>
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
                @click="removeParticipant(participant)"
                aria-label="Remove participant"
              >
                <font-awesome-icon icon="fas fa-trash" />
              </v-btn>
              <v-menu>
                <template #activator="{ props: menuProps }">
                  <v-btn
                    icon
                    size="x-small"
                    variant="text"
                    color="warning"
                    v-bind="menuProps"
                    aria-label="Select as winner"
                  >
                    <font-awesome-icon icon="fas fa-crown" />
                  </v-btn>
                </template>
                <v-list density="compact">
                  <v-list-item
                    prepend-icon="fas fa-list-check"
                    title="Add to winners (silent)"
                    @click="manualWin(participant, false)"
                  />
                  <v-list-item
                    prepend-icon="fas fa-tv"
                    title="Show on screen"
                    @click="manualWin(participant, true)"
                  />
                </v-list>
              </v-menu>
            </template>
          </template>
        </v-list-item>
      </v-list>

      <v-pagination
        v-if="pageCount > 1"
        v-model="page"
        :length="pageCount"
        density="compact"
        total-visible="7"
        class="mt-1"
      />

      <v-row class="mt-2" dense align="center">
        <v-col v-for="key in nameKeys" :key="key" :cols="addColSpan(nameKeys.length)">
          <v-text-field
            v-model="newFields[key]"
            :label="labelFor(key)"
            density="compact"
            hide-details
            @keyup.enter="addParticipant"
          />
        </v-col>
        <v-col cols="2">
          <v-text-field
            v-model.number="newEntries"
            label="Entries"
            type="number"
            min="0"
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
</template>
