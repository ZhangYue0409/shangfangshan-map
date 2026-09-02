<template>
  <div id="cesium-container"></div>
</template>

<script setup>
import { onMounted } from 'vue'
import * as Cesium from 'cesium'
// 1. 导入 POI 交互模块与 Route 路线模块
import { initInteraction } from './interaction.js'
import { loadRoute } from './route.js'

onMounted(async () => {
  // 1. 账号 A 的 Token（原队友的 Token，用于加载地形 5091409 等）
  const tokenA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiZGE3MjZkNS0xMWI4LTRkZDgtOWM3Mi0xM2IzOWY3YzVkZWQiLCJpZCI6NDYwMzg2LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODQ5NzM3MDd9.s-BE-b8z00JBBx7UQHEfqwHsuG2gGET2FOCu-A7bF2o'
  
  // 2. 账号 B 的 Token（你自己的 Token，用于加载 3DTiles 5091450）
  const tokenB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkODliZDAyMi1mNzY2LTQwMmYtOTNjNi1lOGY5OGYzMjQ4YmUiLCJpZCI6NDYwNjY1LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODUwNjg5OTJ9.snV-HHPbKFHGnIL0nWyCtIklA8JEi9mtmVXSxxxzZKU'

  // 默认全局 Token 设置为账号 A
  Cesium.Ion.defaultAccessToken = tokenA

  // 使用账号 A 的 Token 加载地形
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
    baseLayer: Cesium.ImageryLayer.fromWorldImagery() // 使用默认底图避免 Bing 地图跨域报错
  })

  viewer.scene.globe.depthTestAgainstTerrain = true; // 开启深度检验
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
  // 山体夸张
  viewer.scene.globe.verticalExaggeration = 2.5

  // 加载立体建筑（可选）
  try {
    const buildings = await Cesium.createOsmBuildingsAsync()
    viewer.scene.primitives.add(buildings)
  } catch (e) {
    console.warn('建筑加载失败', e)
  }

  // 🎯 使用 IonResource 显式指定 Token B 加载 3DTiles (Asset ID: 5091450)
  try {
    const resource = await Cesium.IonResource.fromAssetId(5091450, {
      accessToken: tokenB
    })

    const tileset = await Cesium.Cesium3DTileset.fromUrl(resource)
    viewer.scene.primitives.add(tileset)
    
    // 聚焦到模型视角
    await viewer.zoomTo(tileset)
  } catch (error) {
    console.error('3DTiles 模型加载失败:', error)
    
    // 保底视角
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(115.2, 39, 30),
      orientation: {
        pitch: -30,
        heading: 0,
        roll: 0
      }
    })
  }

  // 位置标签
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(115.8161, 39.6638, 179),
    allowPicking: false, // 禁止点击选择
    label: {
      text: '上方山',
      font: '20px sans-serif',
      fillColor: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2
    }
  })

  // 🎯 2. 初始化 POI 交互
  await initInteraction(viewer)

  // 🎯 3. 加载彩色登山路线
  await loadRoute(viewer)
  // 🎯 4. 加载 GPX 轨迹
try {
  const gpxDataSource = await Cesium.GpxDataSource.load(
    '/data/track.gpx',   // 替换为实际文件名
    {
      clampToGround: true,
      trackColor: Cesium.Color.RED,
      routeColor: Cesium.Color.BLUE
    }
  );
  viewer.dataSources.add(gpxDataSource);
  await viewer.zoomTo(gpxDataSource.entities);
  console.log('✅ GPX 轨迹加载成功');
} catch (error) {
  console.error('❌ GPX 轨迹加载失败:', error);
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