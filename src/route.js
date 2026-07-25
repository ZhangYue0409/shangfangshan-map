import * as Cesium from 'cesium'

export async function loadRoute(viewer) {
  try {
    const dataSource = await Cesium.GeoJsonDataSource.load('/data/mock_route.geojson')
    viewer.dataSources.add(dataSource)

    dataSource.entities.values.forEach(entity => {
      if (entity.polyline) {
        // 读取这条路的坡度
        const slope = entity.properties?.avg_slope || 0
        
        // 根据坡度选颜色
        let color
        if (slope < 10) color = Cesium.Color.GREEN
        else if (slope < 20) color = Cesium.Color.YELLOW
        else color = Cesium.Color.RED

        // 设置路线样式
        entity.polyline.clampToGround = false
        entity.polyline.heightReference = Cesium.HeightReference.RELATIVE_TO_GROUND
        entity.polyline.height = 10
        entity.polyline.material = color
        entity.polyline.width = 8
      }
    })

    viewer.flyTo(dataSource)
    console.log('✅ 彩色路线加载成功！')
  } catch (error) {
    console.error('❌ 加载路线失败:', error)
  }
}