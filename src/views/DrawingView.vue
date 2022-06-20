<script setup>
import { useParticipantStore } from "../stores/participants.js";

const store = useParticipantStore();

</script>

<template>
  <div tabindex="0" class="name-display">
    <div>
      <h1 v-if="store.index < 0">Ready to start drawing!</h1>
      <div v-else>
        {{store.candidates[store.index]['First Name']}} {{store.currentCandidate['Last Name']}}
      </div>
      <button type="button" v-if="!store.spinning" v-on:click="store.selectRandomCandidate()">GO!</button>
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
    display: flex;
  }

  .name-display, .name-display * {
    justify-content: center;
    align-items: center;
  }
}
</style>
