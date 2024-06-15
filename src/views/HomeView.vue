<script setup>
import AdminPanel from "../components/AdminPanel.vue";
import Title from "../components/Title.vue";
</script>

<template>

  <v-main>
    <v-container fluid>
      <v-row>
      <div class="col-xs-12 col-md-6 d-flex align-items-center vh-100">
        <img alt="Spy" class="logo" src="@/assets/user-spy.svg" width="125" height="125" />

        <div class="wrapper">
          <Title msg="It's drawing time!" />

          <nav>
            <v-btn to="/drawing">Start drawing</v-btn>
          </nav>
        </div>
      </div>
      <div class="col-xs-12 col-md-6 admin-col h-100">
        <AdminPanel />
      </div>
    </v-row>
    </v-container>
  </v-main>
</template>

<style>

</style>
