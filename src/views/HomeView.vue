<script setup>
import AdminPanel from '../components/AdminPanel.vue'
import Title from '../components/Title.vue'
import { useParticipantStore } from '../stores/participants.js'
import { useSettingsStore } from '../stores/settings.js'
import { ref } from 'vue'

const bc = new BroadcastChannel('drawing_trigger')

const store = useParticipantStore()
const settings = useSettingsStore()
const multiDisplay = ref(store.useMultiDisplayMode)

function saveMultiDisplay() {
  store.setMultiDisplayMode(multiDisplay.value)
}

function selectWinner() {
  bc.postMessage('Go!')
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
                    <v-btn v-if="store.useMultiDisplayMode" @click="selectWinner">
                      Select winner
                    </v-btn>
                  </nav>
                </v-col>
                <v-col>
                  <v-checkbox label="Use multi display mode" v-model="multiDisplay"></v-checkbox>
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
