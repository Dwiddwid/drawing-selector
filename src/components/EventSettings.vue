<script setup>
import { computed, watch } from 'vue'
import { useParticipantStore } from '../stores/participants.js'
import { useSettingsStore } from '../stores/settings.js'
import { collectExtraKeys } from '../utils/winnerDisplay.js'

const emit = defineEmits(['notify'])

const store = useParticipantStore()
const settings = useSettingsStore()

const fontOptions = ['Poppins', 'Inter', 'Arial', 'Georgia', 'Comic Sans MS', 'Courier New']
const backgroundStyles = [
  { title: 'Animated waves', value: 'waves' },
  { title: 'Solid color', value: 'solid' },
  { title: 'Custom image', value: 'image' },
]
const nameFormats = [
  { title: 'First Last', value: 'first-last' },
  { title: 'First only', value: 'first' },
  { title: 'Last, First', value: 'last-first' },
]

// Keep the configurable field list in sync with whatever columns exist in the
// current participant pool (candidates + winners).
const availableKeys = computed(() => collectExtraKeys(store.getParticipants))
watch(
  availableKeys,
  (keys) => settings.syncFields(keys),
  { immediate: true },
)

function readAsDataUrl(fileInput, key) {
  const file = fileInput?.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    emit('notify', 'Please choose an image file.', 'error')
    return
  }
  const reader = new FileReader()
  reader.onload = (evt) => settings.updateTheme({ [key]: evt.target.result })
  reader.onerror = () => emit('notify', 'Could not read that image.', 'error')
  reader.readAsDataURL(file)
}

function resetAll() {
  settings.resetSettings()
  settings.syncFields(availableKeys.value)
  emit('notify', 'Settings reset to defaults.', 'success')
}
</script>

<template>
  <v-expansion-panels>
    <!-- Pro account / dev toggle. TODO: replace with real license enforcement. -->
    <v-expansion-panel>
      <v-expansion-panel-title prepend-icon="fas fa-crown">Account</v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-switch
          :model-value="settings.isPro"
          @update:model-value="settings.setIsPro($event)"
          color="primary"
          hide-details
          :label="settings.isPro ? 'Pro features enabled' : 'Free plan'"
        />
        <p class="text-body-2 text-medium-emphasis mt-1">
          Custom theming and winner-display layout are Pro features.
        </p>
      </v-expansion-panel-text>
    </v-expansion-panel>

    <!-- Theme -->
    <v-expansion-panel>
      <v-expansion-panel-title prepend-icon="fas fa-palette">
        Theme &amp; branding
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <div class="pro-gate">
          <div :class="{ 'pro-locked': !settings.isPro }">
            <v-text-field
              :model-value="settings.theme.eventTitle"
              @update:model-value="settings.updateTheme({ eventTitle: $event })"
              label="Event title"
              density="compact"
            />

            <div class="d-flex flex-wrap ga-4 mb-4">
              <div v-for="c in ['primary', 'secondary', 'accent', 'background', 'surface']" :key="c">
                <div class="text-caption text-capitalize mb-1">{{ c }}</div>
                <v-color-picker
                  :model-value="settings.theme[c]"
                  @update:model-value="settings.updateTheme({ [c]: $event })"
                  mode="hexa"
                  hide-inputs
                  :modes="['hexa']"
                  width="180"
                />
              </div>
            </div>

            <v-select
              :model-value="settings.theme.fontFamily"
              @update:model-value="settings.updateTheme({ fontFamily: $event })"
              :items="fontOptions"
              label="Font"
              density="compact"
            />

            <v-radio-group
              :model-value="settings.theme.backgroundStyle"
              @update:model-value="settings.updateTheme({ backgroundStyle: $event })"
              inline
              label="Background"
            >
              <v-radio
                v-for="b in backgroundStyles"
                :key="b.value"
                :label="b.title"
                :value="b.value"
              />
            </v-radio-group>

            <v-file-input
              v-if="settings.theme.backgroundStyle === 'image'"
              label="Background image"
              accept="image/*"
              density="compact"
              @change="readAsDataUrl($event.target, 'backgroundImage')"
            />

            <v-file-input
              label="Event logo"
              accept="image/*"
              density="compact"
              @change="readAsDataUrl($event.target, 'logo')"
            />
            <v-btn
              v-if="settings.theme.logo"
              size="small"
              variant="text"
              @click="settings.updateTheme({ logo: null })"
              >Remove logo</v-btn
            >
          </div>
          <div v-if="!settings.isPro" class="pro-overlay">
            <font-awesome-icon icon="fas fa-lock" />
            <span class="ml-2">Pro feature — upgrade to customize</span>
          </div>
        </div>
      </v-expansion-panel-text>
    </v-expansion-panel>

    <!-- Winner display -->
    <v-expansion-panel>
      <v-expansion-panel-title prepend-icon="fas fa-id-card">
        Winner display
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <div class="pro-gate">
          <div :class="{ 'pro-locked': !settings.isPro }">
            <v-select
              :model-value="settings.winnerDisplay.nameFormat"
              @update:model-value="settings.updateWinnerDisplay({ nameFormat: $event })"
              :items="nameFormats"
              label="Name format"
              density="compact"
            />
            <v-switch
              :model-value="settings.winnerDisplay.showLabels"
              @update:model-value="settings.updateWinnerDisplay({ showLabels: $event })"
              color="primary"
              hide-details
              label="Show field labels (e.g. 'Grade: 3')"
              class="mb-2"
            />

            <p v-if="settings.winnerDisplay.fields.length === 0" class="text-body-2 text-medium-emphasis">
              Import participants with extra columns (Grade, Bus Route, …) to choose which fields
              appear on the drawing screen.
            </p>

            <v-list density="compact">
              <v-list-item
                v-for="(field, idx) in settings.winnerDisplay.fields"
                :key="field.key"
              >
                <template v-slot:prepend>
                  <v-checkbox
                    :model-value="field.visible"
                    @update:model-value="settings.setFieldVisible(field.key, $event)"
                    hide-details
                    density="compact"
                  />
                </template>
                <v-text-field
                  :model-value="field.label"
                  @update:model-value="settings.setFieldLabel(field.key, $event)"
                  :placeholder="field.key"
                  density="compact"
                  hide-details
                  variant="plain"
                />
                <template v-slot:append>
                  <v-btn
                    icon
                    size="x-small"
                    variant="text"
                    :disabled="idx === 0"
                    @click="settings.moveField(field.key, 'up')"
                    aria-label="Move field up"
                  >
                    <font-awesome-icon icon="fas fa-arrow-up" />
                  </v-btn>
                  <v-btn
                    icon
                    size="x-small"
                    variant="text"
                    :disabled="idx === settings.winnerDisplay.fields.length - 1"
                    @click="settings.moveField(field.key, 'down')"
                    aria-label="Move field down"
                  >
                    <font-awesome-icon icon="fas fa-arrow-down" />
                  </v-btn>
                </template>
              </v-list-item>
            </v-list>
          </div>
          <div v-if="!settings.isPro" class="pro-overlay">
            <font-awesome-icon icon="fas fa-lock" />
            <span class="ml-2">Pro feature — upgrade to customize</span>
          </div>
        </div>

        <v-btn class="mt-3" variant="text" size="small" @click="resetAll">
          Reset theme &amp; display
        </v-btn>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<style scoped>
.pro-gate {
  position: relative;
}
.pro-locked {
  pointer-events: none;
  opacity: 0.4;
  filter: grayscale(0.6);
}
.pro-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}
</style>
