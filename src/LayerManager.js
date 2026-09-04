import * as Cesium from 'cesium'

/**
 * 生成：白色实心圆点 + 半透明白色外圆
 */
function createWhiteDotImage() {
  const canvas = document.createElement('canvas')
  const size = 64
  const center = size / 2

  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, size, size)

  // 半透明白色外圆
  ctx.beginPath()
  ctx.arc(center, center, 20, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // 白色实心圆点
  ctx.beginPath()
  ctx.arc(center, center, 8, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  return canvas.toDataURL('image/png')
}

const whiteDotIconUrl = createWhiteDotImage()

export const layerConfigs = [
  {
    id: 'poi',
    name: '景点',
    url: '/data/mock_poi.geojson',
    visible: true,
    dataSource: null
  },
  {
    id: 'steps',
    name: '台阶',
    url: '/data/steps.geojson',
    visible: true,
    dataSource: null,
    color: '#FF9500'
  },
  {
    id: 'cable',
    name: '缆车',
    url: '/data/cable.geojson',
    visible: true,
    dataSource: null,
    color: '#007AFF',
    clampToGround: false
  },
  {
    id: 'rest',
    name: '休息点',
    url: '/data/rest.geojson',
    visible: true,
    dataSource: null
  }
]

/**
 * 将一个 Cesium Billboard 强制改为白色点位图标。
 * 直接覆盖原有 Billboard，可消除 GeoJSON 默认蓝色 Pin。
 */
function setWhiteMarker(billboard, clampToGround) {
  billboard.image = whiteDotIconUrl
  billboard.width = 28
  billboard.height = 28
  billboard.heightReference = clampToGround
    ? Cesium.HeightReference.CLAMP_TO_GROUND
    : Cesium.HeightReference.NONE
  billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER
  billboard.horizontalOrigin = Cesium.HorizontalOrigin.CENTER
  billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY
  billboard.scaleByDistance = new Cesium.NearFarScalar(
    100,
    1.0,
    80000,
    0.4
  )
}

/**
 * 为所有 GeoJSON 实体应用统一样式
 */
function applyCustomStyle(dataSource, clampToGround = true, lineCustomColor = null) {
  for (const entity of dataSource.entities.values) {
    const isPoint = Cesium.defined(entity.position)

    if (isPoint) {
      // 清除可能叠加的 Cesium 默认圆点和文字
      entity.point = undefined
      entity.label = undefined

      // 若 GeoJSON 已创建默认蓝色 Billboard，直接覆盖它；
      // 否则才创建新的 Billboard。
      const billboard = entity.billboard || new Cesium.BillboardGraphics()

      setWhiteMarker(billboard, clampToGround)
      entity.billboard = billboard
    } else {
      // 非点位要素不显示图标
      entity.point = undefined
      entity.billboard = undefined

      // 线图层才设置线条颜色
      if (entity.polyline && lineCustomColor) {
        entity.polyline.material =
          Cesium.Color.fromCssColorString(lineCustomColor)
        entity.polyline.width = 5
      }
    }

    formatEntityDescription(entity)
  }
}

/**
 * 初始化全部 GeoJSON 图层
 */
export async function initGeoJsonLayers(viewer) {
  for (const layer of layerConfigs) {
    try {
      const isClamp =
        layer.clampToGround !== undefined ? layer.clampToGround : true

      const ds = new Cesium.GeoJsonDataSource(layer.id)

      await ds.load(layer.url, {
        clampToGround: isClamp,
        stroke: layer.color
          ? Cesium.Color.fromCssColorString(layer.color)
          : Cesium.Color.WHITE,
        strokeWidth: 4
      })

      // 每个数据源只允许加入地图一次
      await viewer.dataSources.add(ds)

      // 加入后立刻覆盖 Cesium 默认蓝色 Pin
      applyCustomStyle(ds, isClamp, layer.color)

      ds.show = layer.visible
      layer.dataSource = ds

      viewer.scene.requestRender()

      console.log(
        `[图层加载成功] ${layer.name}，实体数量：${ds.entities.values.length}`
      )
    } catch (error) {
      console.error(`[图层加载失败] ${layer.name}:`, error)
    }
  }
}

/**
 * 图层显隐切换
 */
export function toggleLayerVisibility(layer) {
  if (layer.dataSource) {
    layer.dataSource.show = layer.visible
  }
}

/**
 * 保留供点击交互使用的属性和描述
 */
function formatEntityDescription(entity) {
  const properties = entity.properties
  if (!properties) return

  const descText = properties.description
    ? properties.description.getValue()
    : ''

  const slope = properties.avg_slope
    ? properties.avg_slope.getValue()
    : ''

  let imagesList = []

  if (properties.image_urls) {
    imagesList = properties.image_urls.getValue()
  } else if (properties.image_url) {
    imagesList = [properties.image_url.getValue()]
  }

  entity.description = `
    <div style="
      padding: 22px 24px;
      box-sizing: border-box;
      color: rgba(255,255,255,0.96);
      font-family: -apple-system, BlinkMacSystemFont, 'Microsoft YaHei', sans-serif;
    ">
      ${
        descText
          ? `
            <p style="
              margin: 0 0 18px;
              font-size: 19px;
              line-height: 1.7;
              font-weight: 400;
            ">
              ${descText}
            </p>
          `
          : ''
      }

      ${
        slope
          ? `
            <p style="
              margin: 0 0 18px;
              font-size: 18px;
              line-height: 1.6;
              color: #30d158;
              font-weight: 600;
            ">
              <b>平均坡度：</b>${slope}
            </p>
          `
          : ''
      }

      ${
        imagesList.length > 0
          ? imagesList
              .map(
                (url) => `
                  <img
                    src="${url}"
                    alt="图片"
                    style="
                      display: block;
                      width: 100%;
                      height: auto;
                      margin: 0 0 14px;
                      border: 1px solid rgba(255,255,255,0.22);
                      border-radius: 12px;
                    "
                  />
                `
              )
              .join('')
          : ''
      }
    </div>
  `
}