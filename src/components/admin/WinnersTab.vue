<script setup>
import { ref, computed } from 'vue'
import { useParticipantStore } from '../../stores/participants.js'
import { filterParticipants } from '../../utils/search.js'
import { downloadWinnersCsv } from '../../utils/export.js'

const emit = defineEmits(['notify'])

const store = useParticipantStore()

const search = ref('')
const matchedWinners = computed(() => filterParticipants(store.winners, search.value))

function exportWinners() {
  const ok = downloadWinnersCsv(store.winners)
  if (!ok) emit('notify', 'No winners to export yet.', 'warning')
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

      <v-btn class="mt-2" prepend-icon="fas fa-download" @click="exportWinners">
        Download winners CSV
      </v-btn>
    </template>
  </v-card>
</template>
