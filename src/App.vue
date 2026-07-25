<template>
  <div id="cesium-container"></div>
</template>

<script setup>
import { onMounted } from 'vue'
import * as Cesium from 'cesium'
// 重要！把你刚写的 route.js 文件引用进来
import { loadRoute } from './route.js' 

onMounted(async () => {
  // 1. 粘贴你之前复制好的 Cesium Token（记得换回你自己的！）
  Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiZGE3MjZkNS0xMWI4LTRkZDgtOWM3Mi0xM2IzOWY3YzVkZWQiLCJpZCI6NDYwMzg2LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODQ5NzM3MDd9.s-BE-b8z00JBBx7UQHEfqwHsuG2gGET2FOCu-A7bF2o'

  // 2. 创建三维地球
  const viewer = new Cesium.Viewer('cesium-container', {
    baseLayerPicker: false,
    geocoder: false,
    timeline: false,
    animation: false,
    sceneModePicker: false,
  })

  // 3. 调用你刚写的画路线功能！
  await loadRoute(viewer)
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