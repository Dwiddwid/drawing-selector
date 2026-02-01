import { vi } from 'vitest'

// Polyfill ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
  constructor(cb) {
    this.cb = cb
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Polyfill BroadcastChannel for jsdom
if (typeof globalThis.BroadcastChannel === 'undefined') {
  globalThis.BroadcastChannel = class BroadcastChannel {
    constructor() {
      this.onmessage = null
    }
    postMessage() {}
    close() {}
  }
}
