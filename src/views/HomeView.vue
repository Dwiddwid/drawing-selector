<script setup>
import AdminPanel from '../components/AdminPanel.vue'
import Title from '../components/Title.vue'
import { useParticipantStore } from '../stores/participants.js'
import { useSettingsStore } from '../stores/settings.js'
import { ref } from 'vue'
import { postTrigger, postStop } from '../utils/sync.js'

const store = useParticipantStore()
const settings = useSettingsStore()
const multiDisplay = ref(store.useMultiDisplayMode)

// Tracks whether a 'manual'-timed draw the operator started is still spinning,
// so the button can flip between "Start draw" and "Stop".
const manualSpinning = ref(false)

function saveMultiDisplay() {
  store.setMultiDisplayMode(multiDisplay.value)
}

function selectWinner() {
  // Cross-tab trigger for multi-display mode. Works on the web
  // (BroadcastChannel) and in the portable file:// build (localStorage-event
  // fallback).
  postTrigger()
}

// Manual-timing flow: Start kicks off a free-spin on the drawing screen, Stop
// tells it to decelerate to the winner. Both travel the same channel as the
// regular trigger.
function startManualDraw() {
  postTrigger()
  manualSpinning.value = true
}

function stopManualDraw() {
  postStop()
  manualSpinning.value = false
}
</script>

<template>
  <v-main>
    <v-container fluid>
      <v-row>
        <v-col class="col-xs-12 col-md-6 d-flex align-items-center vh-100">
          <!-- <img alt="Spy" class="logo" src="@/assets/user-spy.svg" width="125" height="125" /> -->

          <v-row>
            <v-col>
              <Title :msg="settings.theme.eventTitle" />

              <v-row>
                <v-col>
                  <nav>
                    <v-btn to="/drawing">Start drawing</v-btn>
                    <!-- :target="store.useMultiDisplayMode ? '_blank' : ''" -->
                    <template v-if="store.useMultiDisplayMode">
                      <!-- Manual timing: a Start/Stop toggle drives the spin on
                           the drawing screen. Fixed/random just trigger once. -->
                      <template v-if="settings.drawTiming.mode === 'manual'">
                        <v-btn v-if="!manualSpinning" @click="startManualDraw">
                          Start draw
                        </v-btn>
                        <v-btn v-else color="error" @click="stopManualDraw">
                          Stop
                        </v-btn>
                      </template>
                      <v-btn v-else @click="selectWinner">Select winner</v-btn>
                    </template>
                  </nav>
                  <p
                    v-if="settings.drawTiming.mode === 'manual' && !store.useMultiDisplayMode"
                    class="text-caption text-medium-emphasis mt-1"
                  >
                    Manual stop timing needs the drawing screen open separately —
                    enable multi-display mode to start and stop draws from here.
                  </p>
                </v-col>
                <v-col>
                  <v-checkbox
                    label="Use multi display mode"
                    v-model="multiDisplay"
                    hide-details
                  ></v-checkbox>
                  <p class="text-caption text-medium-emphasis mt-1 mb-2">
                    Open the drawing on a second screen (e.g. a projector) and trigger each
                    draw from this window with “Select winner”.
                  </p>
                  <v-btn @click="saveMultiDisplay" v-if="multiDisplay != store.useMultiDisplayMode"
                    >Save</v-btn
                  >
                </v-col>
              </v-row>
            </v-col>
          </v-row>
        </v-col>
        <v-col class="col-xs-12 col-md-6 admin-col h-100">
          <AdminPanel />
        </v-col>
      </v-row>
    </v-container>
  </v-main>
</template>

<style></style>
