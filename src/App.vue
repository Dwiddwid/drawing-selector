<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { useParticipantStore } from "./stores/participants.js";
import { onMounted } from 'vue'

const store = useParticipantStore();
onMounted(() => {
  var storageCandidates = localStorage.getItem("candidates");
  var storageWinners = localStorage.getItem("winners");
  if(storageCandidates != null){
    store.candidates = JSON.parse(storageCandidates);
  }
  if(storageWinners != null){
    store.winners = JSON.parse(storageWinners);
  }
})
</script>

<template>
  <v-app>
    <RouterView /></v-app>
</template>

<style>



</style>
