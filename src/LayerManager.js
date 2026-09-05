import * as Cesium from 'cesium'

// 1. 图层配置： steps、cable、rest 属性中指定对应的 PNG 图标
export const layerConfigs = [
  { id: 'poi', name: '景点', url: '/data/mock_poi.geojson', visible: true, dataSource: null },
  { id: 'steps', name: '台阶', url: '/data/steps.geojson', visible: true, dataSource: null, color: '#FF9500', icon: '/data/台阶.png' },
  { id: 'cable', name: '缆车', url: '/data/cable.geojson', visible: true, dataSource: null, color: '#007AFF', clampToGround: false, icon: '/data/缆车.png' },
  { id: 'rest', name: '休息点', url: '/data/rest.geojson', visible: true, dataSource: null, icon: '/data/休息点.png' }
]

let globalPointDataSource = null
let dotIconCache = null
const bubbleCache = new Map() // 缓存景点带字气泡
const combinedIconCache = new Map() // 缓存带底框的 PNG 合成图标，避免重复绘制

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

  // 生成高视角下的不带文字透明小气泡图标
  dotIconCache = createDotCanvas()

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

      // 预先合成并缓存当前图层的带底框图标（提升批处理性能）
      let layerCombinedIcon = null
      if (layer.icon) {
        if (!combinedIconCache.has(layer.icon)) {
          // 第二个参数 28 表示中间图标的显示大小(px)，可以根据需要自行微调
          const synthesized = await createIconWithBackground(layer.icon, 28)
          combinedIconCache.set(layer.icon, synthesized)
        }
        layerCombinedIcon = combinedIconCache.get(layer.icon)
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

            // 分支处理：如果有配置 icon（台阶、缆车、休息点），使用 Canvas 合成后的带底框图标
            if (layerCombinedIcon) {
              targetImg = layerCombinedIcon
            } else {
              // 景点（poi）保持使用 Canvas 动态绘制的带名称文字气泡
              if (!bubbleCache.has(poiName)) {
                bubbleCache.set(poiName, drawOriginalBubble(poiName))
              }
              targetImg = bubbleCache.get(poiName)
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
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: isClamp ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              },
              // 保存近距离与高空视角图标供相机事件切换
              _bubbleImg: targetImg,
              _dotImg: layer.icon ? targetImg : dotIconCache // 若想图标在远视角也变成统一白色小圆点，可改成 dotIconCache
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

  // 3. 监听相机高度按视角切换图标样式（高视角小气泡 vs 低视角带图/带字气泡）
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
          entity.billboard.verticalOrigin = Cesium.VerticalOrigin.BOTTOM
        }
      }
    }
  }

  viewer.camera.changed.addEventListener(updateMarkersByDistance)
  viewer.camera.percentageChanged = 0.05
  
  updateMarkersByDistance()
}

/**
 * 【关键函数】将透明 PNG 图标与白色圆角底框实时合成
 * @param {string} iconUrl PNG 图标路径
 * @param {number} iconSize 内部 PNG 图标绘制像素尺寸
 */
function createIconWithBackground(iconUrl, iconSize = 28) {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = iconUrl
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      const padding = 8 // 图标四周的留白宽度
      const boxWidth = iconSize + padding * 2
      const boxHeight = iconSize + padding * 2
      const arrowHeight = 6 // 底部小尖角高度

      canvas.width = boxWidth
      canvas.height = boxHeight + arrowHeight

      // 1. 绘制底框背景与轻微阴影效果
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetY = 3

      const x = 0.5, y = 0.5, w = boxWidth - 1, h = boxHeight - 1, r = 10

      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)

      // 绘制底部指向小尖角
      const centerX = boxWidth / 2
      ctx.lineTo(centerX + 5, y + h)
      ctx.lineTo(centerX, y + h + arrowHeight)
      ctx.lineTo(centerX - 5, y + h)

      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
      ctx.fill()

      // 2. 清除阴影（防止图标本身产生重复重叠阴影），绘制图标
      ctx.shadowColor = 'transparent'
      ctx.drawImage(img, padding, padding, iconSize, iconSize)

      resolve(canvas.toDataURL('image/png'))
    }

    // 图片加载失败降级方案：直接返回原 URL
    img.onerror = () => {
      console.warn(`[图片加载失败] ${iconUrl}，使用原始图片渲染`)
      resolve(iconUrl)
    }
  })
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
 * 绘制高视角下的“不带文字的白色半透明圆角气泡”图标
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
  const slope = properties.avg_slope ? properties.avg_slope.getValue() : ''

  let imagesList = []
  if (properties.image_urls) {
    imagesList = properties.image_urls.getValue()
  } else if (properties.image_url) {
    imagesList = [properties.image_url.getValue()]
  }

  entity.description = `
    <div style="padding: 16px; color: #ffffff; font-family: sans-serif; font-size: 18px; line-height: 1.6;">
      ${descText ? `<p style="margin-bottom: 12px; color: #ffffff; font-size: 16px;">${descText}</p>` : ''}
      ${slope ? `<p style="color: #30d158; margin-bottom: 12px; font-size: 18px;"><b>平均坡度：</b>${slope}</p>` : ''}
      ${imagesList.length > 0 
        ? imagesList.map((url) => `<img src="${url}" style="width:100%; border-radius:10px; margin-bottom:10px; display:block;" />`).join('') 
        : ''}
    </div>
  `
}