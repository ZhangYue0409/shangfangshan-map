import * as Cesium from 'cesium'

// 这个函数专门负责加载和美化路线
export async function loadRoute(viewer) {
  try {
    // 加载你的假路线数据
    const dataSource = await Cesium.GeoJsonDataSource.load('/data/mock_route.geojson')
    viewer.dataSources.add(dataSource)

    // 设置路线样式：抬高、加粗、亮金色
    dataSource.entities.values.forEach(entity => {
      if (entity.polyline) {
        entity.polyline.clampToGround = false
        entity.polyline.heightReference = Cesium.HeightReference.RELATIVE_TO_GROUND
        entity.polyline.height = 10   // 抬高10米，防止被地形遮住
        entity.polyline.material = Cesium.Color.fromCssColorString('#FFD700') // 金色
        entity.polyline.width = 8
      }
    })

    // 让镜头飞过去看这条路线
    viewer.flyTo(dataSource)
    console.log('✅ 路线加载成功！')
  } catch (error) {
    console.error('❌ 加载路线失败:', error)
  }
}