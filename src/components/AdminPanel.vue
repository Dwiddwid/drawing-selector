<script setup>
import AdminItem from "./AdminItem.vue";
import DocumentationIcon from "./icons/IconDocumentation.vue";
import ToolingIcon from "./icons/IconTooling.vue";
import EcosystemIcon from "./icons/IconEcosystem.vue";
import CommunityIcon from "./icons/IconCommunity.vue";
import SupportIcon from "./icons/IconSupport.vue";
import { useParticipantStore } from "../stores/participants.js";

const store = useParticipantStore();
</script>

<template>
  <AdminItem>
    <template #icon>
      <font-awesome-icon icon="fa-solid fa-people-group" />
    </template>
    <template #heading>Participants</template>

    
  </AdminItem>

  <AdminItem>
    <template #icon>
      <font-awesome-icon icon="fa-solid fa-gift" />
    </template>
    <template #heading>Winners</template>

    
  </AdminItem>

  <AdminItem>
    <template #icon>
      <font-awesome-icon icon="fa-solid fa-book" />
    </template>
    <template #heading>Manage</template>

    <input type="file" @change="previewFiles" multiple />
    <button type="button">Upload .csv</button>
    <button type="button">Reset winners</button>
  </AdminItem>

  
</template>
