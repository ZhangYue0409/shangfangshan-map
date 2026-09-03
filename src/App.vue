<template>
  <div id="cesium-container"></div>
</template>

<script setup>
import { onMounted } from 'vue'
import * as Cesium from 'cesium'
import { initInteraction } from './interaction.js'
import { loadRoute } from './route.js'

onMounted(async () => {
  const tokenA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiZGE3MjZkNS0xMWI4LTRkZDgtOWM3Mi0xM2IzOWY3YzVkZWQiLCJpZCI6NDYwMzg2LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODQ5NzM3MDd9.s-BE-b8z00JBBx7UQHEfqwHsuG2gGET2FOCu-A7bF2o'
  const tokenB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkODliZDAyMi1mNzY2LTQwMmYtOTNjNi1lOGY5OGYzMjQ4YmUiLCJpZCI6NDYwNjY1LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODUwNjg5OTJ9.snV-HHPbKFHGnIL0nWyCtIklA8JEi9mtmVXSxxxzZKU'

  Cesium.Ion.defaultAccessToken = tokenA

  const terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(5091409, {
    accessToken: tokenA
  })

  const viewer = new Cesium.Viewer('cesium-container', {
    baseLayerPicker: false,
    geocoder: false,
    timeline: false,
    animation: false,
    sceneModePicker: false,
    terrainProvider: terrainProvider,
    baseLayer: Cesium.ImageryLayer.fromWorldImagery()
  })
  // 直接定位到上方山（无动画）
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(115.8250, 39.6450, 2500),
  orientation: {
    pitch: Cesium.Math.toRadians(-35),
    heading: 0,
    roll: 0
  }
})

  viewer.scene.globe.depthTestAgainstTerrain = true
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = true
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 300
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 8000
  viewer.scene.globe.verticalExaggeration = 2.5

  try {
    const buildings = await Cesium.createOsmBuildingsAsync()
    viewer.scene.primitives.add(buildings)
  } catch (e) {
    console.warn('建筑加载失败', e)
  }

  try {
    const resource = await Cesium.IonResource.fromAssetId(5091450, {
      accessToken: tokenB
    })
    const tileset = await Cesium.Cesium3DTileset.fromUrl(resource)
    viewer.scene.primitives.add(tileset)
   // await viewer.zoomTo(tileset)
  } catch (error) {
    console.error('3DTiles 模型加载失败:', error)
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(115.8158, 39.6638, 30),
      orientation: { pitch: -30, heading: 0, roll: 0 }
    })
  }

  // 位置标签
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(115.8171, 39.6698, 300),
    allowPicking: false,
    label: {
      text: '上方山',
      font: '30px sans-serif',
      fillColor: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2
    }
  })

  await initInteraction(viewer)

 
  // 加载 GPX 轨迹
  try {
    const gpxDataSource = await Cesium.GpxDataSource.load(
      '/data/上方山路线.gpx',
      {
        clampToGround: true,
        trackColor: Cesium.Color.WHITE,
        routeColor: Cesium.Color.WHITE
      }
    )
    viewer.dataSources.add(gpxDataSource)
    gpxDataSource.entities.values.forEach(entity => {
      if (entity.polyline) {
        entity.polyline.width = 12
        entity.polyline.material = Cesium.Color.WHITE.withAlpha(0.9)
      }
    })
    //await viewer.zoomTo(gpxDataSource.entities)
    console.log('✅ 蓝色 GPX 轨迹加载成功（宽度 12）')
  } catch (error) {
    console.error('❌ GPX 轨迹加载失败:', error)
  }

  window.viewer = viewer
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