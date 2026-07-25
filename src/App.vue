<template>
  <div id="cesium-container"></div>
</template>

<script setup>
import { onMounted } from 'vue'
import * as Cesium from 'cesium'

onMounted(() => {
  Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4NjFmMDgzNi0zZjkyLTQ1MWMtYWRlMy1mMGQ5ODgzMzJhZWIiLCJpZCI6NDYwMzg2LCJzdWIiOiJxaW54aWFvcWkiLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoicXhxIiwiaWF0IjoxNzg0OTczOTMzfQ.5z9EE082mukFuyQGbELti2_PclZRguiCsiwtAimwohI'
  
  new Cesium.Viewer('cesium-container', {
    baseLayerPicker: false,
    geocoder: false,
    timeline: false,
    animation: false,
    sceneModePicker: false,
  })
})
</script>

<style scoped>
#cesium-container {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>