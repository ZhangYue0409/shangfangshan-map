<template>
  <div id="cesium-container"></div>
</template>

<script setup>
import { onMounted } from 'vue'
import * as Cesium from 'cesium'
import { initInteraction } from './interaction.js'
import { loadRoute } from './route.js'

onMounted(async () => {
  // Token A（地形）
  const tokenA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiZGE3MjZkNS0xMWI4LTRkZDgtOWM3Mi0xM2IzOWY3YzVkZWQiLCJpZCI6NDYwMzg2LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODQ5NzM3MDd9.s-BE-b8z00JBBx7UQHEfqwHsuG2gGET2FOCu-A7bF2o'
  // Token B（3DTiles）
  const tokenB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkODliZDAyMi1mNzY2LTQwMmYtOTNjNi1lOGY5OGYzMjQ4YmUiLCJpZCI6NDYwNjY1LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODUwNjg5OTJ9.snV-HHPbKFHGnIL0nWyCtIklA8JEi9mtmVXSxxxzZKU'

  Cesium.Ion.defaultAccessToken = tokenA

  // 加载地形
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

  viewer.scene.globe.depthTestAgainstTerrain = true
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = true
  viewer.scene.globe.verticalExaggeration = 2.5

  // 加载 OSM 建筑
  try {
    const buildings = await Cesium.createOsmBuildingsAsync()
    viewer.scene.primitives.add(buildings)
  } catch (e) {
    console.warn('建筑加载失败', e)
  }

  // 加载 3DTiles
  try {
    const resource = await Cesium.IonResource.fromAssetId(5091450, {
      accessToken: tokenB
    })
    const tileset = await Cesium.Cesium3DTileset.fromUrl(resource)
    viewer.scene.primitives.add(tileset)
    await viewer.zoomTo(tileset)
  } catch (error) {
    console.error('3DTiles 模型加载失败:', error)
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(115.8158, 39.6638, 30),
      orientation: { pitch: -30, heading: 0, roll: 0 }
    })
  }

  // 位置标签
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(115.9, 39.7, 300),
    allowPicking: false,
    label: {
      text: '上方山',
      font: '20px sans-serif',
      fillColor: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2
    }
  })

  // 初始化 POI 交互
  await initInteraction(viewer)

  // 加载彩色路线（GeoJSON）
  await loadRoute(viewer)

  // ========== 加载 GPX 轨迹（蓝色 + 加宽至 12） ==========
  try {
    const gpxDataSource = await Cesium.GpxDataSource.load(
      '/data/上方山路线.gpx',
      {
        clampToGround: true,
        trackColor: Cesium.Color.BLUE,
        routeColor: Cesium.Color.BLUE
      }
    )
    viewer.dataSources.add(gpxDataSource)

    // 加粗轨迹线（宽度设为 12，原来 6 的两倍）
    gpxDataSource.entities.values.forEach(entity => {
      if (entity.polyline) {
        entity.polyline.width = 24
        entity.polyline.material = Cesium.Color.BLUE.withAlpha(0.9)
      }
    })

    // 自动飞向轨迹
    await viewer.zoomTo(gpxDataSource.entities)
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