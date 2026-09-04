import * as Cesium from 'cesium'

export async function createSlopeLayer(viewer, gpxPositions) {
    const entityList = []
    function getSlopeColor(slopeDeg) {
        if (slopeDeg <= 10) {
            return Cesium.Color.GREEN.withAlpha(0.75)
        } else if (slopeDeg <= 20) {
            return Cesium.Color.YELLOW.withAlpha(0.75)
        } else {
            return Cesium.Color.RED.withAlpha(0.75)
        }
    }

    // 不采样地形，直接每个点抬高5米，避免异步采样报错卡死页面
    const terrainPositions = gpxPositions.map(p=>{
      const c = Cesium.Cartographic.fromCartesian(p)
      c.height += 5
      return Cesium.Cartographic.toCartesian(c)
    })

    for (let i = 0; i < gpxPositions.length - 1; i++) {
        const pGpx1 = gpxPositions[i]
        const pGpx2 = gpxPositions[i+1]

        const cartoG1 = Cesium.Cartographic.fromCartesian(pGpx1)
        const cartoG2 = Cesium.Cartographic.fromCartesian(pGpx2)
        const deltaHeight = Math.abs(cartoG2.height - cartoG1.height)

        const surfaceP1 = Cesium.Cartesian3.fromRadians(cartoG1.longitude, cartoG1.latitude, 0)
        const surfaceP2 = Cesium.Cartesian3.fromRadians(cartoG2.longitude, cartoG2.latitude, 0)
        const hDist = Cesium.Cartesian3.distance(surfaceP1, surfaceP2)

        if (hDist < 0.1) continue
        const slopeRad = Math.atan(deltaHeight / hDist)
        const slopeDeg = Cesium.Math.toDegrees(slopeRad)

        const renderP1 = terrainPositions[i]
        const renderP2 = terrainPositions[i+1]

        const ent = viewer.entities.add({
            polyline: {
                positions: [renderP1, renderP2],
                width:14,
                material:getSlopeColor(slopeDeg),
            }
        })
        entityList.push(ent)
    }

    return {
        show(visible) {
            entityList.forEach(e=>e.show = visible)
        },
        destroy() {
            entityList.forEach(e=>viewer.entities.remove(e))
        }
    }
}