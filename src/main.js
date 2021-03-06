import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faPeopleGroup, faGift, faBook } from "@fortawesome/free-solid-svg-icons";

import "bootstrap/dist/css/bootstrap.min.css";
import App from './App.vue'
import router from './router'


library.add([faPeopleGroup, faGift, faBook]);

const app = createApp(App)

app.component("font-awesome-icon", FontAwesomeIcon);
app.use(createPinia())
app.use(router)

app.mount('#app')

import "bootstrap/dist/js/bootstrap.js"