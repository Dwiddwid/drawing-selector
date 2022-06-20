<script setup>
import { useParticipantStore } from "../stores/participants.js";

const store = useParticipantStore();

</script>

<template>
  <div class="container-fluid">
    <div tabindex="0" class="row name-display d-flex">
      <div class="col">
        <div class="scaled-text">
          <h1 v-if="store.index < 0">Ready to start drawing!</h1>
          <h1 v-else-if="store.winnerSelected">Winner!</h1>
          <div v-if="store.index > -1">
            <h2>
              {{store.candidates[store.index]['First Name']}} {{store.currentCandidate['Last Name']}}
            </h2>
            <div class="mb-4">{{store.currentCandidate['School Grade']}}</div>
          </div>
        </div>
        <button type="button" class="btn btn-primary mt-4" v-if="!store.spinning" v-on:click="store.selectRandomCandidate()">GO!</button>
      </div>
    </div>
  </div>
</template>

<style>
button {
  width: 100%;
}
@media (min-width: 1024px) {
  .scaled-text * {
    font-size: 4vw;
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
</style>
