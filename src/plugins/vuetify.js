import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, fa } from 'vuetify/iconsets/fa-svg'

// import * as components from 'vuetify/components'
// import * as directives from 'vuetify/directives'

export default createVuetify(
    {
        icons: {
        defaultSet: 'fa',
        aliases,
        sets: {
          fa,
        },
      }
    },
)