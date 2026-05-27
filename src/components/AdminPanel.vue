<script setup>
import { useParticipantStore } from "../stores/participants.js";
import { parseParticipantsCsv } from "../utils/csv.js";
import { ref } from "vue";

const store = useParticipantStore();

const myFile = ref(null);
const snackbar = ref(false);
const snackbarColor = ref("success");
const snackbarText = ref("");

function notify(text, color) {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
}

function selectedFile() {
  const file = myFile.value?.files?.[0];
  if (!file) return;

  const looksLikeCsv =
    /\.csv$/i.test(file.name) || (file.type && file.type.includes("csv"));
  if (!looksLikeCsv) {
    notify("Please choose a .csv file.", "error");
    return;
  }

  const reader = new FileReader();
  reader.readAsText(file, "UTF-8");
  reader.onload = (evt) => {
    try {
      const participants = parseParticipantsCsv(evt.target.result);
      if (participants.length === 0) {
        notify("No participants found in that file.", "warning");
        return;
      }
      const { imported, skipped } = store.importParticipants(participants);
      notify(
        `Imported ${imported} participant${imported === 1 ? "" : "s"}` +
          (skipped ? ` (skipped ${skipped} previous winner${skipped === 1 ? "" : "s"})` : ""),
        "success"
      );
    } catch (err) {
      notify(err.message || "Could not read that file.", "error");
    }
  };
  reader.onerror = () => {
    notify("Could not read that file.", "error");
  };
}

function resetCandidates() {
  store.resetCandidates();
  myFile.value = null;
}

function resetWinners() {
  store.resetWinners();
}
</script>

<template>
  <v-card prepend-icon="fas fa-people-group" variant="outlined">
    <template v-slot:title>
      Participants
    </template>

    <template v-slot:text>
      <v-list lines="one" density="compact">
        <v-list-item v-for="participant in store.getParticipants" :key="participant.id"
          :title="participant.firstName + ' ' + participant.lastName" :value="participant"></v-list-item>
      </v-list>
    </template>
  </v-card>
  <v-card prepend-icon="fas fa-gift" variant="outlined">
    <template v-slot:title>
      Winners
    </template>

    <template v-slot:text>
      <v-list lines="one" density="compact">
        <v-list-item v-for="participant in store.winners" :key="participant.id"
          :title="participant.firstName + ' ' + participant.lastName" :value="participant"></v-list-item>
      </v-list>
    </template>
  </v-card>

  <v-card prepend-icon="fas fa-book" variant="outlined">
    <template v-slot:title>
      Manage
    </template>

    <template v-slot:text>
      <p>Choose a .csv file of candidates to import.</p>

      <v-file-input label="File input" ref="myFile" @change="selectedFile"></v-file-input>
      <v-btn @click="resetCandidates">Reset candidates</v-btn>
      <v-btn @click="resetWinners">Reset winners</v-btn>
    </template>
  </v-card>

  <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="4000">
    {{ snackbarText }}
  </v-snackbar>
</template>

<style>
/* .admin-panel{
  padding-left: 2rem;
} */
</style>