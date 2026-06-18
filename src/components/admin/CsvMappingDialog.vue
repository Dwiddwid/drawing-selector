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
  { title: 'Skip', value: 'skip' },
]

// Editable per-column mapping, seeded from the alias auto-detection whenever a
// new file's headers arrive.
const mapping = ref([])
const mode = ref('replace')

watch(
  () => props.headers,
  (headers) => {
    mapping.value = suggestMapping(headers).map((m) => ({
      key: m.key,
      role: m.include ? m.role : 'skip',
      label: m.label,
    }))
    mode.value = 'replace'
  },
  { immediate: true },
)

const sample = (key) => props.preview[0]?.[key] ?? ''

const hasName = computed(() => mapping.value.some((m) => m.role === 'name'))

// Warn when two included columns map to the same label (they'd overwrite).
const duplicateLabel = computed(() => {
  const seen = new Set()
  for (const m of mapping.value) {
    if (m.role === 'skip') continue
    const label = (m.label || m.key).trim().toLowerCase()
    if (seen.has(label)) return true
    seen.add(label)
  }
  return false
})

const canImport = computed(() => hasName.value && !duplicateLabel.value)

function confirm() {
  if (!canImport.value) return
  const payload = mapping.value.map((m) => ({
    key: m.key,
    role: m.role,
    label: m.label,
    include: m.role !== 'skip',
  }))
  emit('confirm', { mapping: payload, mode: mode.value })
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
                  :disabled="m.role === 'skip'"
                  density="compact"
                  hide-details
                  variant="outlined"
                />
              </td>
            </tr>
          </tbody>
        </v-table>

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

        <div class="mt-4">
          <p class="text-body-2 mb-1">Add to the existing pool, or replace it?</p>
          <v-btn-toggle v-model="mode" mandatory density="compact" color="primary">
            <v-btn value="replace">Replace pool</v-btn>
            <v-btn value="append">Append</v-btn>
          </v-btn-toggle>
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
