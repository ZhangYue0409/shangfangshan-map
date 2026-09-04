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
          路线1
        </button>
        <button
          :class="['route-btn', { active: currentRoute === 'route2' }]"
          @click="switchRoute('route2')"
        >
          路线2
        </button>
        <!--新增关闭路线按钮-->
        <button
          class="route-btn"
          @click="closeAllRoute"
        >
          关闭路线
        </button>
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
          路线1坡度
        </button>
        <button
          :class="['route-btn', { active: slopeTarget === 'route2' }]"
          @click="setSlopeLayer('route2')"
        >
          路线2坡度
        </button>
      </div>
    </div>

    <!-- 坡度图例 移到左侧，放在坡度面板下方 -->
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
const currentRoute = ref('route1')
//坡度图层状态
const slopeTarget = ref('off')
const showSlopeLegend = ref(false)
let viewer = null
let dataSourceRoute1 = null
let dataSourceRoute2 = null
let route1Positions = []
let route2Positions = []
let flightInProgress = false
let flightStartTime = 0
let flightStopCallback = null
let slopeLayer = null
//自己实现headingFromPoints，修复API不存在报错（函数保留，暂不使用）
function headingFromPoints(pointA, pointB) {
  const cartoA = Cesium.Cartographic.fromCartesian(pointA)
  const cartoB = Cesium.Cartographic.fromCartesian(pointB)
  const deltaLon = cartoB.longitude - cartoA.longitude
  const deltaLat = cartoB.latitude - cartoA.latitude
  return Math.atan2(deltaLon, deltaLat)
}

//新增：关闭全部路线
function closeAllRoute(){
  //关闭路线同时销毁坡度、隐藏图例
  destroySlopeLayer()
  slopeTarget.value = 'off'
  currentRoute.value = null

  if (dataSourceRoute1 && viewer.dataSources.contains(dataSourceRoute1)) {
    viewer.dataSources.remove(dataSourceRoute1)
  }
  if (dataSourceRoute2 && viewer.dataSources.contains(dataSourceRoute2)) {
    viewer.dataSources.remove(dataSourceRoute2)
  }
  console.log('✅ 已关闭所有路线')
}

// 切换路线【已移除自动飞行】
function switchRoute(route) {
  // 无论切不切换路线，点击路线按钮都销毁坡度图层
  destroySlopeLayer()
  slopeTarget.value = 'off'
  showSlopeLegend.value = false
  if (currentRoute.value === route) return
  currentRoute.value = route
  // 停止正在进行的飞行
  if (flightInProgress && typeof flightStopCallback === 'function') {
    flightStopCallback()
    flightStopCallback = null
  }
  if (dataSourceRoute1 && viewer.dataSources.contains(dataSourceRoute1)) {
    viewer.dataSources.remove(dataSourceRoute1)
  }
  if (dataSourceRoute2 && viewer.dataSources.contains(dataSourceRoute2)) {
    viewer.dataSources.remove(dataSourceRoute2)
  }
  if (route === 'route1' && dataSourceRoute1) {
    viewer.dataSources.add(dataSourceRoute1)
    console.log('✅ 切换到上行路线')
    // --- 删除原自动飞行调用 flyAlongRoute(route1Positions, dataSourceRoute1) ---
  } else if (route === 'route2' && dataSourceRoute2) {
    viewer.dataSources.add(dataSourceRoute2)
    console.log('✅ 切换到下行路线')
  }
}
//销毁坡度图层
function destroySlopeLayer() {
  if(slopeLayer){
    slopeLayer.destroy()
    slopeLayer = null
  }
  showSlopeLegend.value = false
}
//坡度图层切换
async function setSlopeLayer(mode){
  destroySlopeLayer()
  slopeTarget.value = mode
  if(mode === 'off'){
    return
  }
  if(mode === 'route1'){
    if(!route1Positions || route1Positions.length <2){
      alert('路线1轨迹数据尚未加载完成！')
      slopeTarget.value = 'off'
      return
    }
    try{
      slopeLayer = await createSlopeLayer(viewer, route1Positions)
      showSlopeLegend.value = true
    }catch(e){
      console.error("坡度图层生成失败",e)
      alert("地形采样失败")
      slopeTarget.value = 'off'
    }
  }else if(mode === 'route2'){
    if(!route2Positions || route2Positions.length <2){
      alert('路线2轨迹数据尚未加载完成！')
      slopeTarget.value = 'off'
      return
    }
    try{
      slopeLayer = await createSlopeLayer(viewer, route2Positions)
      showSlopeLegend.value = true
    }catch(e){
      console.error("坡度图层生成失败",e)
      alert("地形采样失败")
      slopeTarget.value = 'off'
    }
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
// 沿路线飞行【函数保留，不再被切换按钮调用，可后续做飞行按钮使用】
function flyAlongRoute(positions, routeDataSource) {
  console.log("===进入飞行函数===")
  if (!viewer || positions.length < 2) return
  flightInProgress = true
  flightStartTime = Date.now()
  const pointsPerSecond = 0.8
  const smoothFactor = 0.025
  const alphaStart = 0.1
  const alphaRange = 0.5
  routeDataSource.entities.values.forEach(entity => {
    if (entity.polyline) {
      entity.polyline.material = Cesium.Color.fromCssColorString('#D4A574').withAlpha(alphaStart)
    }
  })
  flightStopCallback = () => {
    flightInProgress = false
    viewer.scene.postRender.removeEventListener(onPostRender)
  }
  function onPostRender() {
    if (!flightInProgress) return
    const elapsedMs = Date.now() - flightStartTime
    const elapsedSec = elapsedMs / 1000.0
    let currentPointIndex = elapsedSec * pointsPerSecond
    if (currentPointIndex >= positions.length - 1) {
      currentPointIndex = positions.length - 1
    }
    const idx = Math.floor(currentPointIndex)
    const tSeg = currentPointIndex - idx
    const i0 = Math.min(idx, positions.length - 1)
    const i1 = Math.min(idx + 1, positions.length - 1)
    const targetPoint = Cesium.Cartesian3.lerp(
      positions[i0], positions[i1], tSeg, new Cesium.Cartesian3()
    )
    const lookAheadIndex = Math.min(i1 + 15, positions.length - 1)
    const lookTarget = positions[lookAheadIndex]
    const camera = viewer.camera
    const smoothDest = Cesium.Cartesian3.lerp(camera.position, targetPoint, smoothFactor, new Cesium.Cartesian3())
    const targetHeading = headingFromPoints(targetPoint, lookTarget)
    const smoothHeading = Cesium.Math.lerp(camera.heading, targetHeading, smoothFactor)
    viewer.camera.setView({
      destination: smoothDest,
      orientation: {
        heading: smoothHeading,
        pitch: Cesium.Math.toRadians(-42),
        roll: 0
      }
    })
    const progress = currentPointIndex / (positions.length - 1)
    routeDataSource.entities.values.forEach(entity => {
      if (entity.polyline) {
        entity.polyline.material = Cesium.Color.fromCssColorString('#D4A574').withAlpha(alphaStart + progress * alphaRange)
      }
    })
    if (currentPointIndex >= positions.length - 1) {
      flightInProgress = false
      viewer.scene.postRender.removeEventListener(onPostRender)
      flightStopCallback = null
      console.log('✅ 路线飞行完成')
    }
  }
  viewer.scene.postRender.addEventListener(onPostRender)
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
    terrainProvider: terrainProvider,
    baseLayer: Cesium.ImageryLayer.fromWorldImagery()
  })
  // 初始视角（居中于路线）
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(115.8165, 39.6660, 1200),
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
  // 建筑
  try {
    const buildings = await Cesium.createOsmBuildingsAsync()
    viewer.scene.primitives.add(buildings)
  } catch (e) {
    console.warn('建筑加载失败', e)
  }
  // 3D Tiles
  try {
    const resource = await Cesium.IonResource.fromAssetId(5091450, {
      accessToken: tokenB
    })
    const tileset = await Cesium.Cesium3DTileset.fromUrl(resource)
    viewer.scene.primitives.add(tileset)
  } catch (error) {
    console.error('3DTiles 模型加载失败:', error)
  }
  // 上方山文字标签
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
  // 加载路线1（上行）
  try {
    const gpx1 = await Cesium.GpxDataSource.load(
      '/data/上方山路线.gpx',
      {
        trackColor: Cesium.Color.fromCssColorString('#D4A574'),
        routeColor: Cesium.Color.fromCssColorString('#D4A574')
      }
    )
    gpx1.entities.values.forEach(entity => {
      if (entity.polyline) {
        entity.polyline.width = 12
        entity.polyline.material = Cesium.Color.fromCssColorString('#D4A574').withAlpha(0.9)
        entity.polyline.clampToGround = true
      }
      if (entity.point) entity.show = false
    })
    dataSourceRoute1 = gpx1
    route1Positions = getRoutePositions(gpx1)
    console.log('✅路线一轨迹点数量：', route1Positions.length)
  } catch (error) {
    console.error('❌上行路线加载失败', error)
  }
  // 加载路线2（下行）
  try {
    const gpx2 = await Cesium.GpxDataSource.load(
      '/data/上方山路线2.gpx',
      {
        trackColor: Cesium.Color.fromCssColorString('#00BCD4'),
        routeColor: Cesium.Color.fromCssColorString('#00BCD4')
      }
    )
    gpx2.entities.values.forEach(entity => {
      if (entity.polyline) {
        entity.polyline.width = 12
        entity.polyline.material = Cesium.Color.fromCssColorString('#00BCD4').withAlpha(0.9)
        entity.polyline.clampToGround = true
      }
      if (entity.point) entity.show = false
    })
    dataSourceRoute2 = gpx2
    route2Positions = getRoutePositions(gpx2)
    console.log('✅下行路线加载成功，轨迹点数量：', route2Positions.length)
  } catch (error) {
    console.error('❌下行路线加载失败', error)
  }
  // 默认显示路线1
  if (dataSourceRoute1) {
    viewer.dataSources.add(dataSourceRoute1)
    viewer.zoomTo(dataSourceRoute1)
  } else if (dataSourceRoute2) {
    currentRoute.value = 'route2'
    viewer.dataSources.add(dataSourceRoute2)
    viewer.zoomTo(dataSourceRoute2)
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
.control-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 100;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px 20px;
  padding-left: 24px;
  min-width: 160px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.1);
  user-select: none;
  pointer-events: auto;
}
/*坡度面板向下偏移，和上方面板对齐，上下分开 */
.slope-panel{
  top: 215px;
}
.panel-title {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  letter-spacing: 1px;
  opacity: 0.8;
  text-align: center;
}
.route-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.route-btn {
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.199);
  border-radius: 8px;
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.7);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
  font-weight: 500;
}
.route-btn:hover {
  background: rgba(255, 255, 255, 0.244);
  color: #fff;
  border-color: rgba(255,255,255,0.4);
}
.route-btn.active {
  background: rgba(212, 165, 116, 0.3);
  border-color: #D4A574;
  color: #fff;
  box-shadow: 0 0 20px rgba(212, 165, 116, 0.1);
}
.route-btn.active:hover {
  background: rgba(212, 165, 116, 0.4);
}

/*坡度图例 放到左侧坡度面板下方 */
.slope-legend{
  position: absolute;
  top: 410px;
  left: 20px;
  z-index:100;
  background:rgba(0,0,0,0.7);
  backdrop-filter: blur(10px);
  padding:12px 16px;
  border-radius:10px;
  color:#ffffff;
  font-size:14px;
  border:1px solid rgba(255,255,255,0.12);
  min-width:160px;
}
.legend-title{
  text-align:center;
  font-weight:600;
  margin-bottom:8px;
  opacity:0.85;
}
.legend-item{
  display:flex;
  align-items:center;
  gap:8px;
  margin:5px 0;
}
.color-block{
  width:20px;
  height:10px;
  border-radius:2px;
  border:1px solid #666;
}
.color-block.green{
  background-color:#00c800;
}
.color-block.yellow{
  background-color:#ffff00;
}
.color-block.red{
  background-color:#ff2222;
}
</style>
