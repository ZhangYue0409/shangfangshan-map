<template>
  <div>
    <!-- 原有路线选择控制面板 -->
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
        <!--新增关闭路线按钮，全部关闭时高亮-->
        <button
          :class="['route-btn', { active: currentRoute === null }]"
          @click="closeAllRoute"
        >
          关闭路线
        </button>
      </div>
    </div>
    <!-- 新增：图层显隐控制面板 -->
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
    <div id="cesium-container"></div>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue'
import * as Cesium from 'cesium'
import { initInteraction } from './interaction.js'
import { createSlopeLayer } from './slopeLayer.js'
import { layerConfigs, initGeoJsonLayers, toggleLayerVisibility } from './layerManager.js'
const currentRoute = ref('route1')
// 坡度图层状态
const slopeTarget = ref('off')
const showSlopeLegend = ref(false)
let viewer = null
// GPX路线
let rawGpx1 = null
let route1Positions = []
// 分段存储geojson多段轨迹
let hikingSegments = []
let photoSegments = []

// 自己手动创建的路线实体
let routeLineEntity = null
let flightInProgress = false
let flightStartTime = 0
let flightStopCallback = null
// 坡度支持多段
let slopeLayerList = []
//加入两条新路线
let hikingRouteLayer = null
let photoRouteLayer = null

// 图层显隐开关响应函数
function handleLayerToggle(layer) {
  toggleLayerVisibility(layer)
}

// 修复API不存在报错函数
function headingFromPoints(pointA, pointB) {
  const cartoA = Cesium.Cartographic.fromCartesian(pointA)
  const cartoB = Cesium.Cartographic.fromCartesian(pointB)
  const deltaLon = cartoB.longitude - cartoA.longitude
  const deltaLat = cartoB.latitude - cartoA.latitude
  return Math.atan2(deltaLon, deltaLat)
}

// 关闭全部路线：只关闭路线实体，不销毁坡度图层
function closeAllRoute(){
  currentRoute.value = null
  if(routeLineEntity){
    viewer.entities.remove(routeLineEntity)
    routeLineEntity = null
  }
  if(hikingRouteLayer)
  {
    hikingRouteLayer.show=false
  }
  if(photoRouteLayer)
  {
    photoRouteLayer.show=false
  }
  console.log('✅ 已关闭所有原始路线，坡度图层保留')
}

function showHikingRoute(){
  closeAllRoute()
  currentRoute.value = 'hiking'
  if(hikingRouteLayer){
    hikingRouteLayer.show=true
  }
}

function showPhotoRoute(){
  closeAllRoute()
  currentRoute.value = 'photo'
  if(photoRouteLayer){
    photoRouteLayer.show=true
  }
}

// 切换路线
function switchRoute(route) {
  // 隐藏新增GeoJSON路线
  if(hikingRouteLayer){
    hikingRouteLayer.show = false
  }
  if(photoRouteLayer){
    photoRouteLayer.show = false
  }
  slopeTarget.value = 'off'
  destroySlopeLayer()
  showSlopeLegend.value = false
  if (currentRoute.value === route) return
  currentRoute.value = route
  if (flightInProgress && typeof flightStopCallback === 'function') {
    flightStopCallback()
    flightStopCallback = null
  }
  if(routeLineEntity){
    viewer.entities.remove(routeLineEntity)
    routeLineEntity = null
  }
  if (route === 'route1' && route1Positions.length > 0) {
    routeLineEntity = viewer.entities.add({
      polyline:{
        positions: route1Positions,
        width: 12,
        material: Cesium.Color.fromCssColorString('#D4A574').withAlpha(0.9),
        clampToGround: true
      }
    })
    console.log('✅ 切换到上行路线')
  }
}

// 销毁坡度图层（多段全部销毁）
function destroySlopeLayer() {
  slopeLayerList.forEach(layer=>{
    if(layer && layer.destroy) layer.destroy()
  })
  slopeLayerList = []
  showSlopeLegend.value = false
}

// 坡度图层切换
async function setSlopeLayer(mode){
  destroySlopeLayer()
  slopeTarget.value = mode
  if(mode === 'off'){
    return
  }
  let segmentList = []
  if(mode === 'route1'){
    segmentList = [route1Positions]
  }else if(mode === 'hiking'){
    segmentList = hikingSegments
  }else if(mode === 'photo'){
    segmentList = photoSegments
  }

  if(!segmentList || segmentList.length ===0){
    alert('该路线轨迹数据尚未加载完成！')
    slopeTarget.value = 'off'
    return
  }
  try{
    for(const segPos of segmentList){
      if(segPos.length < 2) continue
      const layer = await createSlopeLayer(viewer, segPos)
      slopeLayerList.push(layer)
    }
    showSlopeLegend.value = true
  }catch(e){
    console.error("坡度图层生成失败",e)
    alert("地形采样失败，请等待地形加载完成")
    slopeTarget.value = 'off'
  }
}

// 提取GPX轨迹点
function getRoutePositions(dataSource) {
  const positions = []
  if (!dataSource || !dataSource.entities) return positions
  dataSource.entities.values.forEach(entity => {
    if (entity.polyline && entity.polyline.positions) {
      const cart3List = entity.polyline.positions.getValue(Cesium.JulianDate.now())
      if (cart3List) {
        positions.push(...cart3List)
      }
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
  viewer = new Cesium.Viewer('cesium-container', {
    baseLayerPicker: false,
    geocoder: false,
    timeline: false,
    animation: false,
    sceneModePicker: false,
    selectionIndicator: false,
    terrainProvider: terrainProvider,
    baseLayer: Cesium.ImageryLayer.fromWorldImagery()
  })
  // 初始视角
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(115.8180, 39.6520, 1500),
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
  // 加载 3D 建筑与 Tileset
  try {
    const buildings = await Cesium.createOsmBuildingsAsync()
    viewer.scene.primitives.add(buildings)
  } catch (e) {
    console.warn('建筑加载失败', e)
  }
  try {
    const resource = await Cesium.IonResource.fromAssetId(5091450, { accessToken: tokenB })
    const tileset = await Cesium.Cesium3DTileset.fromUrl(resource)
    viewer.scene.primitives.add(tileset)
  } catch (error) {
    console.error('3DTiles 模型加载失败:', error)
  }
  // 初始化点击拾取交互
  await initInteraction(viewer)
  // 初始化并发异步加载 4 个 GeoJSON 图层
  await initGeoJsonLayers(viewer)

async function loadRouteGeoJSON(
  url,
  name,
  color,
  type
){
  try{
    const route =
      await Cesium.GeoJsonDataSource.load(
        url,
        {
          clampToGround:true
        }
      )
    viewer.dataSources.add(route)
    if(type === 'hiking' || type === 'photo'){
      route.show = false
    }
    //保存分段轨迹
    const segments = []
    route.entities.values.forEach(entity=>{
      if(entity.polyline){
        entity.polyline.width = 12
        entity.polyline.material = color
        const cart3List = entity.polyline.positions.getValue(Cesium.JulianDate.now())
        if(cart3List && cart3List.length >=2){
          segments.push(cart3List)
        }
      }
    })
    if(type === 'hiking'){
      hikingRouteLayer = route
      hikingSegments = segments
    }
    if(type === 'photo'){
      photoRouteLayer = route
      photoSegments = segments
    }
    console.log('✅ '+name+'加载成功，轨迹段数：',segments.length)
  }catch(error){
    console.error(name+'加载失败:', error)
  }
}

// 不回头极限徒步线路
loadRouteGeoJSON(
  '/data/不回头极限徒步线路.json',
  '不回头极限徒步线路',
  Cesium.Color.ORANGE.withAlpha(0.9),
  'hiking'
)
// 拍照浏览景点线路
loadRouteGeoJSON(
  '/data/拍照浏览景点线路.json',
  '拍照浏览景点线路',
  Cesium.Color.BLUE.withAlpha(0.9),
  'photo'
)

  // 加载 GPX 路线轨迹
  try {
    rawGpx1 = await Cesium.GpxDataSource.load('/data/上方山路线.gpx')
    route1Positions = getRoutePositions(rawGpx1)
    console.log('✅ 路线一轨迹点数量：', route1Positions.length)
  } catch (error) {
    console.error('❌ 上行路线加载失败', error)
  }

  // 默认渲染主路线
  if (route1Positions.length > 0) {
    routeLineEntity = viewer.entities.add({
      polyline: {
        positions: route1Positions,
        width: 12,
        material: Cesium.Color.fromCssColorString('#D4A574').withAlpha(0.9),
        clampToGround: true
      }
    })
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
  right: auto;
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
  transition: color 0.2s ease;
}
.layer-item:hover {
  color: #ffffff;
}
.layer-item input[type='checkbox'] {
  width: 16px;
  height: 16px;
  margin-right: 9px;
  cursor: pointer;
  accent-color: #d4a574;
}
.layer-label-text {
  font-weight: 500;
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
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
}
.route-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.4);
  color: #ffffff;
}
.route-btn.active {
  background: rgba(212, 165, 116, 0.28);
  border-color: rgba(235, 194, 135, 0.9);
  color: #ffffff;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.2),
    inset 0 1px 1px rgba(255, 255, 255, 0.2);
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
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.color-block.green {
  background-color: #00c800;
}
.color-block.yellow {
  background-color: #ffff00;
}
.color-block.red {
  background-color: #ff2222;
}
</style>
