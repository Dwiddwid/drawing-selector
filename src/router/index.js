import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { isPortable } from '../utils/platform.js'

// Under `file://` (the portable Offline Edition) there is no server to resolve
// clean paths like `/drawing`, so fall back to hash history. Normal web/PWA
// deploys keep using HTML5 history.
const history = isPortable()
  ? createWebHashHistory()
  : createWebHistory(import.meta.env.BASE_URL)

const router = createRouter({
  history,
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/drawing',
      name: 'drawing',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/DrawingView.vue'),
    },
  ],
})

export default router
