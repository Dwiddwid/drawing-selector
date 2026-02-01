import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createRouter, createMemoryHistory } from 'vue-router'
import { h, nextTick } from 'vue'
import HomeView from '../HomeView.vue'
import { useParticipantStore } from '../../stores/participants.js'

const vuetify = createVuetify({ components, directives })

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/drawing', component: { template: '<div>Drawing</div>' } },
    ],
  })
}

async function mountHomeView() {
  const router = createTestRouter()
  const wrapper = mount(
    {
      render() {
        return h(components.VApp, () => h(HomeView))
      },
    },
    {
      global: {
        plugins: [vuetify, router],
      },
    }
  )
  await nextTick()
  await nextTick()
  return wrapper
}

describe('HomeView', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useParticipantStore()
    localStorage.clear()
  })

  it('renders the Title component text', async () => {
    const wrapper = await mountHomeView()
    expect(wrapper.text()).toContain('drawing time')
  })

  it('shows "Select winner" button in multi display mode', async () => {
    store.useMultiDisplayMode = true
    const wrapper = await mountHomeView()
    expect(wrapper.text()).toContain('Select winner')
  })

  it('does not show "Select winner" button when multi display mode is off', async () => {
    store.useMultiDisplayMode = false
    const wrapper = await mountHomeView()
    expect(wrapper.text()).not.toContain('Select winner')
  })

  it('shows multi display mode checkbox', async () => {
    const wrapper = await mountHomeView()
    expect(wrapper.text()).toContain('Use multi display mode')
  })

  it('always shows "Start drawing" link', async () => {
    const wrapper = await mountHomeView()
    expect(wrapper.text()).toContain('Start drawing')
  })
})
