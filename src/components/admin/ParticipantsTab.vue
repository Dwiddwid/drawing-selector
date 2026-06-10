<script setup>
import { ref, computed, watch } from 'vue'
import { useParticipantStore } from '../../stores/participants.js'
import { filterParticipants } from '../../utils/search.js'

const emit = defineEmits(['notify'])

const store = useParticipantStore()

// Search + pagination keep the list usable with large pools (hundreds or
// thousands of rows) instead of rendering everything at once.
const PAGE_SIZE = 50
const search = ref('')
const page = ref(1)

const matchedCandidates = computed(() => filterParticipants(store.candidates, search.value))
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
    emit('notify', 'Enter at least a first or last name.', 'warning')
    return
  }
  store.updateCandidate(editingId.value, { firstName: first, lastName: last })
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

function addParticipant() {
  const first = newFirst.value.trim()
  const last = newLast.value.trim()
  if (!first && !last) {
    emit('notify', 'Enter at least a first or last name.', 'warning')
    return
  }
  store.addCandidate({ firstName: first, lastName: last })
  newFirst.value = ''
  newLast.value = ''
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
        }}<template v-if="search"> match</template>
      </p>

      <v-list lines="one" density="compact">
        <v-list-item
          v-for="participant in pagedCandidates"
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

      <v-pagination
        v-if="pageCount > 1"
        v-model="page"
        :length="pageCount"
        density="compact"
        total-visible="7"
        class="mt-1"
      />

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
</template>
