<script setup>
import { ref, computed, watch } from 'vue'
import { suggestMapping } from '../../utils/csv.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  headers: { type: Array, default: () => [] },
  preview: { type: Array, default: () => [] },
  rowCount: { type: Number, default: 0 },
})
const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const roleOptions = [
  { title: 'Name / Title', value: 'name' },
  { title: 'Detail field', value: 'detail' },
  { title: 'ID', value: 'id' },
  { title: 'Entries / count', value: 'entries' },
  { title: 'Skip', value: 'skip' },
]

// Roles that are identity/weight metadata, not display fields — their label is
// irrelevant (they never render on the winner card).
const META_ROLES = ['id', 'entries', 'skip']

// Editable per-column mapping, seeded from the alias auto-detection whenever a
// new file's headers arrive.
const mapping = ref([])
// Import target: 'replace' the pool or 'add' to it. `countRepeats` only applies
// when adding — it turns repeat people into extra entries (the daily-check-in
// "accumulate" behavior) instead of skipping them as duplicates.
const mode = ref('replace')
const countRepeats = ref(false)

watch(
  () => props.headers,
  (headers) => {
    mapping.value = suggestMapping(headers).map((m) => ({
      key: m.key,
      role: m.include ? m.role : 'skip',
      label: m.label,
    }))
    mode.value = 'replace'
    countRepeats.value = false
  },
  { immediate: true },
)

// Collapse the two-way choice + checkbox back into the import mode the store
// understands: 'replace' | 'append' | 'accumulate'.
const effectiveMode = computed(() => {
  if (mode.value === 'replace') return 'replace'
  return countRepeats.value ? 'accumulate' : 'append'
})

const sample = (key) => props.preview[0]?.[key] ?? ''

const hasName = computed(() => mapping.value.some((m) => m.role === 'name'))

// Warn when two included columns map to the same label (they'd overwrite).
// Only name/detail columns become display fields, so only they can collide.
const duplicateLabel = computed(() => {
  const seen = new Set()
  for (const m of mapping.value) {
    if (m.role !== 'name' && m.role !== 'detail') continue
    const label = (m.label || m.key).trim().toLowerCase()
    if (seen.has(label)) return true
    seen.add(label)
  }
  return false
})

// At most one column may carry the id / entries role.
const duplicateMeta = computed(() => {
  const idCount = mapping.value.filter((m) => m.role === 'id').length
  const entriesCount = mapping.value.filter((m) => m.role === 'entries').length
  return idCount > 1 || entriesCount > 1
})

const canImport = computed(() => hasName.value && !duplicateLabel.value && !duplicateMeta.value)

function confirm() {
  if (!canImport.value) return
  const payload = mapping.value.map((m) => ({
    key: m.key,
    role: m.role,
    label: m.label,
    include: m.role !== 'skip',
  }))
  emit('confirm', { mapping: payload, mode: effectiveMode.value })
}

function cancel() {
  emit('update:modelValue', false)
  emit('cancel')
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="(v) => !v && cancel()"
    max-width="720"
    scrollable
  >
    <v-card>
      <v-card-title>Map CSV columns</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-3">
          Choose how each of the {{ headers.length }} column{{ headers.length === 1 ? '' : 's' }}
          in this file ({{ rowCount }} row{{ rowCount === 1 ? '' : 's' }}) maps onto your draw.
          Mark at least one column as <em>Name / Title</em>.
        </p>

        <v-table density="compact">
          <thead>
            <tr>
              <th>Column</th>
              <th>Sample</th>
              <th style="width: 150px">Role</th>
              <th style="width: 200px">Display label</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in mapping" :key="m.key">
              <td class="font-weight-medium">{{ m.key }}</td>
              <td class="text-medium-emphasis text-truncate" style="max-width: 140px">
                {{ sample(m.key) }}
              </td>
              <td>
                <v-select
                  v-model="m.role"
                  :items="roleOptions"
                  density="compact"
                  hide-details
                  variant="outlined"
                />
              </td>
              <td>
                <v-text-field
                  v-model="m.label"
                  :placeholder="m.key"
                  :disabled="META_ROLES.includes(m.role)"
                  density="compact"
                  hide-details
                  variant="outlined"
                />
              </td>
            </tr>
          </tbody>
        </v-table>

        <p class="text-caption text-medium-emphasis mt-2 mb-0">
          <strong>Name / Title</strong> shows as the winner headline ·
          <strong>Detail</strong> = extra info on the winner card ·
          <strong>ID</strong> de-duplicates rows across imports ·
          <strong>Entries</strong> = how many tickets each row gets ·
          <strong>Skip</strong> ignores the column.
        </p>

        <v-alert
          v-if="!hasName"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          Mark at least one column as <strong>Name / Title</strong> to import.
        </v-alert>
        <v-alert
          v-else-if="duplicateLabel"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          Two included columns share the same label — give them distinct labels.
        </v-alert>
        <v-alert
          v-else-if="duplicateMeta"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          Use at most one <strong>ID</strong> column and one <strong>Entries / count</strong> column.
        </v-alert>

        <div class="mt-4">
          <p class="text-body-2 font-weight-medium mb-1">How should this file be imported?</p>
          <v-radio-group v-model="mode" hide-details density="compact" class="mt-0">
            <v-radio value="replace">
              <template v-slot:label>
                <div>
                  <div>Replace the pool</div>
                  <div class="text-caption text-medium-emphasis">
                    Clear the current candidates and use this file as the new pool.
                  </div>
                </div>
              </template>
            </v-radio>
            <v-radio value="add">
              <template v-slot:label>
                <div>
                  <div>Add to the existing pool</div>
                  <div class="text-caption text-medium-emphasis">
                    Keep the current candidates and add the people from this file.
                  </div>
                </div>
              </template>
            </v-radio>
          </v-radio-group>

          <v-checkbox
            v-model="countRepeats"
            :disabled="mode !== 'add'"
            hide-details
            density="compact"
            class="ms-6 mt-1"
          >
            <template v-slot:label>
              <div>
                <div>Count repeat people as extra entries</div>
                <div class="text-caption text-medium-emphasis">
                  For daily check-in lists — someone already in the pool gets another entry instead
                  of being skipped as a duplicate.
                </div>
              </div>
            </template>
          </v-checkbox>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancel">Cancel</v-btn>
        <v-btn color="primary" variant="elevated" :disabled="!canImport" @click="confirm">
          Import
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
