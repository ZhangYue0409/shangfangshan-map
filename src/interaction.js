import * as Cesium from 'cesium'
import { ref } from 'vue'

// Vue 响应式变量，存储当前选中的 POI
export const selectedPoi = ref(null)

/**
 * 动态生成 Apple 液态玻璃质感图标 (Canvas 绘制)
 * @param {string} text 图标中央显示的文字/符号，如果传入空或小圆点则绘制纯白圆芯
 * @returns {string} Data URL 格式图片
 */
function createGlassPinImage(text = '📍') {
  const canvas = document.createElement('canvas')
  const size = 64
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const center = size / 2
  const radius = 22

  // 1. 柔和的外模糊阴影
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4

  // 2. 玻璃主体半透明渐变底色（白色透明圆边）
  const glassGradient = ctx.createLinearGradient(0, 0, size, size)
  glassGradient.addColorStop(0, 'rgba(255, 255, 255, 0.75)')
  glassGradient.addColorStop(0.5, 'rgba(230, 240, 255, 0.4)')
  glassGradient.addColorStop(1, 'rgba(180, 210, 255, 0.25)')

  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.fillStyle = glassGradient
  ctx.fill()

  // 清除阴影，防止影响后续绘制
  ctx.shadowColor = 'transparent'

  // 3. Apple 玻璃特有的微窄高光内边框
  const borderGradient = ctx.createLinearGradient(0, 0, 0, size)
  borderGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  borderGradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)')

  ctx.beginPath()
  ctx.arc(center, center, radius - 1, 0, Math.PI * 2)
  ctx.strokeStyle = borderGradient
  ctx.lineWidth = 1.5
  ctx.stroke()

  // 🌟 4. 绘制中心实心【纯白小圆点】（替换原来的红色）
  const coreRadius = 7 // 中心纯白圆芯的半径，可根据需要调整大小
  ctx.beginPath()
  ctx.arc(center, center, coreRadius, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff' // 设置为白色
  
  // 增加微弱白色发光增强质感
  ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
  ctx.shadowBlur = 6
  ctx.fill()

  return canvas.toDataURL()
}

// 预先生成玻璃图标
const glassPinUrl = createGlassPinImage('📍')

/**
 * 初始化地图交互与 POI 点击响应
 * @param {Cesium.Viewer} viewer
 */
export async function initInteraction(viewer) {
  try {
    // 隐藏默认的突兀绿色选中方框
    if (viewer.selectionIndicator) {
      viewer.selectionIndicator.viewModel.visible = false
    }

    // 1. 加载 POI 点数据
    const poiDataSource = await Cesium.GeoJsonDataSource.load('/data/mock_poi.geojson')
    await viewer.dataSources.add(poiDataSource)

    // 给 POI 设置玻璃 Billboard 外观，并格式化 HTML 弹窗内容
    poiDataSource.entities.values.forEach(entity => {
      // ---- 外观设置：使用 Canvas 玻璃图标替代默认点 ----
      entity.point = undefined
      entity.billboard = {
        image: glassPinUrl,
        width: 46,
        height: 46,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        scaleByDistance: new Cesium.NearFarScalar(1.0e2, 1.0, 8.0e4, 0.5)
      }

      // ---- 属性解析与 Description 拼接 ----
      const properties = entity.properties
      if (properties) {
        const descText = properties.description ? properties.description.getValue() : ''
        const slope = properties.avg_slope ? properties.avg_slope.getValue() : ''

        let imagesList = []
        if (properties.image_urls) {
          imagesList = properties.image_urls.getValue()
        } else if (properties.image_url) {
          imagesList = [properties.image_url.getValue()]
        }

        // 赋给实体的 description 属性（直接在内部注入样式，完美穿透 iframe）
        entity.description = `
          <style>
            body, html {
              font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif !important;
              color: rgba(255, 255, 255, 0.95) !important;
              margin: 0 !important;
              padding: 0 !important;
              background: transparent !important;
              height: 100% !important;
            }
            .glass-infobox-content {
              padding: 28px;
              box-sizing: border-box;
            }
            .desc-text {
              margin: 0 0 20px 0 !important;
              line-height: 1.8 !important;
              font-size: 20px !important;
              letter-spacing: 0.5px !important;
              color: rgba(255, 255, 255, 0.92) !important;
            }
            .slope-text {
              margin: 0 0 24px 0 !important;
              font-size: 18px !important;
              color: #30d158 !important;
              font-weight: 600 !important;
              letter-spacing: 0.3px !important;
            }

            /* 🌟 核心改进：去除 max-height 限制，让图片展示区域充分拓展 */
            .images-wrapper {
              margin-top: 20px;
              display: flex;
              flex-direction: column;
              gap: 20px;
              width: 100%;
            }

            /* 🌟 图片自适应高分辨率展示 */
            .images-wrapper img {
              width: 100%;
              max-height: 650px; /* 单张图片在长弹窗下的最大高度放大 */
              object-fit: cover;  /* 确保图片填充时不拉伸变形 */
              border-radius: 16px;
              border: 1px solid rgba(255, 255, 255, 0.22);
              box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
            }
          </style>

          <div class="glass-infobox-content">
            <p class="desc-text">${descText}</p>
            ${slope ? `<p class="slope-text"><b>平均坡度：</b>${slope}</p>` : ''}
            ${imagesList.length > 0 ? `
              <div class="images-wrapper">
                ${imagesList.map(url => `<img src="${url}" alt="POI图片" />`).join('')}
              </div>
            ` : ''}
          </div>
        `
      }
    })

    console.log('✅ POI 玻璃质感兴趣点加载成功！')

    // 2. 创建鼠标事件监听器
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene)
    handler.setInputAction((click) => {
      const pickedObject = viewer.scene.pick(click.position)
      if (Cesium.defined(pickedObject) && pickedObject.id) {
        const entity = pickedObject.id
        const properties = entity.properties
        if (properties) {
          let imagesList = []
          if (properties.image_urls) {
            imagesList = properties.image_urls.getValue()
          } else if (properties.image_url) {
            imagesList = [properties.image_url.getValue()]
          }

          const poiData = {
            name: properties.name ? properties.name.getValue() : '未命名点位',
            description: properties.description ? properties.description.getValue() : '暂无详细介绍',
            imageUrls: imagesList,
            imageUrl: imagesList[0] || '',
            slope: properties.avg_slope ? properties.avg_slope.getValue() : null,
            rawProperties: properties
          }
          selectedPoi.value = poiData
          console.log('🎯 [点击拾取成功] 选中的数据信息如下：', poiData)
        }
      } else {
        selectedPoi.value = null
        console.log('💡 点击了空白区域')
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  } catch (error) {
    console.error('❌ 加载 POI 或初始化交互失败:', error)
  }
}