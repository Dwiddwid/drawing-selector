<script setup>
// End-of-batch roster card: all winners from the just-finished multi-winner
// draw. Rendered by DrawingView either as a wheel-center overlay (it passes
// the winner-overlay class) or in normal flow.
defineProps({
  names: { type: Array, required: true },
  title: { type: String, default: 'Our winners!' },
  // Optional muted footnote, e.g. the pool-ran-out shortfall notice.
  note: { type: String, default: '' },
})
</script>

<template>
  <v-card round class="winner-card roster-card" elevation="12">
    <v-card-text class="roster-content">
      <h2 v-if="title" class="roster-title">{{ title }}</h2>
      <div class="roster-grid">
        <div v-for="(name, i) in names" :key="i" class="roster-name">
          {{ name }}
        </div>
      </div>
      <div v-if="note" class="roster-note">{{ note }}</div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.roster-card {
  background: var(--app-winner-card-bg, rgb(var(--v-theme-surface)));
  color: var(--app-winner-card-text, rgb(var(--v-theme-primary)));
  max-width: min(92vw, 80vmin);
}
.roster-content {
  text-align: center;
  padding: clamp(0.75rem, 2vmin, 1.5rem) clamp(1rem, 3vmin, 2rem) !important;
}
.roster-title {
  font-size: clamp(1.25rem, 4vmin, 2.25rem);
  line-height: 1.15;
  margin-bottom: clamp(0.5rem, 1.5vmin, 1rem);
  color: var(--app-winner-card-text, rgb(var(--v-theme-primary)));
}
.roster-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: clamp(0.4rem, 1.2vmin, 0.8rem) clamp(0.9rem, 2.5vmin, 1.75rem);
}
.roster-name {
  font-size: clamp(1.2rem, 4vmin, 2.75rem);
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.roster-note {
  margin-top: clamp(0.5rem, 1.5vmin, 1rem);
  font-size: clamp(0.85rem, 2vmin, 1.1rem);
  opacity: 0.75;
}
</style>
