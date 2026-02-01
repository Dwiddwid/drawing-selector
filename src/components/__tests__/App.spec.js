import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../../App.vue'
import { useParticipantStore } from '../../stores/participants.js'

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    themes: {
      oceanTheme: {
        colors: {
          primary: '#1e3d59',
        },
      },
    },
  },
})

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/drawing', component: { template: '<div>Drawing</div>' } },
    ],
  })
}

describe('App.vue state hydration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads candidates from localStorage on mount', async () => {
    const candidates = [
      { 'First Name': 'Alice', 'Last Name': 'Smith', 'School Grade': '5' },
    ]
    localStorage.setItem('candidates', JSON.stringify(candidates))

    const pinia = createPinia()
    const router = createTestRouter()
    mount(App, {
      global: {
        plugins: [pinia, vuetify, router],
      },
    })

    const store = useParticipantStore(pinia)
    expect(store.candidates).toEqual(candidates)
  })

  it('loads winners from localStorage on mount', async () => {
    const winners = [
      { 'First Name': 'Bob', 'Last Name': 'Jones', 'School Grade': '6' },
    ]
    localStorage.setItem('winners', JSON.stringify(winners))

    const pinia = createPinia()
    const router = createTestRouter()
    mount(App, {
      global: {
        plugins: [pinia, vuetify, router],
      },
    })

    const store = useParticipantStore(pinia)
    expect(store.winners).toEqual(winners)
  })

  it('loads useMultiDisplayMode from localStorage on mount', async () => {
    localStorage.setItem('useMultiDisplayMode', JSON.stringify(true))

    const pinia = createPinia()
    const router = createTestRouter()
    mount(App, {
      global: {
        plugins: [pinia, vuetify, router],
      },
    })

    const store = useParticipantStore(pinia)
    expect(store.useMultiDisplayMode).toBe(true)
  })

  it('keeps defaults when localStorage is empty', async () => {
    const pinia = createPinia()
    const router = createTestRouter()
    mount(App, {
      global: {
        plugins: [pinia, vuetify, router],
      },
    })

    const store = useParticipantStore(pinia)
    expect(store.candidates).toEqual([])
    expect(store.winners).toEqual([])
    expect(store.useMultiDisplayMode).toBe(false)
  })
})
