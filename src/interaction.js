import * as Cesium from 'cesium'
import { ref } from 'vue'

// 1. 定义一个 Vue 响应式变量，用于存储当前选中的 POI 数据，方便后续传给网页侧边栏
export const selectedPoi = ref(null)

/**
 * 初始化地图交互与 POI 点击响应
 * @param {Cesium.Viewer} viewer 
 */
export async function initInteraction(viewer) {
  try {
    // 2. 加载 POI 点数据
    const poiDataSource = await Cesium.GeoJsonDataSource.load('/data/mock_poi.geojson')
    await viewer.dataSources.add(poiDataSource)

    // 给 POI 设置基本外观，并为其格式化 description 支持多图显示
    poiDataSource.entities.values.forEach(entity => {
      // ---- 外观设置 ----
      if (entity.point) {
        entity.point.pixelSize = 12
        entity.point.color = Cesium.Color.YELLOW
        entity.point.outlineColor = Cesium.Color.BLACK
        entity.point.outlineWidth = 2
        entity.point.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND
      }

      // ---- 属性解析与 Description 拼接 ----
      const properties = entity.properties
      if (properties) {
        const descText = properties.description ? properties.description.getValue() : ''
        const slope = properties.avg_slope ? properties.avg_slope.getValue() : ''

        // 提取图片列表：优先读取多图数组 image_urls，若无则读取单图字符串 image_url
        let imagesList = []
        if (properties.image_urls) {
          imagesList = properties.image_urls.getValue()
        } else if (properties.image_url) {
          imagesList = [properties.image_url.getValue()]
        }

        // 生成图片 HTML 列表
        const imagesHtml = imagesList.map(url => `
          <img src="${url}" 
               alt="POI图片" 
               style="width: 100%; height: auto; border-radius: 6px; border: 1px solid #444;" />
        `).join('')

        // 将拼装好的 HTML 赋给实体的 description 属性（供 Cesium 默认气泡弹窗展示）
        entity.description = `
          <div style="padding: 4px; font-family: sans-serif; color: #fff;">
            <p style="margin: 0 0 8px 0; line-height: 1.5; color: #dcdcdc;">${descText}</p>
            ${slope ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #4caf50;"><b>平均坡度：</b>${slope}</p>` : ''}
            ${imagesList.length > 0 ? `
              <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto;">
                ${imagesHtml}
              </div>
            ` : ''}
          </div>
        `
      }
    })

    console.log('✅ POI 兴趣点加载成功！')

    // 3. 创建鼠标事件监听器 (ScreenSpaceEventHandler)
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene)

    // 监听鼠标左键点击事件
    handler.setInputAction((click) => {
      // 获取点击位置选中的实体 (Entity)
      const pickedObject = viewer.scene.pick(click.position)

      if (Cesium.defined(pickedObject) && pickedObject.id) {
        const entity = pickedObject.id
        
        // 读取 GeoJSON 里存的 properties 属性
        const properties = entity.properties

        if (properties) {
          // 提取图片列表（支持 image_urls 数组与单图 image_url 兼容）
          let imagesList = []
          if (properties.image_urls) {
            imagesList = properties.image_urls.getValue()
          } else if (properties.image_url) {
            imagesList = [properties.image_url.getValue()]
          }

          // 构造传递给 Vue 响应式变量的数据结构
          const poiData = {
            name: properties.name ? properties.name.getValue() : '未命名点位',
            description: properties.description ? properties.description.getValue() : '暂无详细介绍',
            imageUrls: imagesList, // 多图数组
            imageUrl: imagesList[0] || '', // 保留首张图兼容性
            slope: properties.avg_slope ? properties.avg_slope.getValue() : null,
            rawProperties: properties
          }

          // 更新响应式变量（供 Vue 侧边栏组件同步渲染）
          selectedPoi.value = poiData

          // 🌟 核心任务：在控制台打印提取出的点击数据！
          console.log('🎯 [点击拾取成功] 选中的数据信息如下：', poiData)
        }
      } else {
        // 点击空白处清空选中状态
        selectedPoi.value = null
        console.log('💡 点击了空白区域')
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  } catch (error) {
    console.error('❌ 加载 POI 或初始化交互失败（请检查 public/data/mock_poi.geojson 是否存在）:', error)
  }
}