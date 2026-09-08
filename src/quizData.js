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
  },
  '五指峰': {
    id: 'quiz_wuzhifeng',
    name: '五指峰',
    question: '五指峰得名的主要原因是什么？',
    options: ['五座峰头并排耸立形似张开的五指', '山高五百米呈五角星形', '相传曾有五位仙人在此峰修炼', '山体由五种不同颜色的岩石构成'],
    correctAnswer: 0,
    explanation: '五指峰是上方山极具辨识度的山峰景观，因五座高低错落的峰头并排耸立，形似张开的五指而得名。'
  },
  '锦绣谷': {
    id: 'quiz_jinxiugu',
    name: '锦绣谷',
    question: '锦绣谷在上方山地质地貌上属于什么类型的峡谷？',
    options: ['U型冰川峡谷', 'V型岩溶峡谷', '构造断陷峡谷', '流水侵蚀峡谷'],
    correctAnswer: 1,
    explanation: '锦绣谷是上方山规模最大的 V 型岩溶峡谷，总长约三公里，谷壁陡峭险峻，分布着丰富的地质遗迹。'
  },
  '悬崖侧': {
    id: 'quiz_xuanyace',
    name: '悬崖侧',
    question: '悬崖侧地貌景观主要分布在上方山的哪个方位？',
    options: ['山体东侧', '山体西侧', '山体南麓', '山体正北峰顶'],
    correctAnswer: 0,
    explanation: '悬崖侧地处上方山山体东侧，是一处气势磅礴的陡崖地貌景观，崖壁高大陡峭，视野开阔。'
  },
  '云梯': {
    id: 'quiz_yunti',
    name: '云梯',
    question: '上方山的标志性古迹“云梯”始建于哪个朝代？',
    options: ['隋朝', '唐朝', '金代', '清朝'],
    correctAnswer: 2,
    explanation: '云梯是上方山标志性人文古迹，始建于金代，依陡峭绝壁开凿而成，共有 262 级石阶。'
  },
  '一斗泉': {
    id: 'quiz_yidouquan',
    name: '一斗泉',
    question: '一斗泉得名的原因是什么？',
    options: ['泉水常年喷涌能灌溉一斗田地', '泉水出水量有限一斗容器便可盛满', '古时僧人每天规定只取一斗水', '泉池形状酷似古代的一斗量器'],
    correctAnswer: 1,
    explanation: '一斗泉是上方山历史悠久的山泉古迹，因泉水出水量有限，一斗容器便可盛满而得名，终年不竭。'
  },
  '阴阳洞': {
    id: 'quiz_yinyangdong',
    name: '阴阳洞',
    question: '上方山阴阳洞分为阳洞与阴洞两部分，它们的特点分别是什么？',
    options: ['阳洞干爽明亮，阴洞幽深晦暗', '阳洞供奉神佛，阴洞埋藏文物', '阳洞位于山顶，阴洞深藏地下水库', '阳洞面向南侧，阴洞常年结冰'],
    correctAnswer: 0,
    explanation: '阴阳洞由山体岩石经流水长期溶蚀形成，阳洞洞口开阔采光充足而明亮干爽，阴洞向内延伸幽深晦暗不见日光。'
  },
  '钟楼': {
    id: 'quiz_zhonglou',
    name: '钟楼',
    question: '钟楼在上方山古寺片区中主要承担什么历史功能？',
    options: ['抵御外敌入侵的军事瞭望', '存放寺院经书与法器的仓库', '晨昏撞钟报时以供礼佛', '僧人闭关修行的高阁'],
    correctAnswer: 2,
    explanation: '钟楼坐落于上方山古寺片区，古时楼内悬挂巨钟，晨昏撞钟报时，钟声回荡山谷，承载着千年禅林文化。'
  },
  '文殊殿': {
  id: 'quiz_wenshudian',
  name: '文殊殿',
  question: '上方山文殊殿坐落于兜率寺的哪一侧？',
  options: ['东侧', '西侧', '南侧', '北侧'],
  correctAnswer: 1,
  explanation: '上方山文殊殿位于兜率寺西侧，明万历末年重建，为二进院落格局，院内存有古柏、古蜡梅与明清碑刻，是上方山重要佛教古建。'
},
'兴隆庵': {
  id: 'quiz_xinglongan',
  name: '兴隆庵',
  question: '上方山兴隆庵前往云水洞要经过哪座桥？',
  options: ['听梵桥', '水月桥', '云梯桥', '望仙桥'],
  correctAnswer: 0,
  explanation: '从兜率寺过听梵桥越涧，途经兴隆庵，向西可去往云水洞。兴隆庵为上方山七十二庵之一，庵前有千年古槐。'
},
  '观音殿': {
id: 'quiz_guanyindian',
name: '观音殿',
question: ' 上方山观音殿旧称是什么？',
options: [' 三圣庵 ', ' 兴隆庵 ', ' 兜率寺 ', ' 圣泉庵 '],
correctAnswer: 0,
explanation: ' 观音殿旧名三圣庵，是上方山七十二庵古建遗存，跨过水月桥可抵达此处，殿内旧时供奉观音菩萨，留存有碑刻等历史文物。'
},
'吕祖阁': {
  id: 'quiz_lvzuge',
  name: '吕祖阁',
  question: '吕祖阁院内著名的古树被称作什么？',
  options: ['槐树王', '柏树王', '松树王', '银杏王'],
  correctAnswer: 1,
  explanation: '吕祖阁是上方山少数道教场所，院内有树龄约1600年的柏树王，树冠巨大遮蔽大半院落，流传“先有柏树王，后有吕祖阁”的说法。'
},



}