<!-- src/App.vue -->
<template>
  <div>
    <!-- 路线选择控制面板 -->
    <div class="control-panel">
      <div class="panel-title">路线选择</div>
      <div class="route-buttons">
        <button
          :class="['route-btn', { active: currentRoute === 'route1' }]"
          @click="switchRoute('route1')"
        >
          主路线
        </button>
        <button
          :class="['route-btn', { active: currentRoute === 'hiking' }]"
          @click="showHikingRoute"
        >
          不回头极限徒步路线
        </button>
        <button
          :class="['route-btn', { active: currentRoute === 'photo' }]"
          @click="showPhotoRoute"
        >
          拍照浏览景点路线
        </button>
        <button
          :class="['route-btn', { active: currentRoute === null }]"
          @click="closeAllRoute"
        >
          关闭路线
        </button>
      </div>
    </div>

    <!-- 图层显隐控制面板 -->
    <div class="layer-control-panel">
      <div class="panel-title">图层控制</div>
      <div class="layer-list">
        <label
          v-for="layer in layerConfigs"
          :key="layer.id"
          class="layer-item"
        >
          <input
            type="checkbox"
            v-model="layer.visible"
            @change="handleLayerToggle(layer)"
          />
          <span class="checkbox-custom"></span>
          <span class="layer-label-text">{{ layer.name }}</span>
        </label>
      </div>
    </div>

    <!-- 坡度查看控制面板 -->
    <div class="control-panel slope-panel">
      <div class="panel-title">坡度</div>
      <div class="route-buttons">
        <button
          :class="['route-btn', { active: slopeTarget === 'off' }]"
          @click="setSlopeLayer('off')"
        >
          关闭坡度
        </button>
        <button
          :class="['route-btn', { active: slopeTarget === 'route1' }]"
          @click="setSlopeLayer('route1')"
        >
          主路线坡度
        </button>
        <button
          :class="['route-btn', { active: slopeTarget === 'hiking' }]"
          @click="setSlopeLayer('hiking')"
        >
          极限徒步坡度
        </button>
        <button
          :class="['route-btn', { active: slopeTarget === 'photo' }]"
          @click="setSlopeLayer('photo')"
        >
          浏览景点坡度
        </button>
      </div>
    </div>

    <!-- 坡度图例 -->
    <div v-if="showSlopeLegend" class="slope-legend">
      <div class="legend-title">坡度图例</div>
      <div class="legend-item">
        <span class="color-block green"></span>
        <span>≤10° 缓坡</span>
      </div>
      <div class="legend-item">
        <span class="color-block yellow"></span>
        <span>10°~20° 中坡</span>
      </div>
      <div class="legend-item">
        <span class="color-block red"></span>
        <span>＞20° 陡坡</span>
      </div>
    </div>

    <!-- 路线介绍弹窗 -->
    <div v-if="showRoutePopup" class="route-intro-popup">
      <div class="popup-header">
        <span class="popup-title">{{ popupData.title }}</span>
        <span class="popup-close" @click="showRoutePopup = false">×</span>
      </div>
      <div class="popup-body">
        <p>{{ popupData.content }}</p>
      </div>
    </div>

    <!-- 引入独立抽离的文化问答游戏组件 -->
    <QuizGame ref="quizGameRef" :viewer="viewer" />

    <!-- Cesium 视图容器 -->
    <div id="cesium-container"></div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import * as Cesium from 'cesium'
import { initInteraction } from './interaction.js'
import { createSlopeLayer } from './slopeLayer.js'
import { layerConfigs, initGeoJsonLayers, toggleLayerVisibility } from './LayerManager.js'
import QuizGame from './QuizGame.vue'

const currentRoute = ref('route1')
const slopeTarget = ref('off')
const showSlopeLegend = ref(false)
const viewer = ref(null)

const quizGameRef = ref(null)

// GPX 路线与图层状态变量
let rawGpx1 = null
let route1Positions = []
let hikingSegments = []
let photoSegments = []
let routeLineEntity = null
let flightInProgress = false
let flightStopCallback = null
let slopeLayerList = []
let hikingRouteLayer = null
let photoRouteLayer = null

// 路线弹窗变量
const showRoutePopup = ref(false)
const popupData = ref({ title: '', content: '' })

const routeDescMap = {
  route1: {
    title: '主路线',
    content: '主路线：全长8.2km，台阶较多，沿途设置多处休息点，适合大多数游客，可乘坐缆车上下，全程耗时约3‑4小时。'
  },
  hiking: {
    title: '不回头极限徒步路线',
    content: '不回头极限徒步路线：全程12km，大坡度，无缆车，体力消耗大，建议专业徒步爱好者选择。'
  },
  photo: {
    title: '拍照浏览景点路线',
    content: '拍照浏览景点路线：沿途覆盖核心观景打卡点，路程适中，适合拍照游览。'
  }
}

function openPopup(routeKey) {
  popupData.value = routeDescMap[routeKey]
  showRoutePopup.value = true
}

function handleLayerToggle(layer) {
  toggleLayerVisibility(layer)
}

function closeAllRoute() {
  currentRoute.value = null
  showRoutePopup.value = false
  if (routeLineEntity) {
    viewer.value.entities.remove(routeLineEntity)
    routeLineEntity = null
  }
  if (hikingRouteLayer) hikingRouteLayer.show = false
  if (photoRouteLayer) photoRouteLayer.show = false
}

function showHikingRoute() {
  closeAllRoute()
  currentRoute.value = 'hiking'
  if (hikingRouteLayer) hikingRouteLayer.show = true
  openPopup('hiking')
}

function showPhotoRoute() {
  closeAllRoute()
  currentRoute.value = 'photo'
  if (photoRouteLayer) photoRouteLayer.show = true
  openPopup('photo')
}

function switchRoute(route) {
  if (hikingRouteLayer) hikingRouteLayer.show = false
  if (photoRouteLayer) photoRouteLayer.show = false
  slopeTarget.value = 'off'
  destroySlopeLayer()
  showSlopeLegend.value = false

  currentRoute.value = route
  if (flightInProgress && typeof flightStopCallback === 'function') {
    flightStopCallback()
    flightStopCallback = null
  }
  if (routeLineEntity) {
    viewer.value.entities.remove(routeLineEntity)
    routeLineEntity = null
  }
  if (route === 'route1' && route1Positions.length > 0) {
    routeLineEntity = viewer.value.entities.add({
      polyline: {
        positions: route1Positions,
        width: 12,
        material: Cesium.Color.fromCssColorString('#D4A574').withAlpha(0.9),
        clampToGround: true
      }
    })
  }
  openPopup(route)
}

function destroySlopeLayer() {
  slopeLayerList.forEach(layer => {
    if (layer && layer.destroy) layer.destroy()
  })
  slopeLayerList = []
  showSlopeLegend.value = false
}

async function setSlopeLayer(mode) {
  destroySlopeLayer()
  slopeTarget.value = mode
  if (mode === 'off') return

  let segmentList = []
  if (mode === 'route1') segmentList = [route1Positions]
  else if (mode === 'hiking') segmentList = hikingSegments
  else if (mode === 'photo') segmentList = photoSegments

  if (!segmentList || segmentList.length === 0) {
    alert('该路线轨迹数据尚未加载完成！')
    slopeTarget.value = 'off'
    return
  }
  try {
    for (const segPos of segmentList) {
      if (segPos.length < 2) continue
      const layer = await createSlopeLayer(viewer.value, segPos)
      slopeLayerList.push(layer)
    }
    showSlopeLegend.value = true
  } catch (e) {
    console.error("坡度图层生成失败", e)
    alert("地形采样失败，请等待地形加载完成")
    slopeTarget.value = 'off'
  }
}

function getRoutePositions(dataSource) {
  const positions = []
  if (!dataSource || !dataSource.entities) return positions
  dataSource.entities.values.forEach(entity => {
    if (entity.polyline && entity.polyline.positions) {
      const cart3List = entity.polyline.positions.getValue(Cesium.JulianDate.now())
      if (cart3List) positions.push(...cart3List)
    }
  })
  return positions
}

onMounted(async () => {
  const tokenA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiZGE3MjZkNS0xMWI4LTRkZDgtOWM3Mi0xM2IzOWY3YzVkZWQiLCJpZCI6NDYwMzg2LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODQ5NzM3MDd9.s-BE-b8z00JBBx7UQHEfqwHsuG2gGET2FOCu-A7bF2o'
  const tokenB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkODliZDAyMi1mNzY2LTQwMmYtOTNjNi1lOGY5OGYzMjQ4YmUiLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODUwNjg5OTJ9.snV-HHPbKFHGnIL0nWyCtIklA8JEi9mtmVXSxxxzZKU'
  
  Cesium.Ion.defaultAccessToken = tokenA
  const terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(5091409, {
    accessToken: tokenA
  })

  const cesiumViewer = new Cesium.Viewer('cesium-container', {
    baseLayerPicker: false,
    geocoder: false,
    timeline: false,
    animation: false,
    sceneModePicker: false,
    selectionIndicator: false,
    terrainProvider: terrainProvider,
    baseLayer: Cesium.ImageryLayer.fromWorldImagery()
  })

  viewer.value = cesiumViewer

  cesiumViewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(115.8180, 39.6520, 1500),
    orientation: {
      pitch: Cesium.Math.toRadians(-35),
      heading: 0,
      roll: 0
    }
  })

  cesiumViewer.scene.globe.depthTestAgainstTerrain = true
  cesiumViewer.scene.screenSpaceCameraController.enableCollisionDetection = true
  cesiumViewer.scene.screenSpaceCameraController.minimumZoomDistance = 300
  cesiumViewer.scene.screenSpaceCameraController.maximumZoomDistance = 8000
  cesiumViewer.scene.globe.verticalExaggeration = 2.5

  try {
    const buildings = await Cesium.createOsmBuildingsAsync()
    cesiumViewer.scene.primitives.add(buildings)
  } catch (e) {
    console.warn('建筑加载失败', e)
  }

  try {
    const resource = await Cesium.IonResource.fromAssetId(5091450, { accessToken: tokenB })
    const tileset = await Cesium.Cesium3DTileset.fromUrl(resource)
    cesiumViewer.scene.primitives.add(tileset)
  } catch (error) {
    console.error('3DTiles 模型加载失败:', error)
  }

  await initInteraction(cesiumViewer)
  await initGeoJsonLayers(cesiumViewer)

  async function loadRouteGeoJSON(url, name, color, type) {
    try {
      const route = await Cesium.GeoJsonDataSource.load(url, { clampToGround: true })
      cesiumViewer.dataSources.add(route)
      if (type === 'hiking' || type === 'photo') {
        route.show = false
      }
      const segments = []
      route.entities.values.forEach(entity => {
        if (entity.polyline) {
          entity.polyline.width = 12
          entity.polyline.material = color
          const cart3List = entity.polyline.positions.getValue(Cesium.JulianDate.now())
          if (cart3List && cart3List.length >= 2) {
            segments.push(cart3List)
          }
        }
      })
      if (type === 'hiking') {
        hikingRouteLayer = route
        hikingSegments = segments
      }
      if (type === 'photo') {
        photoRouteLayer = route
        photoSegments = segments
      }
    } catch (error) {
      console.error(name + '加载失败:', error)
    }
  }

  loadRouteGeoJSON('/data/不回头极限徒步线路.json', '不回头极限徒步线路', Cesium.Color.ORANGE.withAlpha(0.9), 'hiking')
  loadRouteGeoJSON('/data/拍照浏览景点线路.json', '拍照浏览景点线路', Cesium.Color.BLUE.withAlpha(0.9), 'photo')

  try {
    rawGpx1 = await Cesium.GpxDataSource.load('/data/上方山路线.gpx')
    route1Positions = getRoutePositions(rawGpx1)
  } catch (error) {
    console.error('❌ 上行路线加载失败', error)
  }

  if (route1Positions.length > 0) {
    routeLineEntity = cesiumViewer.entities.add({
      polyline: {
        positions: route1Positions,
        width: 12,
        material: Cesium.Color.fromCssColorString('#D4A574').withAlpha(0.9),
        clampToGround: true
      }
    })
  }

  window.viewer = cesiumViewer
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

.control-panel,
.layer-control-panel,
.slope-legend {
  position: absolute;
  z-index: 100;
  box-sizing: border-box;
  color: #ffffff;
  background: rgba(18, 18, 22, 0.35);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 20px;
  box-shadow:
    0 16px 36px rgba(0, 0, 0, 0.35),
    inset 0 1px 1px rgba(255, 255, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.layer-control-panel {
  top: 20px;
  left: 20px;
  min-width: 170px;
  padding: 16px 18px;
}

.control-panel {
  top: 218px;
  left: 20px;
  min-width: 170px;
  padding: 16px 18px;
}

.slope-panel {
  top: 475px;
}

.slope-legend {
  top: 730px;
  left: 20px;
  min-width: 170px;
  padding: 14px 18px;
}

.panel-title,
.legend-title {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  margin: -16px -18px 14px;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-align: center;
}

.legend-title {
  margin: -14px -18px 12px;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.layer-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 500;
}

.layer-item input[type='checkbox'] {
  width: 16px;
  height: 16px;
  margin-right: 9px;
  cursor: pointer;
  accent-color: #d4a574;
}

.route-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.route-btn {
  min-height: 38px;
  padding: 8px 14px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.82);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
}

.route-btn.active {
  background: rgba(212, 165, 116, 0.28);
  border-color: rgba(235, 194, 135, 0.9);
  color: #ffffff;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 7px 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}

.color-block {
  width: 20px;
  height: 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 4px;
}

.color-block.green { background-color: #00c800; }
.color-block.yellow { background-color: #ffff00; }
.color-block.red { background-color: #ff2222; }

.route-intro-popup {
  position: absolute;
  z-index: 200;
  left: 220px;
  top: 220px;
  width: 320px;
  background: rgba(18, 18, 22, 0.45);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 20px;
  overflow: hidden;
  color: #fff;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 18px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.popup-body {
  padding: 16px 18px;
  font-size: 14px;
  line-height: 1.7;
}
</style>