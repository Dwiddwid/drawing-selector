<script setup>
import { ref, watch } from 'vue'
import { detectDelimiter } from '../../utils/csv.js'

// Paste-a-list entry point: a textarea for names copied from anywhere — a
// plain one-per-line list, or a block of spreadsheet cells (tab-separated).
// Confirm hands the raw text to DataTab, which parses it and opens the same
// column-mapping dialog the CSV file import uses.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const text = ref('')
const hasHeader = ref(false)
// Only auto-toggle the header checkbox until the operator touches it.
let headerTouched = false

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      text.value = ''
      hasHeader.value = false
      headerTouched = false
    }
  },
)

// Heuristic: a tab-separated paste is a block of spreadsheet cells, which
// nearly always carries a header row. Everything else defaults to "no header".
// Deliberately conservative — guessing "header" wrongly *consumes a
// participant* (a "Lovelace, Ada" list would lose its first person), while
// guessing "no header" wrongly just shows one obvious junk row in the preview.
watch(text, (value) => {
  if (headerTouched) return
  const firstLine = String(value).split(/\r\n|\r|\n/, 1)[0] ?? ''
  hasHeader.value = firstLine.trim() !== '' && detectDelimiter(value) === '\t'
})

function onHeaderInput(v) {
  headerTouched = true
  hasHeader.value = Boolean(v)
}

function close() {
  emit('update:modelValue', false)
}

function cancel() {
  close()
  emit('cancel')
}

function confirm() {
  close()
  emit('confirm', { text: text.value, hasHeader: hasHeader.value })
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="(v) => !v && cancel()"
    max-width="640"
  >
    <v-card>
      <v-card-title>Paste a list</v-card-title>
      <v-card-text>
        <v-textarea
          v-model="text"
          label="Participants"
          rows="10"
          auto-grow
          autofocus
          hint="One name per line, or paste cells straight from a spreadsheet."
          persistent-hint
        />
        <v-checkbox
          :model-value="hasHeader"
          @update:model-value="onHeaderInput"
          label="First row is a header row"
          density="compact"
          hide-details
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancel">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          :disabled="text.trim() === ''"
          @click="confirm"
        >
          Continue
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
