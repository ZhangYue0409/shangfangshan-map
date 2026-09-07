import * as Cesium from 'cesium'

// 1. 图层配置：为 steps、cable、rest 配置专属的点颜色（color 属性），取消 icon 属性
export const layerConfigs = [
  { id: 'poi', name: '景点', url: '/data/mock_poi.geojson', visible: true, dataSource: null },
  { id: 'steps', name: '台阶', url: '/data/steps.geojson', visible: true, dataSource: null, color: '#FF9500' },
  { id: 'cable', name: '缆车', url: '/data/cable.geojson', visible: true, dataSource: null, color: '#007AFF', clampToGround: false },
  { id: 'rest', name: '休息点', url: '/data/rest.geojson', visible: true, dataSource: null, color: '#30D158' }
]

let globalPointDataSource = null
let defaultDotIconCache = null
const bubbleCache = new Map() // 缓存景点带字气泡
const circleDotCache = new Map() // 缓存带不同颜色的实心圆点图标

/**
 * 初始化 GeoJSON 图层
 */
export async function initGeoJsonLayers(viewer) {
  // 1. 强制清空旧数据源，防止热更新或多次调用导致的重复叠加
  viewer.dataSources.removeAll()
  globalPointDataSource = new Cesium.CustomDataSource('global_points')
  await viewer.dataSources.add(globalPointDataSource)

  // 关闭 Cesium 原生聚合
  globalPointDataSource.clustering.enabled = false

  // 生成高视角下的默认白色小气泡图标（供景点高视角使用）
  defaultDotIconCache = createDotCanvas()

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

      // 如果配置了颜色，则预先动态生成并缓存该颜色的实心圆点图标
      let layerCircleIcon = null
      if (layer.color) {
        if (!circleDotCache.has(layer.color)) {
          // 8 为圆点半径(px)，可根据需要自行调整大小
          circleDotCache.set(layer.color, createCircleDotCanvas(layer.color, 8))
        }
        layerCircleIcon = circleDotCache.get(layer.color)
      }

      const pointEntitiesToRemove = []

      for (const entity of ds.entities.values) {
        // --- 处理点位 ---
        if (Cesium.defined(entity.position)) {
          const poiName = entity.properties && entity.properties.name 
            ? entity.properties.name.getValue() 
            : '未命名点位'

          const pos = entity.position.getValue(Cesium.JulianDate.now())

          if (pos) {
            let targetImg = null
            let highViewImg = null
            let verticalOrigin = Cesium.VerticalOrigin.BOTTOM

            // 分支处理：如果有配置专有圆点图标（台阶、缆车、休息点）
            if (layerCircleIcon) {
              targetImg = layerCircleIcon
              highViewImg = layerCircleIcon // 保持为对应的彩色实心圆点
              verticalOrigin = Cesium.VerticalOrigin.CENTER // 实心圆点以中心对齐
            } else {
              // 景点（poi）保持使用 Canvas 动态绘制的带名称文字气泡
              if (!bubbleCache.has(poiName)) {
                bubbleCache.set(poiName, drawOriginalBubble(poiName))
              }
              targetImg = bubbleCache.get(poiName)
              highViewImg = defaultDotIconCache // 景点在高视角下切换为默认白色气泡
              verticalOrigin = Cesium.VerticalOrigin.BOTTOM // 气泡带尾巴，底端对齐
            }

            // 创建新的点位实体并加入全局统一的数据源
            const newPointEntity = globalPointDataSource.entities.add({
              name: poiName,
              position: pos,
              layerId: layer.id,
              show: layer.visible,
              properties: entity.properties,
              billboard: {
                image: targetImg,
                verticalOrigin: verticalOrigin,
                heightReference: isClamp ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              },
              // 保存近距离与高空视角图标以及垂直对齐方式供相机事件切换
              _bubbleImg: targetImg,
              _dotImg: highViewImg,
              _verticalOrigin: verticalOrigin
            })

            formatEntityDescription(newPointEntity)
          }

          pointEntitiesToRemove.push(entity)
        } 
        // --- 处理线段 ---
        else if (entity.polyline && layer.color) {
          entity.polyline.material = Cesium.Color.fromCssColorString(layer.color)
          entity.polyline.width = 5
          formatEntityDescription(entity)
        }
      }

      // 清理原始 ds 中的点，只保留线段/面
      pointEntitiesToRemove.forEach(e => ds.entities.remove(e))

      await viewer.dataSources.add(ds)
      ds.show = layer.visible
      layer.dataSource = ds

      console.log(`[图层加载成功] ${layer.name}`)
    } catch (err) {
      console.error(`[图层加载报错] ${layer.name}:`, err)
    }
  }

  // 3. 监听相机高度按视角切换图标样式（高视角 vs 低视角）
  const switchThreshold = 1000

  const updateMarkersByDistance = () => {
    const cameraHeight = viewer.camera.positionCartographic.height
    const isCloseView = cameraHeight < switchThreshold

    const entities = globalPointDataSource.entities.values
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]
      if (entity.billboard) {
        const targetImg = isCloseView ? entity._bubbleImg : entity._dotImg
        
        if (entity.billboard.image._value !== targetImg) {
          entity.billboard.image = targetImg
          // 低视角下如果切回景点气泡，恢复 BOTTOM，实心圆点保持在 CENTER
          entity.billboard.verticalOrigin = isCloseView ? entity._verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
      }
    }
  }

  viewer.camera.changed.addEventListener(updateMarkersByDistance)
  viewer.camera.percentageChanged = 0.05
  
  updateMarkersByDistance()
}

/**
 * 【新增函数】生成指定颜色的实心圆点 Canvas 图标（带白色描边和轻微阴影，提亮地图显示）
 * @param {string} color CSS 颜色字符串 (如 '#FF9500')
 * @param {number} radius 圆点半径 (px)
 */
function createCircleDotCanvas(color, radius = 8) {
  const canvas = document.createElement('canvas')
  const padding = 4 // 阴影与描边的留白
  const size = (radius + padding) * 2

  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const centerX = size / 2
  const centerY = size / 2

  // 1. 绘制软阴影
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 2

  // 2. 绘制白色外描边
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius + 1.5, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()

  // 清除阴影，绘制核心实心圆
  ctx.shadowColor = 'transparent'
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  return canvas.toDataURL('image/png')
}

/**
 * 绘制最原始版本的圆角气泡框 Canvas（景点近距离使用）
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
 * 绘制高视角下的“不带文字的白色半透明圆角气泡”图标（景点专用）
 */
function createDotCanvas() {
  const canvas = document.createElement('canvas')
  const width = 28
  const height = 20
  const arrowHeight = 5

  canvas.width = width
  canvas.height = height + arrowHeight
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 2

  const x = 0.5, y = 0.5, w = width - 1, h = height - 1, r = 8

  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)

  const centerX = width / 2
  ctx.lineTo(centerX + 4, y + h)
  ctx.lineTo(centerX, y + h + arrowHeight)
  ctx.lineTo(centerX - 4, y + h)

  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()

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
    for (const entity of globalPointDataSource.entities.values) {
      if (entity.layerId === layer.id) {
        entity.show = layer.visible
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