<script setup>
import AdminItem from "./AdminItem.vue";
import DocumentationIcon from "./icons/IconDocumentation.vue";
import ToolingIcon from "./icons/IconTooling.vue";
import EcosystemIcon from "./icons/IconEcosystem.vue";
import CommunityIcon from "./icons/IconCommunity.vue";
import SupportIcon from "./icons/IconSupport.vue";
import { useParticipantStore } from "../stores/participants.js";
import {ref} from "vue"

const store = useParticipantStore();

const myFile = ref(null)

function csvToJSON(csv) {
    var lines = csv.split("\n");
    var result = [];
    var headers;
    headers = lines[0].substring(1).slice(0,-1).split('","');

    for (var i = 1; i < lines.length; i++) {
        var obj = {};

        if(lines[i] == undefined || lines[i].trim() == "") {
            continue;
        }

        var words = lines[i].substring(1).slice(0,-1).split('","');
        for(var j = 0; j < words.length; j++) {
            obj[headers[j].trim()] = words[j];
        }

        result.push(obj);
    }
    return result;
}

function selectedFile() {
  var nameList = [];
  console.log('selected a file');
  console.log(myFile.value.files);

  let file = myFile.value.files[0];
  if (!file || file.type !== 'text/csv'){
    console.log("not recognised as .csv")
    return;
  } 

  // Credit: https://stackoverflow.com/a/754398/52160
  let reader = new FileReader();
  reader.readAsText(file, "UTF-8");
  reader.onload = evt => {
    nameList = csvToJSON(evt.target.result);
    console.log(nameList)
    for (var i=0; i < nameList.length; i++){
      var test = JSON.stringify(nameList[i])
      var exists = store.winners.findIndex(element => {
        if (JSON.stringify(element) === test) {
          return true;
        }
        else {
          return false;
        }
      })
      if (exists){
        nameList.slice(i, 0);
      }
    }
    store.candidates = nameList;
    localStorage.setItem("candidates", JSON.stringify(nameList));
  }
  reader.onerror = evt => {
    console.error(evt);
  }

}

function resetCandidates(){
  store.candidates = [];
  localStorage.removeItem("candidates");
  myFile.value = null;
}

function resetWinners(){
  store.winners = [];
  localStorage.removeItem("winners");
}
</script>

<template>
  <div class="list-group admin-panel">
    <AdminItem>
      <template #icon>
        <font-awesome-icon icon="fa-solid fa-people-group" />
      </template>
      <template #heading>Participants</template>

      <ul>
        <li v-for="participant in store.getParticipants">
          {{participant["First Name"]}} {{participant["Last Name"]}}
        </li>
      </ul>
    </AdminItem>

    <AdminItem>
      <template #icon>
        <font-awesome-icon icon="fa-solid fa-gift" />
      </template>
      <template #heading>Winners</template>

      <ul>
        <li v-for="participant in store.winners">
          {{participant["First Name"]}} {{participant["Last Name"]}}
        </li>
      </ul>
    </AdminItem>

    <AdminItem>
      <template #icon>
        <font-awesome-icon icon="fa-solid fa-book" />
      </template>
      <template #heading>Manage</template>

      <p>Choose a .csv file of candidates to import.</p>

      <input type="file" ref="myFile" @change="selectedFile" />
      <button type="button">Reset winners</button>
      <button type="button" v-on:click="resetCandidates">Reset candidates</button>
    </AdminItem>

  </div>

</template>

<style>
.admin-panel{
  padding-left: 2rem;
}
</style>