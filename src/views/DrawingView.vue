<script setup>
import { computed } from 'vue'
import { useParticipantStore } from '../stores/participants.js'
import { useSettingsStore } from '../stores/settings.js'
import { formatWinnerName, visibleWinnerFields } from '../utils/winnerDisplay.js'
import { createTriggerChannel } from '../utils/platform.js'

const store = useParticipantStore()
const settings = useSettingsStore()
// Cross-tab trigger for multi-display mode. Uses BroadcastChannel on the web and
// a localStorage-event fallback in the portable (file://) Offline Edition, so a
// remote draw works in both. Still falls back to this screen's own GO! button.
const bc = createTriggerChannel()
bc?.onMessage(() => {
  store.selectRandomCandidate()
})

const winnerName = computed(() =>
  store.selected ? formatWinnerName(store.selected, settings.winnerDisplay.nameFormat) : '',
)
const detailRows = computed(() =>
  store.selected ? visibleWinnerFields(store.selected, settings.winnerDisplay) : [],
)
</script>

<template>
  <v-main>
    <v-container fluid fill-height class="text-center d-flex flex-column align-center justify-center fill-height">
      <img
        v-if="settings.theme.logo"
        :src="settings.theme.logo"
        alt="Event logo"
        class="event-logo mb-4"
      />
      <h1 v-if="settings.theme.eventTitle" class="event-title mb-4">
        {{ settings.theme.eventTitle }}
      </h1>

      <v-card round class="mx-auto winner-card" elevation="8">
        <v-card-title>
          <h1 v-if="store.spinning" class="display-3 font-weight-thin">And the Winner Is...</h1>
          <h1 v-else-if="!store.selected" class="display-3 font-weight-thin">
            Ready to start drawing!
          </h1>
        </v-card-title>

        <v-card-text>
          <div class="scaled-text">
            <div v-if="store.spinning && store.currentCandidate">
              <h2>{{ store.currentCandidate.firstName }} {{ store.currentCandidate.lastName }}</h2>
            </div>
            <div v-else-if="store.selected">
              <h2>{{ winnerName }}</h2>
              <div v-for="row in detailRows" :key="row.key" class="mb-2">
                <template v-if="settings.winnerDisplay.showLabels">{{ row.label }}: </template
                >{{ row.value }}
              </div>
            </div>
          </div>
        </v-card-text>

        <v-card-actions v-if="!store.useMultiDisplayMode">
          <v-btn
            v-show="!store.spinning"
            :disabled="store.candidates.length === 0"
            variant="elevated"
            color="primary"
            v-on:click="store.selectRandomCandidate()"
            >GO!</v-btn
          >
          <div
            v-if="store.candidates.length === 0 && !store.spinning"
            class="text-medium-emphasis mt-2"
          >
            No participants loaded — import a CSV first.
          </div>
        </v-card-actions>
      </v-card>
    </v-container>
  </v-main>
</template>

<style scoped>
button {
  width: 100%;
}
.event-logo {
  max-height: 20vh;
  max-width: 80vw;
  object-fit: contain;
}
.event-title {
  color: rgb(var(--v-theme-primary));
}
@media (min-width: 1024px) {
  .scaled-text * {
    font-size: 8vw;
  }
  .name-display {
    min-height: 100vh;
    min-width: 100vw;
  }

  .name-display,
  .name-display * {
    justify-content: center;
    align-items: center;
    text-align: center;
  }
}

.winner-card {
  background: rgb(var(--v-theme-surface));
}

.winner-card .v-btn {
  background-color: rgb(var(--v-theme-primary));
}

.winner-card h1,
.winner-card h2 {
  color: rgb(var(--v-theme-primary));
}
</style>
