<script setup lang="ts"></script>

<template>
  <RouterView />
</template>

<style>
html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

body {
  overscroll-behavior: none;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}
</style>
