<script setup>
defineProps({
  msg: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div class="greetings">
    <h1 class="green"><v-icon icon="fas fa-person-swimming" size="x-large"></v-icon>{{ msg }}</h1>
    <h3>
      Draw from any list — people, restaurants, games, anything. Import a .csv from the
      <strong>Data</strong> tab and you'll map each column: pick which one(s) form the displayed
      name and which are extra details to show on the drawing screen, and give them any labels you
      like. You can append to the current pool or replace it. No file? Add entries by hand in the
      <strong>Participants</strong> tab.
    </h3>
    <h3>
      Winners are tracked on this computer and won't be drawn again. To let them win again, use the
      <strong>Reset winners</strong> button on the Winners tab.
    </h3>
    <h3>When ready, click Start drawing to hide the admin panel and show the drawing screen.</h3>
  </div>
</template>

<style scoped>
h1 {
  font-weight: 500;
  font-size: 2.6rem;
  top: -10px;
}

h3 {
  font-size: 1.2rem;
}

.greetings h1,
.greetings h3 {
  text-align: center;
}

@media (min-width: 1024px) {
  .greetings h1,
  .greetings h3 {
    text-align: left;
  }
}
</style>
