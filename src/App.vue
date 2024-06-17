<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { useParticipantStore } from "./stores/participants.js";
import { onMounted } from 'vue'

const store = useParticipantStore();
onMounted(() => {
  var storageCandidates = localStorage.getItem("candidates");
  var storageWinners = localStorage.getItem("winners");
  var useMultiDisplayMode = localStorage.getItem("useMultiDisplayMode");
  if(storageCandidates != null){
    store.candidates = JSON.parse(storageCandidates);
  }
  if(storageWinners != null){
    store.winners = JSON.parse(storageWinners);
  }
  if(useMultiDisplayMode != null){
    store.useMultiDisplayMode = JSON.parse(useMultiDisplayMode)
  }
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

.v-application {
  background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB2aWV3Qm94PSIwIDAgODAwIDYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZDEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzAwYzZmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMDA3MmZmO3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZDIiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzAwNzJmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMDA0YmEwO3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZDMiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzAwNGJhMDtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMDAxZjRkO3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxmaWx0ZXIgaWQ9IndhdmUiIHg9IjAiIHk9IjAiPgogICAgICA8ZmVUdXJidWxlbmNlIGlkPSJzZWEtZmlsdGVyIiBudW1PY3RhdmVzPSIzIiBzZWVkPSIyIiBiYXNlRnJlcXVlbmN5PSIwLjAyIDAuMDUiPjwvZmVUdXJidWxlbmNlPgogICAgICA8ZmVEaXNwbGFjZW1lbnRNYXAgc2NhbGU9IjIwIiBpbj0iU291cmNlR3JhcGhpYyI+PC9mZURpc3BsYWNlbWVudE1hcD4KICAgICAgPGFuaW1hdGUgYXR0cmlidXRlTmFtZT0iYmFzZUZyZXF1ZW5jeSIgdmFsdWVzPSIwLjAyIDAuMDU7IDAuMDMgMC4wNjsgMC4wMiAwLjA1IiBkdXI9IjIwcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz4KICAgIDwvZmlsdGVyPgogIDwvZGVmcz4KICAKICA8cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0idXJsKCNncmFkMSkiIC8+CiAgPHJlY3QgeT0iMjAwIiB3aWR0aD0iODAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0idXJsKCNncmFkMikiIC8+CiAgPHJlY3QgeT0iNDAwIiB3aWR0aD0iODAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0idXJsKCNncmFkMykiIC8+CiAgCiAgPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI2MDAiIGZpbGw9InVybCgjZ3JhZDEpIiBmaWx0ZXI9InVybCgjd2F2ZSkiIG9wYWNpdHk9IjAuNyIvPgo8L3N2Zz4K') no-repeat center center fixed !important;
  background-size: cover !important;
}

.v-btn {
  border-radius: 20px;                 /* Rounded buttons for a softer look */
}


</style>
