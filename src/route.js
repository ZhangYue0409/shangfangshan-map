import { computeElevationProfile } from './elevationProfile'

export const routeList = [
  {
    label: '主路线',
    key: 'main',
    isActive: false,
    desc: '景区代表性游览路线，串联上方山绝大多数遗存古迹，步道设施基本完备，兼顾地质地貌观测与人文遗址探访，综合游览价值突出。',
    geoJsonUrl: '/data/上方山路线.gpx',
    // 新增缓存路线坐标
    _positions: null,
    loadRoute(){
      // 这里写你原本加载这条路线的旧代码
      // ✨ 在你原有loadRoute逻辑里，线实体构建完成之后，把坐标存到 this._positions
      // 示例伪代码（你把自己原来的代码放这里）
      /*
      const polylineEntity = viewer.entities.add({
        polyline: { positions: xxx, ... }
      })
      this._positions = xxx; // 保存线Cartesian3坐标数组
      */
    },
    removeRoute(){
      // 移除路线实体原有代码
      this._positions = null // 清空缓存坐标
    }
  },
  {
    label: '不回头极限徒步路线',
    key: 'limit',
    isActive: false,
    desc: '单向高强度登山环线，可同步观测山谷、山坡两类地貌，途经兜率寺等核心古迹。线路徒步负荷较高，适合极限登山爱好者，适宜野外分组实地调研。',
    geoJsonUrl:'/data/不回头极限徒步路线.geojson',
    _positions: null,
    loadRoute(){
      //原有加载代码，加载完线实体后 this._positions = 线positions
    },
    removeRoute(){
      this._positions = null
    }
  },
  {
    label: '拍照浏览景点路线',
    key: 'sight',
    isActive: false,
    desc: '沿沟谷峡谷纵深布设，沿途可乘坐观光车、缆车以降低体力消耗，适合快速游览沟谷沿线古迹，浏览谷地地貌与沿途风景。',
    geoJsonUrl:'/data/拍照浏览景点线路.json',
    _positions: null,
    loadRoute(){
      //原有加载代码，加载完线实体后 this._positions = 线positions
    },
    removeRoute(){
      this._positions = null
    }
  }
]

/**
 * 路线按钮点击处理
 * @param {Object} item routeList里面的路线对象
 * @param {Function} showPopupCallback 回调：通知vue打开弹窗
 *   回调参数变更：{title, desc?, profileData?}
 *   profileData = {distList, elevList} 有这个就渲染地形剖面图
 * @param {Cesium.Viewer} viewer 传入viewer实例，用于地形采样
 */
export async function handleRouteClick(item, showPopupCallback, viewer){
  //第二次点击：已经激活，弹出弹窗，计算地形剖面
  if(item.isActive){
    // 没有坐标缓存，降级只显示文字描述
    if(!item._positions || item._positions.length < 2){
      showPopupCallback({
        title: item.label,
        desc: item.desc
      })
      return
    }
    try{
      // 实时采样地形，计算剖面数据
      const profileData = await computeElevationProfile(viewer, item._positions)
      showPopupCallback({
        title: item.label,
        desc: item.desc,
        profileData // 把距离高程数据传给Vue弹窗组件
      })
    }catch(err){
      console.error('地形剖面计算失败', err)
      // 异常降级，只展示文字
      showPopupCallback({
        title: item.label,
        desc: item.desc
      })
    }
    return
  }

  //第一次点击：关闭其他路线，加载当前路线
  for(const r of routeList){
    r.isActive = false
    r.removeRoute()
  }
  item.isActive = true
  item.loadRoute()
}

//关闭全部路线
export function closeAllRoute(){
  for(const r of routeList){
    r.isActive = false
    r.removeRoute()
  }
}
