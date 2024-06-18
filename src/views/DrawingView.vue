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
          <h1 v-if="store.index < 0" class="display-3 font-weight-thin">Ready to start drawing!</h1>
          <h1 v-else-if="store.spinning" class="display-3 font-weight-thin">And the Winner Is...</h1>
        </v-card-title>
        
        <v-card-text>
          <div class="scaled-text">
            <div v-if="store.index > -1">
              <h2>
                {{store.candidates[store.index]['First Name']}} {{store.currentCandidate['Last Name']}}
              </h2>
              <div class="mb-4">{{store.currentCandidate['School Grade']}}</div>
            </div>
          </div>
        </v-card-text>

        <v-card-actions v-if="!store.useMultiDisplayMode">
        
          <v-btn v-show="!store.spinning" variant="elevated" color="primary" v-on:click="store.selectRandomCandidate()">GO!</v-btn>
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

body {
    margin: 0;
    padding: 0;
    height: 100vh;
    background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB2aWV3Qm94PSIwIDAgODAwIDYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZDEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzAwYzZmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMDA3MmZmO3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZDIiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzAwNzJmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMDA0YmEwO3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZDMiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzAwNGJhMDtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMDAxZjRkO3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxmaWx0ZXIgaWQ9IndhdmUiIHg9IjAiIHk9IjAiPgogICAgICA8ZmVUdXJidWxlbmNlIGlkPSJzZWEtZmlsdGVyIiBudW1PY3RhdmVzPSIzIiBzZWVkPSIyIiBiYXNlRnJlcXVlbmN5PSIwLjAyIDAuMDUiPjwvZmVUdXJidWxlbmNlPgogICAgICA8ZmVEaXNwbGFjZW1lbnRNYXAgc2NhbGU9IjIwIiBpbj0iU291cmNlR3JhcGhpYyI+PC9mZURpc3BsYWNlbWVudE1hcD4KICAgICAgPGFuaW1hdGUgYXR0cmlidXRlTmFtZT0iYmFzZUZyZXF1ZW5jeSIgdmFsdWVzPSIwLjAyIDAuMDU7IDAuMDMgMC4wNjsgMC4wMiAwLjA1IiBkdXI9IjIwcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz4KICAgIDwvZmlsdGVyPgogIDwvZGVmcz4KICAKICA8cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0idXJsKCNncmFkMSkiIC8+CiAgPHJlY3QgeT0iMjAwIiB3aWR0aD0iODAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0idXJsKCNncmFkMikiIC8+CiAgPHJlY3QgeT0iNDAwIiB3aWR0aD0iODAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0idXJsKCNncmFkMykiIC8+CiAgCiAgPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI2MDAiIGZpbGw9InVybCgjZ3JhZDEpIiBmaWx0ZXI9InVybCgjd2F2ZSkiIG9wYWNpdHk9IjAuNyIvPgo8L3N2Zz4K') no-repeat center center fixed;
    background-size: cover;
  }

/* body {
  background-color: #d1e0e0; /* Light blue base color * /
  color: #333333; /* Dark grey text color * /
} */

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
