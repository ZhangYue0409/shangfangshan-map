import * as Cesium from 'cesium'
import { ref } from 'vue'

export const selectedPoi = ref(null)

/**
 * 初始化地图点击交互与实体 (Entity) 拾取
 * @param {Cesium.Viewer} viewer 
 */
export async function initInteraction(viewer) {
  try {
    if (!viewer || !viewer.scene) return

    // 禁用默认的选择框
    if (viewer.selectionIndicator) {
      viewer.selectionIndicator.viewModel.visible = false
    }

    // ⚠️ 关键修复：ScreenSpaceEventHandler 必须绑定到 viewer.scene.canvas 上！
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

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
            name: properties.name ? properties.name.getValue() : (entity.name || '未命名点位'),
            description: properties.description ? properties.description.getValue() : '',
            imageUrls: imagesList,
            imageUrl: imagesList[0] || '',
            slope: properties.avg_slope ? properties.avg_slope.getValue() : null,
            rawProperties: properties
          }

          selectedPoi.value = poiData
          console.log('🎯 [点击拾取成功]：', poiData)
        }
      } else {
        selectedPoi.value = null
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  } catch (error) {
    console.error('❌ 初始化点击交互失败:', error)
  }
}