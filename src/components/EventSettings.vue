<script setup>
import { computed, ref, watch } from 'vue'
import { useParticipantStore } from '../stores/participants.js'
import { useSettingsStore } from '../stores/settings.js'
import { collectExtraKeys } from '../utils/winnerDisplay.js'
import { THEME_PRESETS } from '../utils/themePresets.js'
import { imageToPalette, paletteToTheme } from '../utils/palette.js'

const emit = defineEmits(['notify'])

const store = useParticipantStore()
const settings = useSettingsStore()

const presets = THEME_PRESETS
const fontOptions = ['Poppins', 'Inter', 'Arial', 'Georgia', 'Comic Sans MS', 'Courier New']
const buttonRoundnessOptions = [
  { title: 'Pill', value: 'pill' },
  { title: 'Rounded', value: 'rounded' },
  { title: 'Square', value: 'square' },
]
const pointerPositions = [
  { title: 'Top', value: 'top' },
  { title: 'Right', value: 'right' },
  { title: 'Bottom', value: 'bottom' },
  { title: 'Left', value: 'left' },
]

// The wheel's segment colors default to the theme palette (plus a few fixed
// accents) until the operator sets a custom list.
const themeSegmentColors = computed(() => {
  const t = settings.theme
  return [t.primary, t.secondary, t.accent, '#ffcf48', '#7ed957', '#b39ddb', '#f48fb1', '#4dd0e1']
})
const segmentColors = computed(() => settings.spinner.segmentColors ?? themeSegmentColors.value)
const usingThemeSegments = computed(() => settings.spinner.segmentColors == null)

function setSegmentColor(idx, value) {
  const next = [...segmentColors.value]
  next[idx] = value
  settings.updateSpinner({ segmentColors: next })
}
function addSegmentColor() {
  settings.updateSpinner({ segmentColors: [...segmentColors.value, '#cccccc'] })
}
function removeSegmentColor(idx) {
  const next = segmentColors.value.filter((_, i) => i !== idx)
  settings.updateSpinner({ segmentColors: next.length ? next : null })
}
function resetSegmentColors() {
  settings.updateSpinner({ segmentColors: null })
}

// Image → theme. Extract a palette, preview it, and apply on confirm so a bad
// auto-result doesn't clobber the operator's current colors.
const generatedTheme = ref(null)
function generateFromImage(target) {
  const file = target?.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    emit('notify', 'Please choose an image file.', 'error')
    return
  }
  const reader = new FileReader()
  reader.onload = async (evt) => {
    try {
      const palette = await imageToPalette(evt.target.result)
      generatedTheme.value = paletteToTheme(palette)
    } catch (err) {
      emit('notify', err.message || 'Could not process that image.', 'error')
    }
  }
  reader.onerror = () => emit('notify', 'Could not read that image.', 'error')
  reader.readAsDataURL(file)
}
function applyGeneratedTheme() {
  if (!generatedTheme.value) return
  settings.updateTheme(generatedTheme.value)
  generatedTheme.value = null
  emit('notify', 'Theme applied from image.', 'success')
}
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
const animationStyles = [
  { title: 'Classic slot machine', value: 'classic' },
  { title: 'Spinning wheel', value: 'wheel' },
  { title: 'Giant wheel (names scroll past)', value: 'wheel-giant' },
  { title: 'Vertical reel', value: 'reel' },
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
            <div class="text-caption mb-1">Preset themes</div>
            <div class="d-flex flex-wrap ga-2 mb-4">
              <button
                v-for="preset in presets"
                :key="preset.id"
                type="button"
                class="preset-swatch"
                :title="preset.name"
                @click="settings.applyPreset(preset.colors)"
              >
                <span :style="{ background: preset.colors.primary }" />
                <span :style="{ background: preset.colors.secondary }" />
                <span :style="{ background: preset.colors.accent }" />
                <span :style="{ background: preset.colors.background }" />
                <small>{{ preset.name }}</small>
              </button>
            </div>

            <v-text-field
              :model-value="settings.theme.eventTitle"
              @update:model-value="settings.updateTheme({ eventTitle: $event })"
              label="Event title"
              density="compact"
            />
            <v-switch
              :model-value="settings.theme.showEventTitle"
              @update:model-value="settings.updateTheme({ showEventTitle: $event })"
              color="primary"
              hide-details
              label="Show event title on the drawing screen"
              class="mb-2"
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

            <div class="d-flex flex-wrap ga-4 mb-4">
              <div>
                <div class="text-caption mb-1">
                  Heading color
                  <v-btn
                    v-if="settings.theme.headingColor"
                    size="x-small"
                    variant="text"
                    @click="settings.updateTheme({ headingColor: null })"
                    >use primary</v-btn
                  >
                </div>
                <v-color-picker
                  :model-value="settings.theme.headingColor || settings.theme.primary"
                  @update:model-value="settings.updateTheme({ headingColor: $event })"
                  mode="hexa"
                  hide-inputs
                  :modes="['hexa']"
                  width="180"
                />
              </div>
              <div>
                <div class="text-caption mb-1">
                  Winner name color
                  <v-btn
                    v-if="settings.theme.winnerNameColor"
                    size="x-small"
                    variant="text"
                    @click="settings.updateTheme({ winnerNameColor: null })"
                    >use primary</v-btn
                  >
                </div>
                <v-color-picker
                  :model-value="settings.theme.winnerNameColor || settings.theme.primary"
                  @update:model-value="settings.updateTheme({ winnerNameColor: $event })"
                  mode="hexa"
                  hide-inputs
                  :modes="['hexa']"
                  width="180"
                />
              </div>
            </div>

            <v-file-input
              label="Generate theme from image"
              accept="image/*"
              density="compact"
              prepend-icon="fas fa-wand-magic-sparkles"
              @change="generateFromImage($event.target)"
            />
            <div v-if="generatedTheme" class="d-flex align-center ga-2 mb-3">
              <span class="text-caption">Preview:</span>
              <span
                v-for="key in ['primary', 'secondary', 'accent', 'background', 'surface']"
                :key="key"
                class="gen-swatch"
                :style="{ background: generatedTheme[key] }"
              />
              <v-btn size="small" color="primary" @click="applyGeneratedTheme">Apply</v-btn>
              <v-btn size="small" variant="text" @click="generatedTheme = null">Discard</v-btn>
            </div>

            <v-select
              :model-value="settings.theme.fontFamily"
              @update:model-value="settings.updateTheme({ fontFamily: $event })"
              :items="fontOptions"
              label="Font"
              density="compact"
            />

            <v-select
              :model-value="settings.theme.buttonRoundness"
              @update:model-value="settings.updateTheme({ buttonRoundness: $event })"
              :items="buttonRoundnessOptions"
              label="Button shape"
              density="compact"
            />

            <div class="text-caption">Winner card opacity</div>
            <v-slider
              :model-value="settings.theme.cardOpacity"
              @update:model-value="settings.updateTheme({ cardOpacity: $event })"
              :min="0.5"
              :max="1"
              :step="0.05"
              density="compact"
              hide-details
              thumb-label
              class="mb-2"
            />
            <div class="text-caption">Winner card blur</div>
            <v-slider
              :model-value="settings.theme.cardBlur"
              @update:model-value="settings.updateTheme({ cardBlur: $event })"
              :min="0"
              :max="20"
              :step="1"
              density="compact"
              hide-details
              thumb-label
              class="mb-2"
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

    <!-- Spinner -->
    <v-expansion-panel>
      <v-expansion-panel-title prepend-icon="fas fa-arrows-spin">
        Spinner
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <div class="pro-gate">
          <div :class="{ 'pro-locked': !settings.isPro }">
            <p class="text-body-2 text-medium-emphasis mb-2">
              Applies to the Spinning wheel and Giant wheel reveal styles.
            </p>

            <div class="d-flex align-center justify-space-between mb-1">
              <div class="text-caption">Segment colors</div>
              <v-btn
                v-if="!usingThemeSegments"
                size="x-small"
                variant="text"
                @click="resetSegmentColors"
                >Use theme colors</v-btn
              >
            </div>
            <div class="d-flex flex-wrap ga-2 mb-3">
              <div
                v-for="(color, idx) in segmentColors"
                :key="idx"
                class="segment-chip"
              >
                <input
                  type="color"
                  :value="color.slice(0, 7)"
                  @input="setSegmentColor(idx, $event.target.value)"
                  aria-label="Segment color"
                />
                <v-btn
                  icon
                  size="x-small"
                  variant="text"
                  :disabled="segmentColors.length <= 1"
                  @click="removeSegmentColor(idx)"
                  aria-label="Remove color"
                >
                  <font-awesome-icon icon="fas fa-xmark" />
                </v-btn>
              </div>
              <v-btn size="x-small" variant="tonal" @click="addSegmentColor">
                <font-awesome-icon icon="fas fa-plus" class="mr-1" /> Add
              </v-btn>
            </div>

            <div class="text-caption mb-1">Pointer color</div>
            <v-color-picker
              :model-value="settings.spinner.pointerColor || settings.theme.accent"
              @update:model-value="settings.updateSpinner({ pointerColor: $event })"
              mode="hexa"
              hide-inputs
              :modes="['hexa']"
              width="180"
              class="mb-3"
            />

            <v-select
              :model-value="settings.spinner.pointerPosition"
              @update:model-value="settings.updateSpinner({ pointerPosition: $event })"
              :items="pointerPositions"
              label="Pointer position (standard wheel)"
              density="compact"
            />

            <div class="text-caption">Wheel size</div>
            <v-slider
              :model-value="settings.spinner.wheelScale"
              @update:model-value="settings.updateSpinner({ wheelScale: $event })"
              :min="0.6"
              :max="1.4"
              :step="0.1"
              density="compact"
              hide-details
              thumb-label
            />
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

    <!-- Animation & celebration -->
    <v-expansion-panel>
      <v-expansion-panel-title prepend-icon="fas fa-wand-magic-sparkles">
        Animation &amp; celebration
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <div class="pro-gate">
          <div :class="{ 'pro-locked': !settings.isPro }">
            <v-select
              :model-value="settings.animationStyle"
              @update:model-value="settings.setAnimationStyle($event)"
              :items="animationStyles"
              label="Reveal animation"
              density="compact"
            />
            <v-switch
              :model-value="settings.celebration.confetti"
              @update:model-value="settings.updateCelebration({ confetti: $event })"
              color="primary"
              hide-details
              label="Confetti on winner reveal"
            />
            <v-switch
              :model-value="settings.celebration.sound"
              @update:model-value="settings.updateCelebration({ sound: $event })"
              color="primary"
              hide-details
              label="Celebration sound on winner reveal"
            />
            <p class="text-body-2 text-medium-emphasis mt-2">
              Some browsers block sound until you've interacted with the drawing tab.
            </p>
          </div>
          <div v-if="!settings.isPro" class="pro-overlay">
            <font-awesome-icon icon="fas fa-lock" />
            <span class="ml-2">Pro feature — upgrade to customize</span>
          </div>
        </div>
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
.preset-swatch {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 64px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: transparent;
  padding: 0;
}
.preset-swatch > span {
  height: 14px;
}
.preset-swatch small {
  font-size: 10px;
  padding: 2px 0;
  background: #fff;
  color: #333;
}
.gen-swatch {
  display: inline-block;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.15);
}
.segment-chip {
  display: flex;
  align-items: center;
}
.segment-chip input[type='color'] {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
}
</style>
