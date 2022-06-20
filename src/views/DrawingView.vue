<script setup>
import { useParticipantStore } from "../stores/participants.js";

const store = useParticipantStore();

</script>

<template>
  <div tabindex="0" class="name-display d-flex">
    <div class="d-flex-column align-items-center">
      <h1 v-if="store.index < 0">Ready to start drawing!</h1>
      <h1 v-else-if="store.winnerSelected">Winner!</h1>
      <h2 v-if="store.index > -1">
        {{store.candidates[store.index]['First Name']}} {{store.currentCandidate['Last Name']}}
      </h2>
      <div class="mb-4">{{store.currentCandidate['School Grade']}}</div>
      <button type="button" class="btn btn-primary mt-4" v-if="!store.spinning" v-on:click="store.selectRandomCandidate()">GO!</button>
    </div>
  </div>
</template>

<style>
button {
  width: 100%;
}
@media (min-width: 1024px) {
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
</style>
