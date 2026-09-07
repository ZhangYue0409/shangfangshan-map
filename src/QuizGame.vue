<template>
  <div class="quiz-game-container">
    <div class="top-control-wrapper">
      <div class="glass-capsule">
        <button 
          v-if="!isGameMode" 
          class="capsule-btn primary-btn" 
          @click="handleStartGame"
        >
          开启文化探索游戏
        </button>

        <div v-else class="game-status-bar">
          <div class="progress-info">
            <span class="label">探索进度</span>
            <span class="value">{{ completedCount }} / {{ totalCount }}</span>
          </div>
          <div class="divider"></div>
          <button class="capsule-btn exit-btn" @click="handleExitGame">
            退出
          </button>
        </div>
      </div>
    </div>

    <Transition name="fade-scale">
      <div v-if="activeQuiz && !isCompleted" class="quiz-modal-overlay">
        <div class="glass-card quiz-card">
          <div class="quiz-header">
            <span class="spot-badge">{{ activeQuiz.spotName || activeQuiz.title || '上方山景点' }}</span>
            <button class="close-icon-btn" @click="closeQuizModal">✕</button>
          </div>

          <h3 class="quiz-question">{{ activeQuiz.question }}</h3>

          <div class="options-group">
            <button
              v-for="(option, idx) in activeQuiz.options"
              :key="idx"
              class="option-btn"
              :class="{
                'selected': selectedOption === idx,
                'correct': showResult && String(idx) === String(activeQuiz.correctAnswer),
                'wrong': showResult && selectedOption === idx && String(idx) !== String(activeQuiz.correctAnswer)
              }"
              :disabled="showResult"
              @click="handleSelectOption(idx)"
            >
              <span class="option-index">{{ String.fromCharCode(65 + idx) }}</span>
              <span class="option-text">{{ option }}</span>
            </button>
          </div>

          <div v-if="showResult" class="result-section">
            <p class="explanation-text">
              <span :class="isCorrect ? 'text-success' : 'text-error'">
                {{ isCorrect ? '回答正确！' : '回答有误。' }}
              </span>
              {{ activeQuiz.explanation }}
            </p>
            <button class="glass-btn action-btn" @click="handleNextQuiz">
              {{ isLastQuiz ? '查看探索成就' : '继续探索' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="fade-scale">
      <div v-if="isCompleted" class="quiz-modal-overlay blur-bg">
        <div class="glass-card achievement-card">
          <div class="achievement-badge">EXPLORATION COMPLETED</div>
          <h2 class="achievement-title">上方山文化探索者</h2>
          
          <p class="achievement-subtitle">
            你已踏遍上方山云水胜景，解锁全部历史文化印记。
          </p>

          <div class="stats-row">
            <div class="stat-item">
              <span class="stat-value">{{ totalCount }}</span>
              <span class="stat-label">打卡景点</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ accuracyRate }}%</span>
              <span class="stat-label">正确率</span>
            </div>
          </div>

          <div class="achievement-actions">
            <button class="glass-btn secondary" @click="handleRestartGame">
              重新探索
            </button>
            <button class="glass-btn primary" @click="handleFinishGame">
              完成并自由浏览
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { gameManager, toggleGameModeState, updateNodeToCompleted } from './gameManager.js'

// 外部传入 Cesium Viewer
const props = defineProps({
  viewer: {
    type: Object,
    default: null
  }
})

// UI 状态定义
const isGameMode = ref(false)
const activeQuiz = ref(null)
const selectedOption = ref(null)
const showResult = ref(false)
const completedCount = ref(0)
const totalCount = ref(0)
const isCompleted = ref(false)

// 强类型兼容判断：统一转 String 比较
const isCorrect = computed(() => {
  if (!activeQuiz.value || selectedOption.value === null) return false
  if (activeQuiz.value.correctAnswer === undefined) {
    console.warn('⚠️ [配置缺陷警告] 当前题目缺失 correctAnswer 属性:', activeQuiz.value)
    return false
  }
  return String(selectedOption.value) === String(activeQuiz.value.correctAnswer)
})

const isLastQuiz = computed(() => {
  return completedCount.value >= totalCount.value
})

// 正确率计算：根据“已作答的题目数量”来计算百分比
const accuracyRate = computed(() => {
  const answered = gameManager.getCompletedCount()
  if (answered === 0) return 100
  const correct = gameManager.getCorrectCount()
  return Math.round((correct / answered) * 100)
})

// 状态同步更新
const updateCounts = () => {
  totalCount.value = gameManager.getTotalCount()
  completedCount.value = gameManager.getCompletedCount()
}

// 开始游戏
const handleStartGame = () => {
  isGameMode.value = true
  gameManager.resetProgress()
  
  toggleGameModeState(props.viewer, true, gameManager.completedIds, (quizData) => {
    // 点击地图打卡点回调
    activeQuiz.value = quizData
    selectedOption.value = null
    showResult.value = false
  })
  
  updateCounts()
}

// 退出游戏
const handleExitGame = () => {
  isGameMode.value = false
  isCompleted.value = false
  activeQuiz.value = null
  toggleGameModeState(props.viewer, false)
}

// 选项点击
const handleSelectOption = (index) => {
  if (showResult.value) return
  selectedOption.value = index
  showResult.value = true
}

// 进入下一环节/提交记录
const handleNextQuiz = () => {
  if (activeQuiz.value) {
    updateNodeToCompleted(props.viewer, activeQuiz.value.id, isCorrect.value)
    updateCounts()

    if (completedCount.value >= totalCount.value) {
      isCompleted.value = true
    }
  }

  activeQuiz.value = null
  selectedOption.value = null
  showResult.value = false
}

const closeQuizModal = () => {
  activeQuiz.value = null
  selectedOption.value = null
  showResult.value = false
}

// 重新探索
const handleRestartGame = () => {
  isCompleted.value = false
  handleStartGame()
}

// 完成探索并切回自由模式
const handleFinishGame = () => {
  isCompleted.value = false
  handleExitGame()
}
</script>

<style scoped>
.quiz-game-container {
  /* Apple 系统级字体 & 抗锯齿配置 */
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #ffffff;
}

/* =========================================================
 * 1. 顶部融合胶囊样式
 * ========================================================= */
.top-control-wrapper {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: auto;
}

.glass-capsule {
  /* Apple 经典多层深色渐变毛玻璃 */
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(255, 255, 255, 0.03) 100%
  ), rgba(18, 18, 22, 0.45);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-top-color: rgba(255, 255, 255, 0.35);
  border-radius: 40px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.3);
  padding: 4px;
  display: flex;
  align-items: center;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.capsule-btn {
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  padding: 8px 20px;
  border-radius: 30px;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.capsule-btn.primary-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

.game-status-bar {
  display: flex;
  align-items: center;
  padding: 0 8px 0 16px;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  letter-spacing: -0.01em;
}

.progress-info .label {
  color: rgba(255, 255, 255, 0.65);
  font-weight: 400;
}

.progress-info .value {
  color: #ffffff;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.divider {
  width: 1px;
  height: 12px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 12px;
}

.exit-btn {
  color: rgba(255, 255, 255, 0.65);
  padding: 6px 14px;
  font-size: 13px;
}

.exit-btn:hover {
  color: #ff453a;
  background: rgba(255, 69, 58, 0.15);
}

/* =========================================================
 * 2. 毛玻璃弹窗 Modal 基础 (与参考代码一致的暗色毛玻璃)
 * ========================================================= */
.quiz-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  pointer-events: auto;
}

.quiz-modal-overlay.blur-bg {
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  background: rgba(0, 0, 0, 0.45);
}

.glass-card {
  pointer-events: auto;
  width: 460px;
  max-width: 90vw;
  height: fit-content;
  max-height: 80vh;

  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(255, 255, 255, 0.03) 100%
  ), rgba(18, 18, 22, 0.55);

  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);

  border: 1px solid rgba(255, 255, 255, 0.25);
  border-top-color: rgba(255, 255, 255, 0.35);
  border-radius: 20px;

  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.3);
  padding: 28px;
  box-sizing: border-box;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

/* 答题卡片内部样式 */
.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.spot-badge {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #0a84ff;
  background: rgba(10, 132, 255, 0.18);
  border: 1px solid rgba(10, 132, 255, 0.3);
  padding: 4px 12px;
  border-radius: 12px;
}

.close-icon-btn {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.close-icon-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  color: #ffffff;
  transform: scale(1.05);
}

.quiz-question {
  color: #ffffff;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.45;
  margin: 0 0 24px 0;
  letter-spacing: -0.01em;
}

.options-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 14px;
  font-family: inherit;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.option-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.35);
  color: #ffffff;
  transform: translateY(-1px);
}

.option-btn.correct {
  background: rgba(48, 209, 88, 0.2) !important;
  border-color: rgba(48, 209, 88, 0.5) !important;
  color: #30d158 !important;
}

.option-btn.wrong {
  background: rgba(255, 69, 58, 0.2) !important;
  border-color: rgba(255, 69, 58, 0.5) !important;
  color: #ff453a !important;
}

.option-index {
  font-weight: 600;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.12);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-section {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.explanation-text {
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.75);
  margin: 0 0 16px 0;
}

.text-success { 
  color: #30d158; 
  font-weight: 600; 
}
.text-error { 
  color: #ff453a; 
  font-weight: 600; 
}

.action-btn {
  width: 100%;
}

/* =========================================================
 * 3. 成就卡片专属样式
 * ========================================================= */
.achievement-card {
  text-align: center;
  padding: 36px 32px;
}

.achievement-badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 12px;
}

.achievement-title {
  color: #ffffff;
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 12px 0;
  letter-spacing: -0.02em;
}

.achievement-subtitle {
  font-size: 14px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 28px 0;
}

.stats-row {
  display: flex;
  justify-content: center;
  gap: 48px;
  margin-bottom: 32px;
  padding: 16px 0;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  color: #ffffff;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
}

.achievement-actions {
  display: flex;
  gap: 12px;
}

/* Apple 按钮基础规范 */
.glass-btn {
  flex: 1;
  padding: 12px 18px;
  border-radius: 14px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  border: 1px solid transparent;
}

.glass-btn.primary {
  background: #0a84ff;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(10, 132, 255, 0.35);
}

.glass-btn.primary:hover {
  background: #0071e3;
  transform: translateY(-1px);
}

.glass-btn.secondary {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.glass-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.35);
}

/* =========================================================
 * 4. 动画过渡
 * ========================================================= */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>