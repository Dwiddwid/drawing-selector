<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { useParticipantStore } from "./stores/participants.js";
import { onMounted } from 'vue'

const store = useParticipantStore();
onMounted(() => {
  store.loadFromStorage();
})
</script>

<template>
  <v-app theme="oceanTheme">
    <RouterView /></v-app>
</template>

<style>
*::-webkit-scrollbar {
  display: none;
}
body {
  font-family: 'Poppins', sans-serif;  /* or another clean, readable font */
  background-color: #e0f7fa;           /* Light Aqua background */
  color: #1e3d59;                      /* Deep Blue text */
}

a {
  color: #FF6F61;                      /* Coral for links */
}

.v-btn {
  border-radius: 20px;                 /* Rounded buttons for a softer look */
}


</style>
