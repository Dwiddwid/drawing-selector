<script setup>
import AdminPanel from "../components/AdminPanel.vue";
import Title from "../components/Title.vue";
</script>

<template>

  <div class="container-fluid">
    <div class="row">
      <div class="col-6 d-flex align-items-center vh-100">
        <img alt="Spy" class="logo" src="@/assets/user-spy.svg" width="125" height="125" />

        <div class="wrapper">
          <Title msg="It's drawing time!" />

          <nav>
            <RouterLink to="/">Home</RouterLink>
            <RouterLink to="/drawing">Start drawing</RouterLink>
          </nav>
        </div>
      </div>
      <div class="col-6 d-flex align-items-center admin-col vh-100">
      <AdminPanel />
      </div>
    </div>
  </div>
</template>

<style>
header {
  line-height: 1.5;
  max-height: 100vh;
}

.admin-col {
  overflow-y: auto;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

header {
  display: flex;
  place-items: center;
  padding-right: calc(var(--section-gap) / 2);
}

header .wrapper {
  display: flex;
  place-items: flex-start;
  flex-wrap: wrap;
}

.logo {
  margin: 0 2rem 0 0;
}
</style>
