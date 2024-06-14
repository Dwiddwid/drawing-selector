<script setup>
import { useParticipantStore } from "../stores/participants.js";
import {ref} from "vue"

const store = useParticipantStore();

const myFile = ref(null)

function csvToJSON(csv) {
  let test = csv.replace(/\r?\n|\r/gm, "\n");
  var lines = test.split("\n");
  var result = [];
  var headers;
  headers = lines[0].split(",");

  for (var i = 1; i < lines.length; i++) {
    var obj = {};

    if (lines[i] == undefined || lines[i].trim() == "") {
      continue;
    }

    var words = lines[i].split(",");
    for (var j = 0; j < words.length; j++) {
      obj[headers[j]] = words[j];
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
  <v-card prepend-icon="fas fa-people-group" variant="outlined">
    <template v-slot:title>
      Participants
    </template>

    <template v-slot:text>
      <v-list lines="one" density="compact">
        <v-list-item v-for="participant in store.getParticipants"
          :title="participant['First Name'] + ' ' + participant['Last Name']" :value="participant"></v-list-item>
      </v-list>
    </template>
  </v-card>
  <v-card prepend-icon="fas fa-gift" variant="outlined">
    <template v-slot:title>
      Winners
    </template>

    <template v-slot:text>
      <v-list lines="one" density="compact">
        <v-list-item v-for="participant in store.winners"
          :title="participant['First Name'] + ' ' + participant['Last Name']" :value="participant"></v-list-item>
      </v-list>
    </template>
  </v-card>

  <v-card prepend-icon="fas fa-book" variant="outlined">
    <template v-slot:title>
      Manage
    </template>

    <template v-slot:text>
      <p>Choose a .csv file of candidates to import.</p>

      <v-file-input label="File input" ref="myFile" @change="selectedFile"></v-file-input>
      <v-btn @click="resetCandidates">Reset candidates</v-btn>
      <v-btn @click="resetWinners">Reset winners</v-btn>
    </template>
  </v-card>

  


</template>

<style>
/* .admin-panel{
  padding-left: 2rem;
} */
</style>