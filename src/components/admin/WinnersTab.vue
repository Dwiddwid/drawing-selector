<script setup>
import { ref, computed } from 'vue'
import { useParticipantStore } from '../../stores/participants.js'
import { filterParticipants } from '../../utils/search.js'
import { downloadWinnersCsv } from '../../utils/export.js'

const emit = defineEmits(['notify'])

const store = useParticipantStore()

const search = ref('')
const matchedWinners = computed(() => filterParticipants(store.winners, search.value))

const resetDialog = ref(false)

function exportWinners() {
  const ok = downloadWinnersCsv(store.winners)
  if (!ok) emit('notify', 'No winners to export yet.', 'warning')
}

function confirmReset(mode) {
  resetDialog.value = false
  const count = store.winners.length
  store.resetWinners(mode)
  if (count > 0) {
    emit(
      'notify',
      mode === 'return'
        ? `Returned ${count} winner${count === 1 ? '' : 's'} to the candidate pool.`
        : `Removed ${count} winner${count === 1 ? '' : 's'}.`,
      'info',
      () => store.undoResetWinners(),
    )
  }
}
</script>

<template>
  <v-card prepend-icon="fas fa-gift" variant="outlined">
    <template v-slot:title> Winners </template>

    <template v-slot:text>
      <p v-if="store.winners.length === 0" class="text-body-2 text-medium-emphasis">
        No winners yet — they'll appear here as draws complete.
      </p>
      <template v-else>
        <v-text-field
          v-if="store.winners.length > 10"
          v-model="search"
          label="Search winners"
          prepend-inner-icon="fas fa-magnifying-glass"
          density="compact"
          hide-details
          clearable
          class="mb-2"
        />
        <v-list lines="one" density="compact">
          <v-list-item
            v-for="participant in matchedWinners"
            :key="participant.id"
            :title="participant.firstName + ' ' + participant.lastName"
            :value="participant"
          />
        </v-list>
      </template>

      <div class="d-flex flex-wrap ga-2 mt-2">
        <v-btn prepend-icon="fas fa-download" @click="exportWinners">
          Download winners CSV
        </v-btn>
        <v-btn
          prepend-icon="fas fa-rotate-left"
          color="error"
          variant="tonal"
          :disabled="store.winners.length === 0"
          @click="resetDialog = true"
        >
          Reset winners
        </v-btn>
      </div>
    </template>
  </v-card>

  <v-dialog v-model="resetDialog" max-width="460">
    <v-card>
      <v-card-title>Reset winners?</v-card-title>
      <v-card-text>
        What should happen to the
        <strong>{{ store.winners.length }}</strong>
        past winner{{ store.winners.length === 1 ? '' : 's' }}?
        <em>Return to pool</em> puts them back into the draw;
        <em>Remove permanently</em> deletes them. Either way you'll get a short window to undo
        from the toast.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="resetDialog = false">Cancel</v-btn>
        <v-btn color="primary" variant="elevated" @click="confirmReset('return')">
          Return to pool
        </v-btn>
        <v-btn color="error" variant="elevated" @click="confirmReset('remove')">
          Remove permanently
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
