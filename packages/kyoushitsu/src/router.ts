import { createRouter, createWebHistory } from "vue-router"

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: () => import("@/views/HomeView.vue") },
    {
      path: "/bushitsu/:id",
      name: "bushitsu",
      component: () => import("@/views/BushitsuView.vue"),
    },
  ],
})
