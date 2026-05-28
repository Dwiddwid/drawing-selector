<script setup>
import { useParticipantStore } from "../stores/participants.js";

const store = useParticipantStore();
const bc = new BroadcastChannel('drawing_trigger');
bc.onmessage = (event) => {
  store.selectRandomCandidate();
}

</script>

<template>
  <v-main>
    <v-container fluid fill-height class="text-center d-flex align-center fill-height">
      <v-card round class="mx-auto" elevation="8">
        <v-card-title>
          <h1 v-if="store.spinning" class="display-3 font-weight-thin">And the Winner Is...</h1>
          <h1 v-else-if="!store.selected" class="display-3 font-weight-thin">Ready to start drawing!</h1>
        </v-card-title>

        <v-card-text>
          <div class="scaled-text">
            <div v-if="store.spinning && store.currentCandidate">
              <h2>
                {{ store.currentCandidate.firstName }} {{ store.currentCandidate.lastName }}
              </h2>
            </div>
            <div v-else-if="store.selected">
              <h2>
                {{ store.selected.firstName }} {{ store.selected.lastName }}
              </h2>
              <template v-for="[label, value] in Object.entries(store.selected.extras || {})" :key="label">
                <div v-if="value" class="mb-2">{{ label }}: {{ value }}</div>
              </template>
            </div>
          </div>
        </v-card-text>

        <v-card-actions v-if="!store.useMultiDisplayMode">

          <v-btn v-show="!store.spinning" :disabled="store.candidates.length === 0" variant="elevated" color="primary" v-on:click="store.selectRandomCandidate()">GO!</v-btn>
          <div v-if="store.candidates.length === 0 && !store.spinning" class="text-medium-emphasis mt-2">No participants loaded — import a CSV first.</div>
        </v-card-actions>
        
      </v-card>
    </v-container>
  </v-main>
</template>

<style scoped>
button {
  width: 100%;
}
@media (min-width: 1024px) {
  .scaled-text * {
    font-size: 8vw;
  }
  .name-display {
    min-height: 100vh;
    min-width:100vw;
  }

  .name-display, .name-display * {
    justify-content: center;
    align-items: center;
    text-align: center;
  }
}

.v-card {
  background: #e0f2f1; /* Light teal for cards */
}

.v-btn {
  background-color: #2980b9; /* Dark blue accent for button */
}

h1,
h2 {
  color: #2980b9; /* Dark blue accent for text */
}
</style>
