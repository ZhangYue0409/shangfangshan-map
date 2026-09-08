import * as Cesium from 'cesium'

export function createSlopeLayer(viewer, gpxPositions) {
    const terrainProvider = viewer.terrainProvider
    let slopePrimitive = null

    function getSlopeColor(slopeDeg) {
        if (slopeDeg <= 10) {
            return Cesium.Color.GREEN.withAlpha(0.75)
        } else if (slopeDeg <= 20) {
            return Cesium.Color.YELLOW.withAlpha(0.75)
        } else {
            return Cesium.Color.RED.withAlpha(0.75)
        }
    }

    //过滤重复、过近点
    function cleanPositions(positions) {
        if (!positions || positions.length < 2) return positions
        const cleaned = []
        const minDistance = 0.5
        for (let i = 0; i < positions.length; i++) {
            const p = positions[i]
            if (cleaned.length === 0) {
                cleaned.push(p)
                continue
            }
            const last = cleaned[cleaned.length - 1]
            const distance = Cesium.Cartesian3.distance(last, p)
            if (distance > minDistance) {
                cleaned.push(p)
            }
        }
        return cleaned
    }

    function sortPositionsAlongRoute(positions) {
        if (!positions || positions.length < 2) return positions
        const start = positions[0]
        const end = positions[positions.length - 1]
        const distanceToStart = (p) => Cesium.Cartesian3.distance(start, p)
        const firstHalf = positions.slice(0, Math.floor(positions.length / 2))
        const lastHalf = positions.slice(Math.floor(positions.length / 2))
        const firstToStart = firstHalf.reduce((sum, p) => sum + distanceToStart(p), 0)
        const lastToStart = lastHalf.reduce((sum, p) => sum + distanceToStart(p), 0)
        if (firstToStart < lastToStart) {
            return positions
        } else {
            return [...positions].reverse()
        }
    }

    const cleanedPositions = sortPositionsAlongRoute(cleanPositions(gpxPositions))
    const cartoList = cleanedPositions.map(p => Cesium.Cartographic.fromCartesian(p))

    return new Promise((resolve, reject) => {
        Cesium.sampleTerrainMostDetailed(terrainProvider, cartoList).then((sampledCartos) => {
            const positions = []
            const colors = []

            for (let i = 0; i < sampledCartos.length - 1; i++) {
                const c1 = sampledCartos[i]
                const c2 = sampledCartos[i + 1]

                // =========修改这里：抬高到12米，解决遮挡=========
                const carto1Up = new Cesium.Cartographic(c1.longitude, c1.latitude, c1.height + 12.0)
                const carto2Up = new Cesium.Cartographic(c2.longitude, c2.latitude, c2.height + 12.0)

                const p1 = Cesium.Cartographic.toCartesian(carto1Up)
                const p2 = Cesium.Cartographic.toCartesian(carto2Up)

                const deltaHeight = Math.abs(c2.height - c1.height)
                const hDist = Cesium.Cartesian3.distance(
                    Cesium.Cartesian3.fromRadians(c1.longitude, c1.latitude, 0),
                    Cesium.Cartesian3.fromRadians(c2.longitude, c2.latitude, 0)
                )
                if (hDist < 0.1) continue

                const slopeRad = Math.atan(deltaHeight / hDist)
                const slopeDeg = Cesium.Math.toDegrees(slopeRad)
                const segColor = getSlopeColor(slopeDeg)

                positions.push(p1, p2)
                colors.push(segColor, segColor)
            }

            const geometry = new Cesium.PolylineGeometry({
                positions: positions,
                colors: colors,
                colorsPerVertex: true,
                width: 8,
                arcType: Cesium.ArcType.NONE
            })
            const instance = new Cesium.GeometryInstance({
                geometry: geometry
            })

            const appearance = new Cesium.PolylineColorAppearance({ translucent: true })
            // 关键：depthFailAppearance，地形后面依然渲染线条，杜绝被地形吃掉
            slopePrimitive = new Cesium.Primitive({
                geometryInstances: instance,
                appearance: appearance,
                depthFailAppearance: appearance,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            })
            viewer.scene.primitives.add(slopePrimitive)

            const layerObj = {
                show(visible) {
                    if(slopePrimitive) slopePrimitive.show = visible
                },
                destroy() {
                    if(slopePrimitive){
                        viewer.scene.primitives.remove(slopePrimitive)
                        slopePrimitive = null
                    }
                }
            }
            resolve(layerObj)
        }).catch(err => reject(err))
    })
}
