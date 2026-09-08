// src/gameManager.js
import * as Cesium from 'cesium'
import { quizDataMap } from './quizData.js'
import { layerConfigs, toggleLayerVisibility } from './LayerManager.js'

class GameManager {
  constructor() {
    this.viewer = null
    this.poiSource = null
    this.isGameMode = false
    // key: quizId (string/number), value: isCorrect (boolean)
    this.quizResults = new Map()
    this.handler = null
    this.onQuizTriggered = null
    this.selectionListener = null
  }

  /**
   * 兼容旧接口：获取已打卡节点 ID 集合
   */
  get completedIds() {
    return new Set(this.quizResults.keys())
  }

  /**
   * 初始化或更新 Viewer
   */
  setViewer(viewer) {
    if (!viewer) return
    this.viewer = viewer
    this.bindMapEvents()
  }

  /**
   * 加载或获取 GeoJSON 数据源
   */
  async loadPoiData() {
    if (!this.viewer) return
    if (this.poiSource) return

    try {
      this.poiSource = await Cesium.GeoJsonDataSource.load('/data/mock_poi.geojson', {
        clampToGround: true
      })
      await this.viewer.dataSources.add(this.poiSource)
      console.log('✅ 游戏模式 GeoJSON 点位加载成功')
    } catch (error) {
      console.error('❌ 加载 mock_poi.geojson 失败:', error)
    }
  }

  /**
   * 控制常规“景点”图层的显隐，防止与游戏标注重叠
   */
  setSpotLayerVisible(visible) {
    const spotLayerConfig = layerConfigs.find(l => l.name === '景点' || l.id === 'spot')
    if (spotLayerConfig) {
      spotLayerConfig.visible = visible
      toggleLayerVisibility(spotLayerConfig)
    }
  }

  /**
   * 刷新所有打卡实体的样式
   */
  refreshEntityStyles() {
    if (!this.poiSource) return

    const entities = this.poiSource.entities.values
    entities.forEach(entity => {
      const name = entity.properties?.name?.getValue()
      if (!name || !quizDataMap[name]) return

      const quizData = quizDataMap[name]
      const isCompleted = this.quizResults.has(quizData.id)

      if (this.isGameMode) {
        // 清空默认生成的 billboard (蓝色方框) 和 point (圆点)
        entity.point = undefined
        entity.label = undefined

        // 🎮 游戏模式
        entity.billboard = new Cesium.BillboardGraphics({
          image: isCompleted ? '/images/Image14_37_33.png' : '/images/Image14_35_01.png', // 替换为你存放图片的路径
          scale: 0.04, // 图片缩放比例，可根据实际图片大小调整
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        })
      } else {
        // 🗺️ 非游戏模式：清空样式
        entity.billboard = undefined
        entity.point = undefined
        entity.label = undefined
      }
    })
  }

  /**
   * 切换游戏模式状态
   */
  async toggleGameMode(active, completedSet, onQuizClick) {
    this.isGameMode = active
    if (completedSet && completedSet instanceof Set) {
      completedSet.forEach(id => {
        if (!this.quizResults.has(id)) {
          this.quizResults.set(id, true)
        }
      })
    } else if (!active) {
      this.quizResults.clear()
    }

    if (onQuizClick) this.onQuizTriggered = onQuizClick

    if (active) {
      // 1. 隐藏常规景点图层，消除重叠
      this.setSpotLayerVisible(false)
      // 2. 加载问答点位并应用新样式
      await this.loadPoiData()
      this.refreshEntityStyles()
      // 3. 拦截/禁用 Cesium 默认的实体选中弹窗
      this.disableDefaultInfoBox()
      this.bindMapEvents()
    } else {
      // 恢复常规景点图层显示，并解除弹窗拦截
      this.setSpotLayerVisible(true)
      this.enableDefaultInfoBox()
      this.refreshEntityStyles()
    }
  }

  /**
   * 🎮 游戏模式下：禁用 Cesium 默认的信息弹窗（selectedEntity）
   */
  disableDefaultInfoBox() {
    if (!this.viewer) return

    // 先清除当前选中的实体
    this.viewer.selectedEntity = undefined

    // 监听 selectedEntityChanged，强制清空，阻断右侧弹窗打开
    if (!this.selectionListener) {
      this.selectionListener = () => {
        if (this.isGameMode && this.viewer.selectedEntity) {
          this.viewer.selectedEntity = undefined
        }
      }
      this.viewer.selectedEntityChanged.addEventListener(this.selectionListener)
    }
  }

  /**
   * 🗺️ 退出游戏模式：恢复默认弹窗机制
   */
  enableDefaultInfoBox() {
    if (!this.viewer) return

    if (this.selectionListener) {
      this.viewer.selectedEntityChanged.removeEventListener(this.selectionListener)
      this.selectionListener = null
    }
  }

  /**
   * 绑定地图点击事件（只触发答题弹窗）
   */
  bindMapEvents() {
    if (!this.viewer) return

    if (this.handler) {
      this.handler.destroy()
    }

    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)

    this.handler.setInputAction((click) => {
      if (!this.isGameMode) return

      const pickedObject = this.viewer.scene.pick(click.position)
      if (Cesium.defined(pickedObject) && pickedObject.id) {
        const entity = pickedObject.id
        const name = entity.properties?.name?.getValue()

        if (name && quizDataMap[name]) {
          const quizData = quizDataMap[name]
          console.log('🎯 触发问答点位:', name)
          
          // 确保点击时不选中该实体，防止右侧弹窗被拉起
          this.viewer.selectedEntity = undefined

          if (typeof this.onQuizTriggered === 'function') {
            this.onQuizTriggered(quizData)
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  }

  /**
   * 标记节点已完成（覆盖记录，防止重复回答算错）
   */
  markNodeCompleted(quizId, isCorrect = true) {
    this.quizResults.set(quizId, Boolean(isCorrect))
    this.refreshEntityStyles()
  }

  /**
   * 重置游戏统计
   */
  resetProgress() {
    this.quizResults.clear()
    this.refreshEntityStyles()
  }

  /**
   * 获取总题目数量
   */
  getTotalCount() {
    return Object.keys(quizDataMap).length
  }

  /**
   * 获取已打卡节点数量
   */
  getCompletedCount() {
    return this.quizResults.size
  }

  /**
   * 获取回答正确的节点数量
   */
  getCorrectCount() {
    let count = 0
    for (const isCorrect of this.quizResults.values()) {
      if (isCorrect) count++
    }
    return count
  }
}

export const gameManager = new GameManager()

export function toggleGameModeState(viewer, active, completedSet, onQuizClick) {
  if (viewer) {
    gameManager.setViewer(viewer)
  }
  gameManager.toggleGameMode(active, completedSet, onQuizClick)
}

export function updateNodeToCompleted(viewer, quizId, isCorrect) {
  if (viewer) {
    gameManager.setViewer(viewer)
  }
  gameManager.markNodeCompleted(quizId, isCorrect)
}