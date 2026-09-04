<template>
  <div>
    <!-- 控制面板 -->
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
      </div>
    </div>

    <div id="cesium-container"></div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import * as Cesium from 'cesium'
import { initInteraction } from './interaction.js'

const currentRoute = ref('route1')

let viewer = null
let dataSourceRoute1 = null
let dataSourceRoute2 = null
let route1Positions = []

let flightInProgress = false
let flightStartTime = 0
let flightStopCallback = null

// 切换路线
function switchRoute(route) {
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
    if (route1Positions.length > 0) {
      flyAlongRoute(route1Positions, dataSourceRoute1)
    }
  } else if (route === 'route2' && dataSourceRoute2) {
    viewer.dataSources.add(dataSourceRoute2)
    console.log('✅ 切换到下行路线')
  }
}

// 提取GPX轨迹点，Cartographic转Cartesian3
function getRoutePositions(dataSource) {
  const positions = []
  if (!dataSource || !dataSource.entities) return positions
  dataSource.entities.values.forEach(entity => {
    if (entity.polyline && entity.polyline.positions) {
      const cartos = entity.polyline.positions.getValue(Cesium.JulianDate.now())
      if (cartos) {
        for (const c of cartos) {
          const cart3 = Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, c.height + 80)
          positions.push(cart3)
        }
      }
    }
  })
  return positions
}

// 沿路线飞行：按每秒轨迹点控制速度
function flyAlongRoute(positions, routeDataSource) {
  console.log("===进入飞行函数===")
  if (!viewer || positions.length < 2) return
  flightInProgress = true
  flightStartTime = Date.now()

  // ========= 速度控制参数 =========
  const pointsPerSecond = 0.8    // 每秒前进轨迹点，越小越慢
  const smoothFactor = 0.025     // 相机平滑系数
  const alphaStart = 0.1         // 路线初始透明度
  const alphaRange = 0.5         // 路线最大增加透明度

  // 初始路线透明
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
    const targetHeading = Cesium.Cartesian3.headingFromPoints(targetPoint, lookTarget)
    const smoothHeading = Cesium.Math.lerp(camera.heading, targetHeading, smoothFactor)

    viewer.camera.setView({
      destination: smoothDest,
      orientation: {
        heading: smoothHeading,
        pitch: Cesium.Math.toRadians(-42),
        roll: 0
      }
    })

    // 路线展开，按轨迹进度
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
  const tokenB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkODliZDAyMi1mNzY2LTQwMmYtOTNjNi1lOGY5OGYzMjQ4YmUiLCJpZCI6NDYwNjY1LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODUwNjg5OTJ9.snV-HHPbKFHGnIL0nWyCtIklA8JEi9mtmVXSxxxzZKU'

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
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(115.8158, 39.6638, 30),
      orientation: { pitch: -30, heading: 0, roll: 0 }
    })
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
        clampToGround: true,
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
        clampToGround: true,
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
    console.log('✅下行路线加载成功')
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
  left: 0;
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
</style>