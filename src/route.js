// src/route.js
export const routeList = [
  {
    label: '主路线',
    key: 'main',
    isActive: false,
    desc: '景区代表性游览路线，串联上方山绝大多数遗存古迹，步道设施基本完备，兼顾地质地貌观测与人文遗址探访，综合游览价值突出。',
    geoJsonUrl: '/data/上方山路线.gpx',
    loadRoute(){
      // 这里写你原本加载这条路线的旧代码
    },
    removeRoute(){
      // 移除路线实体原有代码
    }
  },
  {
    label: '不回头极限徒步路线',
    key: 'limit',
    isActive: false,
    desc: '单向高强度登山环线，可同步观测山谷、山坡两类地貌，途经兜率寺等核心古迹。线路徒步负荷较高，适合极限登山爱好者，适宜野外分组实地调研。',
    geoJsonUrl:'/data/不回头极限徒步路线.geojson',
    loadRoute(){},
    removeRoute(){}
  },
  {
    label: '拍照浏览景点路线',
    key: 'sight',
    isActive: false,
    desc: '沿沟谷峡谷纵深布设，沿途可乘坐观光车、缆车以降低体力消耗，适合快速游览沟谷沿线古迹，浏览谷地地貌与沿途风景。',
    geoJsonUrl:'/data/拍照浏览景点线路.json',
    loadRoute(){},
    removeRoute(){}
  }
]

/**
 * 路线按钮点击处理
 * @param {Object} item routeList里面的路线对象
 * @param {Function} showPopupCallback 回调：通知vue打开弹窗，传入{title,content}
 */
export function handleRouteClick(item, showPopupCallback){
  //第二次点击：已经激活，弹出介绍弹窗
  if(item.isActive){
    showPopupCallback({
      title: item.label,
      content: item.desc
    })
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
