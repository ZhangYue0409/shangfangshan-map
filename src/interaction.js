// interaction.js
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

    // 🌟 【核心逻辑】监听 Cesium 选中的 Entity 变化，动态切换 InfoBox 弹窗高度
    viewer.selectedEntityChanged.addEventListener((entity) => {
      // 查找页面上的 cesium-infoBox 元素
      const infoBoxElement = viewer.infoBox?.container?.querySelector('.cesium-infoBox')
      if (!infoBoxElement) return

      if (entity && entity.properties) {
        // 1. 判断当前实体是否有图片数据
        const props = entity.properties
        const hasImages = (props.image_urls && props.image_urls.getValue()?.length > 0) || 
                          (props.image_url && props.image_url.getValue())

        // 2. 有图片设为 75vh (固定最大高度)，无图片设为 fit-content (自适应包裹)
        if (hasImages) {
          infoBoxElement.style.setProperty('height', '75vh', 'important')
        } else {
          infoBoxElement.style.setProperty('height', 'fit-content', 'important')
        }
      } else {
        // 未选中任何实体时恢复默认自适应
        infoBoxElement.style.setProperty('height', 'fit-content', 'important')
      }
    })

    // ScreenSpaceEventHandler 点击触发选择
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

    handler.setInputAction((click) => {
      const pickedObject = viewer.scene.pick(click.position)

      if (Cesium.defined(pickedObject) && pickedObject.id) {
        const entity = pickedObject.id
        
        // 触发 Cesium 原生的实体选中，从而联动 InfoBox 显示和事件回调
        viewer.selectedEntity = entity

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
            rawProperties: properties
          }

          selectedPoi.value = poiData
          console.log('🎯 [点击拾取成功]：', poiData)
        }
      } else {
        viewer.selectedEntity = undefined
        selectedPoi.value = null
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  } catch (error) {
    console.error('❌ 初始化点击交互失败:', error)
  }
}