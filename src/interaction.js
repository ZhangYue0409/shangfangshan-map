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

    // 给 POI 设置基本外观（黄色小圆点/图标）
    poiDataSource.entities.values.forEach(entity => {
      if (entity.point) {
        entity.point.pixelSize = 12
        entity.point.color = Cesium.Color.YELLOW
        entity.point.outlineColor = Cesium.Color.BLACK
        entity.point.outlineWidth = 2
        entity.point.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND
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
          // 提取约定的字段：name, description, image_url, avg_slope 等
          const poiData = {
            name: properties.name ? properties.name.getValue() : '未命名点位',
            description: properties.description ? properties.description.getValue() : '暂无详细介绍',
            imageUrl: properties.image_url ? properties.image_url.getValue() : '',
            slope: properties.avg_slope ? properties.avg_slope.getValue() : null,
            rawProperties: properties
          }

          // 更新响应式变量（方便模块4使用）
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