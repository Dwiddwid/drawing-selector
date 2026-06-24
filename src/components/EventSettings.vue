<script setup>
import { computed, ref, watch } from 'vue'
import { useParticipantStore } from '../stores/participants.js'
import { useSettingsStore } from '../stores/settings.js'
import { collectFieldKeys } from '../utils/winnerDisplay.js'
import { THEME_PRESETS } from '../utils/themePresets.js'
import { themeFromImageFile } from '../utils/themeFromImage.js'

const emit = defineEmits(['notify'])

const store = useParticipantStore()
const settings = useSettingsStore()

const fontOptions = ['Poppins', 'Inter', 'Arial', 'Georgia', 'Comic Sans MS', 'Courier New']
const backgroundStyles = [
  { title: 'Animated waves', value: 'waves' },
  { title: 'Solid color', value: 'solid' },
  { title: 'Gradient', value: 'gradient' },
  { title: 'Custom image', value: 'image' },
]
const animationStyles = [
  { title: 'Classic slot machine', value: 'classic' },
  { title: 'Spinning wheel', value: 'wheel' },
  { title: 'Giant wheel (names scroll past)', value: 'wheel-giant' },
  { title: 'Price Is Right wheel', value: 'reel' },
]

// Theme color pickers. Optional entries are overrides that fall back to
// another palette color when unset (null) — exactly how the drawing screen
// resolves them.
const colorFields = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'textColor', label: 'Text', fallback: 'primary', optional: true },
  { key: 'headlineColor', label: 'Headline', fallback: 'primary', optional: true },
  { key: 'winnerCardBg', label: 'Winner card', fallback: 'surface', optional: true },
  { key: 'winnerCardText', label: 'Winner card text', fallback: 'primary', optional: true },
]

function colorValue(field) {
  return settings.theme[field.key] ?? settings.theme[field.fallback]
}

const spinnerColorModes = [
  { title: 'Default palette', value: 'default' },
  { title: 'Match theme', value: 'theme' },
  { title: 'Custom colors', value: 'custom' },
]
const spinnerPositions = [
  { title: 'Left', value: 'left' },
  { title: 'Center', value: 'center' },
  { title: 'Right', value: 'right' },
]
// Styles that share the spinner appearance controls (segment colors + pointer).
// The Price Is Right wheel ('reel') reuses the segment palette and the pointer
// color (as its flapper color); the size/position/zoom sub-controls below stay
// gated to the standard and giant wheels.
const isWheelStyle = computed(
  () =>
    settings.animationStyle === 'wheel' ||
    settings.animationStyle === 'wheel-giant' ||
    settings.animationStyle === 'reel',
)

function setCustomColor(idx, value) {
  const customColors = [...settings.spinner.customColors]
  customColors[idx] = value
  settings.updateSpinner({ customColors })
}

function addCustomColor() {
  if (settings.spinner.customColors.length >= 8) return
  settings.updateSpinner({ customColors: [...settings.spinner.customColors, '#888888'] })
}

function removeCustomColor(idx) {
  if (settings.spinner.customColors.length <= 2) return
  settings.updateSpinner({
    customColors: settings.spinner.customColors.filter((_, i) => i !== idx),
  })
}

function applyPreset(preset) {
  settings.updateTheme(preset.theme)
  emit('notify', `Applied the "${preset.name}" theme.`, 'success')
}

// Theme-from-image: extract a palette, preview it, apply only on confirm.
const generated = ref(null) // { theme, swatches } | null

async function generateFromImage(fileInput) {
  const file = fileInput?.files?.[0]
  if (!file) return
  try {
    generated.value = await themeFromImageFile(file)
  } catch (err) {
    generated.value = null
    emit('notify', err.message || 'Could not analyze that image.', 'error')
  }
}

function applyGenerated() {
  if (!generated.value) return
  settings.updateTheme(generated.value.theme)
  generated.value = null
  emit('notify', 'Applied the generated theme.', 'success')
}

// Keep the configurable field list in sync with whatever columns exist in the
// current participant pool (candidates + winners).
const availableKeys = computed(() => collectFieldKeys(store.getParticipants))
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
              <v-btn
                v-for="p in THEME_PRESETS"
                :key="p.id"
                size="small"
                variant="tonal"
                @click="applyPreset(p)"
              >
                <span class="preset-swatches mr-2">
                  <span
                    v-for="(c, i) in [p.theme.primary, p.theme.secondary, p.theme.accent]"
                    :key="i"
                    class="preset-dot"
                    :style="{ background: c }"
                  />
                </span>
                {{ p.name }}
              </v-btn>
            </div>

            <v-file-input
              label="Generate theme from image"
              accept="image/*"
              density="compact"
              prepend-icon="fas fa-wand-magic-sparkles"
              @change="generateFromImage($event.target)"
            />
            <div v-if="generated" class="mb-4">
              <div class="d-flex align-center ga-2 mb-2">
                <span
                  v-for="(c, i) in generated.swatches"
                  :key="i"
                  class="generated-swatch"
                  :style="{ background: c }"
                />
              </div>
              <v-btn size="small" color="primary" class="mr-2" @click="applyGenerated">
                Apply generated theme
              </v-btn>
              <v-btn size="small" variant="text" @click="generated = null">Discard</v-btn>
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
              <div v-for="f in colorFields" :key="f.key">
                <div class="text-caption mb-1 d-flex align-center">
                  {{ f.label }}
                  <v-btn
                    v-if="f.optional && settings.theme[f.key]"
                    size="x-small"
                    variant="text"
                    class="ml-1"
                    @click="settings.updateTheme({ [f.key]: null })"
                  >
                    Auto
                  </v-btn>
                </div>
                <v-color-picker
                  :model-value="colorValue(f)"
                  @update:model-value="settings.updateTheme({ [f.key]: $event })"
                  mode="hexa"
                  hide-inputs
                  :modes="['hexa']"
                  width="180"
                />
              </div>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-3">
              Text, headline and winner-card colors follow the main palette automatically — pick
              one to override it; "Auto" returns to following the palette.
            </p>

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

            <div v-if="settings.theme.backgroundStyle === 'gradient'" class="mb-4">
              <div class="d-flex flex-wrap ga-4 mb-2">
                <div>
                  <div class="text-caption mb-1">Gradient from</div>
                  <v-color-picker
                    :model-value="settings.theme.backgroundGradient.from"
                    @update:model-value="
                      settings.updateTheme({
                        backgroundGradient: { ...settings.theme.backgroundGradient, from: $event },
                      })
                    "
                    mode="hexa"
                    hide-inputs
                    :modes="['hexa']"
                    width="180"
                  />
                </div>
                <div>
                  <div class="text-caption mb-1">Gradient to</div>
                  <v-color-picker
                    :model-value="settings.theme.backgroundGradient.to"
                    @update:model-value="
                      settings.updateTheme({
                        backgroundGradient: { ...settings.theme.backgroundGradient, to: $event },
                      })
                    "
                    mode="hexa"
                    hide-inputs
                    :modes="['hexa']"
                    width="180"
                  />
                </div>
              </div>
              <v-slider
                :model-value="settings.theme.backgroundGradient.angle"
                @update:model-value="
                  settings.updateTheme({
                    backgroundGradient: {
                      ...settings.theme.backgroundGradient,
                      angle: Math.round($event),
                    },
                  })
                "
                label="Angle"
                :min="0"
                :max="360"
                :step="5"
                thumb-label
                hide-details
              />
            </div>

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
              :model-value="settings.winnerDisplay.nameKeys"
              @update:model-value="settings.setNameKeys($event)"
              :items="availableKeys"
              label="Name fields (the headline)"
              hint="Choose which fields make up the big name shown on the drawing screen."
              persistent-hint
              multiple
              chips
              density="compact"
              class="mb-2"
            />
            <v-text-field
              :model-value="settings.winnerDisplay.nameSeparator"
              @update:model-value="settings.setNameSeparator($event)"
              label="Name separator"
              hint="Joins multiple name fields, e.g. a space or ', '."
              density="compact"
              class="mb-2"
            />
            <v-switch
              :model-value="settings.winnerDisplay.showLabels"
              @update:model-value="settings.updateWinnerDisplay({ showLabels: $event })"
              color="primary"
              hide-details
              label="Show field labels (e.g. 'Grade: 3')"
              class="mb-2"
            />
            <v-switch
              :model-value="settings.participantList.hideZeroEntries"
              @update:model-value="settings.updateParticipantList({ hideZeroEntries: $event })"
              color="primary"
              hide-details
              label="Hide 0-entry participants from the list"
              class="mb-2"
            />

            <v-divider class="my-3" />
            <div class="text-subtitle-2 mb-1">Multiple entries behavior</div>
            <v-radio-group
              :model-value="settings.participantList.entriesMode"
              @update:model-value="settings.updateParticipantList({ entriesMode: $event })"
              hide-details
              class="mb-2"
            >
              <v-radio value="odds" label="Increase draw odds — participant removed from pool when they win" />
              <v-radio value="multi-win" label="Consume one entry per win — participant stays until all entries used" />
            </v-radio-group>

            <v-divider class="my-3" />
            <div class="text-subtitle-2 mb-1">Win limit</div>
            <v-switch
              :model-value="settings.participantList.maxWinsPerParticipant !== null"
              @update:model-value="settings.updateParticipantList({ maxWinsPerParticipant: $event ? 1 : null })"
              color="primary"
              hide-details
              label="Cap maximum wins per participant"
              class="mb-2"
            />
            <v-text-field
              v-if="settings.participantList.maxWinsPerParticipant !== null"
              :model-value="settings.participantList.maxWinsPerParticipant"
              @update:model-value="settings.updateParticipantList({ maxWinsPerParticipant: Math.max(1, Math.floor(Number($event))) })"
              type="number"
              min="1"
              label="Maximum wins per participant"
              density="compact"
              hide-details
              style="max-width: 220px"
              class="mb-2"
            />

            <p v-if="settings.winnerDisplay.fields.length === 0" class="text-body-2 text-medium-emphasis">
              Import participants to choose which fields appear on the drawing screen and edit
              their labels.
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

            <template v-if="isWheelStyle">
              <v-divider class="my-3" />
              <div class="text-subtitle-2 mb-2">Spinner</div>

              <v-select
                :model-value="settings.spinner.colorMode"
                @update:model-value="settings.updateSpinner({ colorMode: $event })"
                :items="spinnerColorModes"
                label="Segment colors"
                density="compact"
              />

              <div v-if="settings.spinner.colorMode === 'custom'" class="d-flex flex-wrap align-center ga-2 mb-3">
                <span
                  v-for="(c, i) in settings.spinner.customColors"
                  :key="i"
                  class="custom-color"
                >
                  <input
                    type="color"
                    :value="c"
                    class="color-input"
                    :aria-label="`Segment color ${i + 1}`"
                    @input="setCustomColor(i, $event.target.value)"
                  />
                  <v-btn
                    icon
                    size="x-small"
                    variant="text"
                    :disabled="settings.spinner.customColors.length <= 2"
                    aria-label="Remove color"
                    @click="removeCustomColor(i)"
                  >
                    <font-awesome-icon icon="fas fa-xmark" />
                  </v-btn>
                </span>
                <v-btn
                  size="x-small"
                  variant="tonal"
                  :disabled="settings.spinner.customColors.length >= 8"
                  @click="addCustomColor"
                >
                  Add color
                </v-btn>
              </div>

              <div class="d-flex align-center ga-2 mb-3">
                <span class="text-body-2">{{
                  settings.animationStyle === 'reel' ? 'Flapper color' : 'Pointer color'
                }}</span>
                <input
                  type="color"
                  :value="settings.spinner.pointerColor"
                  class="color-input"
                  :aria-label="settings.animationStyle === 'reel' ? 'Flapper color' : 'Pointer color'"
                  @input="settings.updateSpinner({ pointerColor: $event.target.value })"
                />
              </div>

              <template v-if="settings.animationStyle === 'wheel-giant'">
                <v-slider
                  :model-value="settings.spinner.giantZoom"
                  @update:model-value="settings.updateSpinner({ giantZoom: $event })"
                  label="Wheel zoom"
                  :min="2"
                  :max="6"
                  :step="0.25"
                  thumb-label
                  hide-details
                  class="mb-1"
                />
                <p class="text-body-2 text-medium-emphasis">
                  Zoom enlarges the wheel beyond the screen so each name gets bigger — useful for
                  big pools (hundreds of participants). Higher zoom also means fewer names visible
                  at once as they scroll past.
                </p>
              </template>

              <template v-if="settings.animationStyle === 'wheel'">
                <p class="text-body-2 text-medium-emphasis mb-2">
                  Standard wheel size, position, and offsets apply only to the spinning wheel
                  display — the giant wheel is always full-screen.
                </p>
                <v-slider
                  :model-value="settings.spinner.size"
                  @update:model-value="settings.updateSpinner({ size: Math.round($event) })"
                  label="Wheel size"
                  :min="280"
                  :max="1200"
                  :step="10"
                  thumb-label
                  hide-details
                  class="mb-2"
                />
                <v-radio-group
                  :model-value="settings.spinner.position"
                  @update:model-value="settings.updateSpinner({ position: $event })"
                  inline
                  label="Position"
                  hide-details
                  class="mb-2"
                >
                  <v-radio
                    v-for="p in spinnerPositions"
                    :key="p.value"
                    :label="p.title"
                    :value="p.value"
                  />
                </v-radio-group>
                <v-slider
                  :model-value="settings.spinner.offsetX"
                  @update:model-value="settings.updateSpinner({ offsetX: Math.round($event) })"
                  label="Fine-tune X offset"
                  :min="-300"
                  :max="300"
                  :step="5"
                  thumb-label
                  hide-details
                />
                <v-slider
                  :model-value="settings.spinner.offsetY"
                  @update:model-value="settings.updateSpinner({ offsetY: Math.round($event) })"
                  label="Fine-tune Y offset"
                  :min="-200"
                  :max="200"
                  :step="5"
                  thumb-label
                  hide-details
                  class="mb-1"
                />
                <p class="text-body-2 text-medium-emphasis">
                  Position anchors the wheel (left, center, or right); offsets fine-tune it from
                  the anchor point in pixels.
                </p>
              </template>
            </template>

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
.preset-swatches {
  display: inline-flex;
  gap: 2px;
}
.preset-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.2);
}
.generated-swatch {
  display: inline-block;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.2);
}
.custom-color {
  display: inline-flex;
  align-items: center;
}
.color-input {
  width: 36px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.25);
  border-radius: 4px;
  background: none;
  cursor: pointer;
}
</style>
