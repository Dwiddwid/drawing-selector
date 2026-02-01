import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { h, nextTick } from 'vue'
import DrawingView from '../DrawingView.vue'
import { useParticipantStore } from '../../stores/participants.js'

const vuetify = createVuetify({ components, directives })

async function mountDrawingView() {
  const wrapper = mount(
    {
      render() {
        return h(components.VApp, () => h(DrawingView))
      },
    },
    {
      global: {
        plugins: [vuetify],
      },
    }
  )
  await nextTick()
  await nextTick()
  return wrapper
}

describe('DrawingView', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useParticipantStore()
  })

  it('shows "Ready to start drawing!" when index < 0', async () => {
    store.index = -1
    const wrapper = await mountDrawingView()
    expect(wrapper.text()).toContain('Ready to start drawing!')
  })

  it('shows "And the Winner Is..." when spinning', async () => {
    store.candidates = [
      { 'First Name': 'Alice', 'Last Name': 'Smith', 'School Grade': '5' },
    ]
    store.index = 0
    store.spinning = true
    const wrapper = await mountDrawingView()
    expect(wrapper.text()).toContain('And the Winner Is...')
  })

  it('displays candidate name when index is valid and not spinning', async () => {
    store.candidates = [
      { 'First Name': 'Alice', 'Last Name': 'Smith', 'School Grade': '5' },
    ]
    store.index = 0
    store.spinning = false
    const wrapper = await mountDrawingView()
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Smith')
  })

  it('displays school grade when candidate is selected', async () => {
    store.candidates = [
      { 'First Name': 'Alice', 'Last Name': 'Smith', 'School Grade': '5' },
    ]
    store.index = 0
    store.spinning = false
    const wrapper = await mountDrawingView()
    expect(wrapper.text()).toContain('5')
  })

  it('hides GO button when multi display mode is enabled', async () => {
    store.useMultiDisplayMode = true
    const wrapper = await mountDrawingView()
    const buttons = wrapper.findAllComponents({ name: 'VBtn' })
    const goBtn = buttons.find((b) => b.text() === 'GO!')
    expect(goBtn).toBeUndefined()
  })

  it('shows GO button when multi display mode is disabled', async () => {
    store.useMultiDisplayMode = false
    store.index = -1
    const wrapper = await mountDrawingView()
    expect(wrapper.text()).toContain('GO!')
  })

  it('calls selectRandomCandidate when GO button is clicked', async () => {
    store.candidates = [
      { 'First Name': 'Alice', 'Last Name': 'Smith', 'School Grade': '5' },
    ]
    store.useMultiDisplayMode = false
    const spy = vi.spyOn(store, 'selectRandomCandidate')
    const wrapper = await mountDrawingView()
    const buttons = wrapper.findAllComponents({ name: 'VBtn' })
    const goBtn = buttons.find((b) => b.text() === 'GO!')
    expect(goBtn).toBeDefined()
    await goBtn.trigger('click')
    expect(spy).toHaveBeenCalled()
  })
})
