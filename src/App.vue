<template>
  <div id="app">
    <SessionSummaryGenerator />
  </div>
</template>

<script setup>
import SessionSummaryGenerator from './components/SessionSummaryGenerator.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  font-family: 'Montserrat', Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>