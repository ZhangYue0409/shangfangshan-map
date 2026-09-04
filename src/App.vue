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
    <div id="cesium-container"></div>  </div>
</template><script setup>
import { onMounted, ref } from 'vue'
import * as Cesium from 'cesium'
import { initInteraction } from './interaction.js'

// 当前选中的路线
const currentRoute = ref('route1')

let viewer = null
let dataSourceRoute1 = null
let dataSourceRoute2 = null

// 切换路线
function switchRoute(route) {
if (currentRoute.value === route) return
currentRoute.value = route

// 移除当前显示的数据源
if (dataSourceRoute1 && viewer.dataSources.contains(dataSourceRoute1)) {
viewer.dataSources.remove(dataSourceRoute1)
}
if (dataSourceRoute2 && viewer.dataSources.contains(dataSourceRoute2)) {
viewer.dataSources.remove(dataSourceRoute2)
}

// 添加选中的
if (route === 'route1' && dataSourceRoute1) {
viewer.dataSources.add(dataSourceRoute1)
viewer.zoomTo(dataSourceRoute1)
console.log('✅ 切换到上行路线')
} else if (route === 'route2' && dataSourceRoute2) {
viewer.dataSources.add(dataSourceRoute2)
viewer.zoomTo(dataSourceRoute2)
console.log('✅ 切换到下行路线')
}
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
const buildin= await Cesium.createOsmBuildingsAsync()
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

// ============================================================
// 🗺️ 加载两条 GPX 路线
// ============================================================

// 路线一：上行（金色）
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
})
dataSourceRoute1 = gpx1
console.log('✅ 上行路线加载成功')
} catch (error) {
console.error('❌ 上行路线加载失败:', error)
}

// 路线二：下行（蓝色）
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
})
dataSourceRoute2 = gpx2
console.log('✅ 下行路线加载成功')
} catch (error) {
console.error('❌ 下行路线加载失败:', error)
console.warn('💡 请确保 public/data/ 目录下有 上方山路线2.gpx 文件')
}

// 默认显示路线一
if (dataSourceRoute1) {
viewer.dataSources.add(dataSourceRoute1)
viewer.zoomTo(dataSourceRoute1)
console.log('📍 默认显示上行路线')
} else if (dataSourceRoute2) {
currentRoute.value = 'route2'
viewer.dataSources.add(dataSourceRoute2)
viewer.zoomTo(dataSourceRoute2)
console.log('📍 默认显示下行路线')
}

window.viewer = viewer
})
</script><style scoped>
#cesium-container {
width: 100vw;
height: 100vh;
margin: 0;
padding: 0;
overflow: hidden;
}

/* 控制面板 - 左上角，与地图左边界对齐 */
.control-panel {
position: absolute;
top: 20px;
left: 0;                     /* 与地图左边界对齐 */
z-index: 100;
background: rgba(0, 0, 0, 0.7);
backdrop-filter: blur(10px);
border-radius: 12px;
padding: 16px 20px;
padding-left: 24px;          /* 左侧留一点呼吸空间 */
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
border: 1px solid rgba(255,255,255,0.2);
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
background: rgba(255,255,255,0.15);
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