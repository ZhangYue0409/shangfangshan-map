import * as Cesium from 'cesium'

export const layerConfigs = [
  { id: 'poi', name: '景点', url: '/data/mock_poi.geojson', visible: true, dataSource: null },
  { id: 'steps', name: '台阶', url: '/data/steps.geojson', visible: true, dataSource: null, color: '#FF9500' },
  { id: 'cable', name: '缆车', url: '/data/cable.geojson', visible: true, dataSource: null, color: '#007AFF', clampToGround: false },
  { id: 'rest', name: '休息点', url: '/data/rest.geojson', visible: true, dataSource: null }
]

let globalPointDataSource = null
let dotIconCache = null
const bubbleCache = new Map() // 缓存画好的原始气泡，避免重复绘制

/**
 * 初始化 GeoJSON 图层
 */
export async function initGeoJsonLayers(viewer) {
  // 1. 强制清空旧数据源，防止热更新或多次调用导致的重复叠加
  viewer.dataSources.removeAll()
  globalPointDataSource = new Cesium.CustomDataSource('global_points')
  await viewer.dataSources.add(globalPointDataSource)

  // 关闭 Cesium 原生聚合（改用高低视角图标切换）
  globalPointDataSource.clustering.enabled = false

  // 生成高视角下的不带文字透明气泡图标
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

      const pointEntitiesToRemove = []

      for (const entity of ds.entities.values) {
        // --- 处理点位 ---
        if (Cesium.defined(entity.position)) {
          const poiName = entity.properties && entity.properties.name 
            ? entity.properties.name.getValue() 
            : '未命名点位'

          const pos = entity.position.getValue(Cesium.JulianDate.now())

          if (pos) {
            // 获取/绘制最原始样式的气泡图片（带文字）
            if (!bubbleCache.has(poiName)) {
              bubbleCache.set(poiName, drawOriginalBubble(poiName))
            }
            const originalBubbleImg = bubbleCache.get(poiName)

            // 创建新的点位实体并加入全局统一的数据源
            const newPointEntity = globalPointDataSource.entities.add({
              name: poiName, // 设置实体名称（显示在弹窗标题栏）
              position: pos,
              layerId: layer.id,
              show: layer.visible, // 根据图层的 visible 状态设置显隐
              properties: entity.properties, // 保留原始属性
              billboard: {
                image: originalBubbleImg,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: isClamp ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              },
              // 自定义属性，保存近距离气泡图（带文字）与高空无字气泡图供相机事件切换使用
              _bubbleImg: originalBubbleImg,
              _dotImg: dotIconCache
            })

            // 为新生成的实体格式化并注入 description HTML 属性
            formatEntityDescription(newPointEntity)
          }

          // 标记原始点位待删除（避免与 line 重复或留在原始 ds 中）
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

  // 3. 监听相机高度，按视角动态切换图标样式（高视角无字气泡 vs 低视角文字气泡）
  const switchThreshold = 1000 // 高度阈值（米）：高于 1000 米显示小气泡，低于 1000 米显示带字大气泡

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
          // 两种气泡图锚点统一设在底部
          entity.billboard.verticalOrigin = Cesium.VerticalOrigin.BOTTOM
        }
      }
    }
  }

  // 绑定相机改变事件
  viewer.camera.changed.addEventListener(updateMarkersByDistance)
  viewer.camera.percentageChanged = 0.05 // 相机位置改变 5% 触发一次更新，提升性能
  
  // 初始化加载时主动检查一次
  updateMarkersByDistance()
}

/**
 * 绘制最原始版本的圆角气泡框 Canvas（近距离带有名称文字）
 */
function drawOriginalBubble(text) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  const fontStyle = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.font = fontStyle
  const textMetrics = ctx.measureText(text)

  const paddingX = 24  // 左右 padding
  const width = Math.ceil(textMetrics.width + paddingX * 2)
  const height = 46    // 气泡主体高度
  const arrowHeight = 8 // 下方小尖角高度

  canvas.width = width
  canvas.height = height + arrowHeight

  // 绘制白色半透明圆角背景与阴影
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

  // 底部小尖角
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

  // 绘制文本
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
  // 适合无文字微型气泡的尺寸
  const width = 28
  const height = 20
  const arrowHeight = 5

  canvas.width = width
  canvas.height = height + arrowHeight
  const ctx = canvas.getContext('2d')

  // 绘制白色半透明圆角背景与轻微阴影
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

  // 底部小尖角
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
 * 格式化实体的描述面板 HTML 内容（控制点击弹窗显示）
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