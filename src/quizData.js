// 基于 GeoJSON 景点数据生成的上方山文化问答题库
export const quizDataMap = {
  '上方山国家森林公园入口': {
    id: 'quiz_entrance',
    name: '上方山国家森林公园入口',
    question: '上方山国家森林公园主要以什么景观特色著称？',
    options: ['“九洞十二峰”及高森林覆盖率', '巨型花岗岩风蚀地貌', '高山草甸与火山湖泊', '海蚀崖与千米沙滩'],
    correctAnswer: 0,
    explanation: '上方山国家森林公园位于北京市房山区，以“九洞十二峰”著称，森林覆盖率高，是天然氧吧。'
  },
  '兜率寺': {
    id: 'quiz_doushuaisi',
    name: '兜率寺',
    question: '兜率寺作为上方山七十二座古庵的中心，始建于什么时期？',
    options: ['隋末唐初', '北宋时期', '明代中叶', '清代康熙年间'],
    correctAnswer: 0,
    explanation: '兜率寺始建于隋末唐初，距今已有1400多年历史，是整条登山古道的中途核心节点。'
  },
  '青龙泉': {
    id: 'quiz_qinglongquan',
    name: '青龙泉',
    question: '青龙泉（圣泉）地质上属于哪种类型的泉水？',
    options: ['熔岩孔隙泉', '天然裂隙泉', '人工自流井', '地热温泉'],
    correctAnswer: 1,
    explanation: '青龙泉位于兜率寺西侧崖下，是一处天然裂隙泉，水质清冽，是山上少有的稳定天然水源。'
  },
  '天坑': {
    id: 'quiz_tiankeng',
    name: '天坑',
    question: '上方山天坑（旱龙潭）在地貌上属于哪种类型？',
    options: ['火山口崩塌', '冰川角峰遗迹', '喀斯特崩塌漏斗地貌', '陨石坑遗迹'],
    correctAnswer: 2,
    explanation: '上方山天坑是我国北方首次发现的天坑，坑深约71米，属于典型的喀斯特崩塌漏斗地貌。'
  },
  '瓣香庵': {
    id: 'quiz_banxiangan',
    name: '瓣香庵',
    question: '进入兜率寺山门后遇到的第一处古庵瓣香庵外，留存有哪个朝代的石幢遗迹？',
    options: ['唐代', '金代', '元代', '明代'],
    correctAnswer: 1,
    explanation: '瓣香庵是上方山七十二庵之一，院落保存相对完好，庵外留存有金代石幢遗迹。'
  },
  '南无地藏王菩萨庙': {
    id: 'quiz_dizangwang',
    name: '南无地藏王菩萨庙',
    question: '南无地藏王菩萨庙位于上方山哪处标志性登山节点的入口处？',
    options: ['云水洞出口', '百步云梯入口', '天坑底部', '摘星台顶峰'],
    correctAnswer: 1,
    explanation: '南无地藏王菩萨庙位于百步云梯的入口处，亭柱刻有“地狱不空誓不成佛”知名楹联。'
  }
}