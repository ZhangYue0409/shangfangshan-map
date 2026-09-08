import * as Cesium from 'cesium'

// 1. 图层配置：为 steps、cable、rest 配置专属的点颜色，poi 设置默认色
export const layerConfigs = [
  { id: 'poi', name: '景点', url: '/data/mock_poi.geojson', visible: true, dataSource: null, color: '#FFFFFF' },
  { id: 'steps', name: '台阶', url: '/data/steps.geojson', visible: true, dataSource: null, color: '#FF9500' },
  { id: 'cable', name: '缆车', url: '/data/cable.geojson', visible: true, dataSource: null, color: '#007AFF', clampToGround: false },
  { id: 'rest', name: '休息点', url: '/data/rest.geojson', visible: true, dataSource: null, color: '#30D158' }
]

let globalPointDataSource = null
const bubbleCache = new Map() // 缓存景点带名字的大气泡
const circleDotCache = new Map() // 缓存带不同颜色的实心圆点图标（台阶、缆车、休息点）

// 定义高视角下允许常显的核心景点名称
const CORE_POI_NAMES = ['上方山国家森林公园入口', '兜率寺', '天坑']

/**
 * 初始化 GeoJSON 图层
 */
export async function initGeoJsonLayers(viewer) {
  // 1. 强制清空旧数据源
  viewer.dataSources.removeAll()
  globalPointDataSource = new Cesium.CustomDataSource('global_points')
  await viewer.dataSources.add(globalPointDataSource)

  globalPointDataSource.clustering.enabled = false

  // 2. 遍历加载所有 GeoJSON 图层
  for (const layer of layerConfigs) {
    try {
      const isClamp = layer.clampToGround !== undefined ? layer.clampToGround : true
      const ds = new Cesium.GeoJsonDataSource(layer.id)

      await ds.load(layer.url, {
        clampToGround: isClamp,
        stroke: layer.color ? Cesium.Color.fromCssColorString(layer.color) : Cesium.Color.WHITE,
        strokeWidth: 4
      })

      // 预先动态生成并缓存其他图层的实心圆点图标
      let layerCircleIcon = null
      if (layer.color && layer.id !== 'poi') {
        if (!circleDotCache.has(layer.color)) {
          circleDotCache.set(layer.color, createCircleDotCanvas(layer.color, 8))
        }
        layerCircleIcon = circleDotCache.get(layer.color)
      }

      const pointEntitiesToRemove = []

      for (const entity of ds.entities.values) {
        if (Cesium.defined(entity.position)) {
          const poiName = entity.properties && entity.properties.name 
            ? entity.properties.name.getValue() 
            : '未命名点位'

          const pos = entity.position.getValue(Cesium.JulianDate.now())

          if (pos) {
            let targetImg = null
            let verticalOrigin = Cesium.VerticalOrigin.BOTTOM

            if (layerCircleIcon) {
              // 台阶、缆车、休息点使用彩色实心圆点
              targetImg = layerCircleIcon
              verticalOrigin = Cesium.VerticalOrigin.CENTER 
            } else {
              // 景点（poi）一律使用带名字的白色圆角大气泡
              if (!bubbleCache.has(poiName)) {
                bubbleCache.set(poiName, drawOriginalBubble(poiName))
              }
              targetImg = bubbleCache.get(poiName)
              verticalOrigin = Cesium.VerticalOrigin.BOTTOM 
            }

            // 计算高视角下初始显隐状态（如果是 poi 且默认是高视角，则根据是否核心景点决定初始 show）
            const cameraHeight = viewer.camera.positionCartographic.height
            const isCloseView = cameraHeight < 1000
            let initialShow = layer.visible

            if (layer.id === 'poi' && !isCloseView) {
              initialShow = layer.visible && CORE_POI_NAMES.includes(poiName)
            }

            const newPointEntity = globalPointDataSource.entities.add({
              name: poiName,
              position: pos,
              layerId: layer.id,
              show: initialShow,
              properties: entity.properties,
              billboard: {
                image: targetImg,
                verticalOrigin: verticalOrigin,
                heightReference: isClamp ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              }
            })

            formatEntityDescription(newPointEntity)
          }

          pointEntitiesToRemove.push(entity)
        } 
        else if (entity.polyline && layer.color) {
          entity.polyline.material = Cesium.Color.fromCssColorString(layer.color)
          entity.polyline.width = 5
          formatEntityDescription(entity)
        }
      }

      pointEntitiesToRemove.forEach(e => ds.entities.remove(e))

      await viewer.dataSources.add(ds)
      ds.show = layer.visible
      layer.dataSource = ds

      console.log(`[图层加载成功] ${layer.name}`)
    } catch (err) {
      console.error(`[图层加载报错] ${layer.name}:`, err)
    }
  }

  // 3. 监听相机高度按视角切换“景点显隐”
  const switchThreshold = 1000

  const updateMarkersByDistance = () => {
    const cameraHeight = viewer.camera.positionCartographic.height
    const isCloseView = cameraHeight < switchThreshold

    const parentLayer = layerConfigs.find(l => l.id === 'poi')
    const isPoiLayerVisible = parentLayer ? parentLayer.visible : true

    const entities = globalPointDataSource.entities.values
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]
      if (entity.layerId === 'poi') {
        if (!isPoiLayerVisible) {
          entity.show = false
        } else if (!isCloseView) {
          // 高视角下：只显示 3 个核心景点，隐藏其他景点
          entity.show = CORE_POI_NAMES.includes(entity.name)
        } else {
          // 近视角下：显示所有景点
          entity.show = true
        }
      }
    }
  }

  viewer.camera.changed.addEventListener(updateMarkersByDistance)
  viewer.camera.percentageChanged = 0.05
  
  updateMarkersByDistance()
}

/**
 * 生成指定颜色的实心圆点 Canvas 图标（台阶、缆车、休息点使用）
 */
function createCircleDotCanvas(color, radius = 8) {
  const canvas = document.createElement('canvas')
  const padding = 4 
  const size = (radius + padding) * 2

  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const centerX = size / 2
  const centerY = size / 2

  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 2

  ctx.beginPath()
  ctx.arc(centerX, centerY, radius + 1.5, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  return canvas.toDataURL('image/png')
}

/**
 * 绘制带名字的白色圆角气泡框 Canvas（所有景点统一使用）
 */
function drawOriginalBubble(text) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  const fontStyle = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.font = fontStyle
  const textMetrics = ctx.measureText(text)

  const paddingX = 24
  const width = Math.ceil(textMetrics.width + paddingX * 2)
  const height = 46
  const arrowHeight = 8

  canvas.width = width
  canvas.height = height + arrowHeight

  ctx.fillStyle = 'rgba(255, 255, 255, 0.60)'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 4

  const x = 0.5, y = 0.5, w = width - 1, h = height - 1, r = 16

  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)

  const centerX = width / 2
  ctx.lineTo(centerX + 7, y + h)
  ctx.lineTo(centerX, y + h + arrowHeight)
  ctx.lineTo(centerX - 7, y + h)

  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.fillStyle = '#1c1c1e'
  ctx.font = fontStyle
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width / 2, height / 2)

  return canvas.toDataURL('image/png')
}

/**
 * 控制图层显隐
 */
export function toggleLayerVisibility(layer) {
  if (layer.dataSource) {
    layer.dataSource.show = layer.visible
  }
  if (globalPointDataSource) {
    const cameraHeight = window.viewer ? window.viewer.camera.positionCartographic.height : 0
    const isCloseView = cameraHeight < 1000

    for (const entity of globalPointDataSource.entities.values) {
      if (entity.layerId === layer.id) {
        if (layer.id === 'poi') {
          if (!layer.visible) {
            entity.show = false
          } else {
            // 受视角高度和是否核心景点的约束
            const isCorePoi = CORE_POI_NAMES.includes(entity.name)
            entity.show = isCloseView ? true : isCorePoi
          }
        } else {
          entity.show = layer.visible
        }
      }
    }
  }
}

/**
 * 格式化实体的描述面板 HTML 内容
 */
function formatEntityDescription(entity) {
  const properties = entity.properties
  if (!properties) return

  const descText = properties.description ? properties.description.getValue() : ''

  let imagesList = []
  if (properties.image_urls) {
    imagesList = properties.image_urls.getValue()
  } else if (properties.image_url) {
    imagesList = [properties.image_url.getValue()]
  }

  const hasImages = imagesList.length > 0

  entity.description = `
    <div style="padding: 16px; color: #ffffff; font-family: sans-serif; font-size: 16px; line-height: 1.6; box-sizing: border-box;">
      ${descText ? `<p style="margin: 0 0 12px 0; color: rgba(255, 255, 255, 0.9); font-size: 15px; text-align: justify;">${descText}</p>` : ''}
      ${hasImages 
        ? imagesList.map((url) => `
            <img 
              src="${url}" 
              style="
                width: 100%; 
                height: auto; 
                max-height: none; 
                object-fit: contain; 
                border-radius: 12px; 
                margin-bottom: 12px; 
                display: block;
              " 
            />
          `).join('') 
        : ''}
    </div>
  `
}