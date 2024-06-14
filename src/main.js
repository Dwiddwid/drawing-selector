import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
// import { library } from "@fortawesome/fontawesome-svg-core";
// import { faPeopleGroup, faGift, faBook } from "@fortawesome/free-solid-svg-icons";
import { registerPlugins } from '@/plugins'
import "bootstrap/dist/css/bootstrap.min.css";
import App from './App.vue'

// Vuetify
// import 'vuetify/styles'
// import { createVuetify } from 'vuetify'
// import * as components from 'vuetify/components'
// import * as directives from 'vuetify/directives'

// const vuetify = createVuetify({
//     components,
//     directives,
//   })


// library.add([faPeopleGroup, faGift, faBook]);

const app = createApp(App)

// app.component("font-awesome-icon", FontAwesomeIcon);

registerPlugins(app)

app.mount('#app')

import "bootstrap/dist/js/bootstrap.js"