<script setup>
import { ref } from 'vue'
import ParticipantsTab from './admin/ParticipantsTab.vue'
import WinnersTab from './admin/WinnersTab.vue'
import DataTab from './admin/DataTab.vue'
import EventSettings from './EventSettings.vue'

// Thin tabbed shell — each tab owns its own logic and reports back through the
// shared `notify` snackbar (with an optional undo action).
const tab = ref('participants')

const snackbar = ref(false)
const snackbarColor = ref('success')
const snackbarText = ref('')
const snackbarUndo = ref(null) // function or null — shows "Undo" when set

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
</script>

<template>
  <v-card variant="outlined">
    <v-tabs v-model="tab" color="primary" grow>
      <v-tab value="participants" prepend-icon="fas fa-people-group">Participants</v-tab>
      <v-tab value="winners" prepend-icon="fas fa-gift">Winners</v-tab>
      <v-tab value="setup" prepend-icon="fas fa-palette">Event Setup</v-tab>
      <v-tab value="data" prepend-icon="fas fa-book">Data</v-tab>
    </v-tabs>

    <v-card-text>
      <v-tabs-window v-model="tab">
        <v-tabs-window-item value="participants">
          <ParticipantsTab @notify="notify" />
        </v-tabs-window-item>
        <v-tabs-window-item value="winners">
          <WinnersTab @notify="notify" />
        </v-tabs-window-item>
        <v-tabs-window-item value="setup">
          <EventSettings @notify="notify" />
        </v-tabs-window-item>
        <v-tabs-window-item value="data">
          <DataTab @notify="notify" />
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card-text>
  </v-card>

  <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="6000">
    {{ snackbarText }}
    <template v-if="snackbarUndo" v-slot:actions>
      <v-btn variant="text" @click="runUndo">Undo</v-btn>
    </template>
  </v-snackbar>
</template>
