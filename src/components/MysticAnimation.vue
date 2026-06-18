<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

interface Props {
  type: 'tarot' | 'liuyao' | 'meihua' | 'xiaoliuren' | 'astro'
  title: string
  symbolText: string
  meaning: string
  details: string[]
  playing: boolean
}

const props = defineProps<Props>()

const phase = ref<'idle' | 'dealing' | 'revealing' | 'done'>('idle')
const cards = ref<Array<{ id: number; flipped: boolean; content: string }>>([])
const diceValues = ref<number[]>([])
const currentDetail = ref(0)

// 初始化动画
onMounted(() => {
  if (props.playing) {
    startAnimation()
  }
})

watch(() => props.playing, (val) => {
  if (val) startAnimation()
})

function startAnimation() {
  phase.value = 'dealing'
  
  if (props.type === 'tarot') {
    dealTarotCards()
  } else if (props.type === 'liuyao' || props.type === 'meihua') {
    rollDice()
  } else if (props.type === 'xiaoliuren') {
    revealXiaoliuren()
  } else if (props.type === 'astro') {
    throwAstroDice()
  }
}

function dealTarotCards() {
  // 生成3张塔罗牌
  cards.value = [
    { id: 1, flipped: false, content: '?' },
    { id: 2, flipped: false, content: '?' },
    { id: 3, flipped: false, content: '?' },
  ]
  
  // 依次翻牌（更慢的节奏）
  setTimeout(() => {
    cards.value[0].flipped = true
    cards.value[0].content = props.details[0] || '过去'
  }, 1200)
  
  setTimeout(() => {
    cards.value[1].flipped = true
    cards.value[1].content = props.details[1] || '现在'
  }, 2400)
  
  setTimeout(() => {
    cards.value[2].flipped = true
    cards.value[2].content = props.details[2] || '未来'
    phase.value = 'revealing'
  }, 3600)
  
  setTimeout(() => {
    phase.value = 'done'
  }, 4500)
}

function rollDice() {
  // 掷骰子动画（更慢的节奏）
  diceValues.value = []
  
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      diceValues.value.push(Math.floor(Math.random() * 6) + 1)
    }, i * 500)
  }
  
  setTimeout(() => {
    phase.value = 'revealing'
  }, 3200)
  
  setTimeout(() => {
    phase.value = 'done'
  }, 4000)
}

function revealXiaoliuren() {
  // 小六壬揭示动画（更慢的节奏）
  currentDetail.value = 0
  
  const interval = setInterval(() => {
    currentDetail.value++
    if (currentDetail.value >= props.details.length) {
      clearInterval(interval)
      phase.value = 'done'
    }
  }, 900)
}

function throwAstroDice() {
  // 占星骰子动画（更慢的节奏）
  diceValues.value = []
  
  setTimeout(() => {
    diceValues.value = [Math.floor(Math.random() * 12) + 1] // 行星
  }, 800)
  
  setTimeout(() => {
    diceValues.value.push(Math.floor(Math.random() * 12) + 1) // 星座
  }, 1800)
  
  setTimeout(() => {
    diceValues.value.push(Math.floor(Math.random() * 12) + 1) // 宫位
    phase.value = 'done'
  }, 2800)
}

// 获取骰子点数的Unicode字符
function getDiceFace(value: number): string {
  const faces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
  return faces[value] || '⚀'
}
</script>

<template>
  <div class="mystic-animation">
    <!-- 塔罗牌动画 -->
    <div v-if="type === 'tarot'" class="tarot-container">
      <div class="tarot-cards">
        <div
          v-for="card in cards"
          :key="card.id"
          class="tarot-card"
          :class="{ flipped: card.flipped }"
        >
          <div class="card-front">
            <div class="card-symbol">🌟</div>
          </div>
          <div class="card-back">
            <div class="card-content">{{ card.content }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 六爻/梅花易数骰子动画 -->
    <div v-else-if="type === 'liuyao' || type === 'meihua'" class="dice-container">
      <div class="dice-row">
        <span
          v-for="(value, index) in diceValues"
          :key="index"
          class="dice"
          :style="{ animationDelay: `${index * 0.1}s` }"
        >
          {{ getDiceFace(value) }}
        </span>
      </div>
      <div v-if="phase === 'done'" class="hexagram">
        <div v-for="(detail, i) in details" :key="i" class="hexagram-line">
          {{ detail }}
        </div>
      </div>
    </div>

    <!-- 小六壬动画 -->
    <div v-else-if="type === 'xiaoliuren'" class="xiaoliuren-container">
      <div class="reveal-sequence">
        <div
          v-for="(detail, i) in details"
          :key="i"
          class="reveal-item"
          :class="{ visible: i < currentDetail }"
        >
          <span class="reveal-icon">🔮</span>
          <span class="reveal-text">{{ detail }}</span>
        </div>
      </div>
    </div>

    <!-- 占星骰子动画 -->
    <div v-else-if="type === 'astro'" class="astro-container">
      <div class="astro-dice">
        <div class="astro-symbol" :class="{ bounce: diceValues.length >= 1 }">
          {{ diceValues[0] ? ['☉','☽','☿','♀','♂','♃','♄','♅','♆','♇','☊','☋'][diceValues[0]-1] : '?' }}
        </div>
        <div class="astro-symbol" :class="{ bounce: diceValues.length >= 2 }">
          {{ diceValues[1] ? ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'][diceValues[1]-1] : '?' }}
        </div>
        <div class="astro-symbol" :class="{ bounce: diceValues.length >= 3 }">
          {{ diceValues[2] ? ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ','Ⅹ','Ⅺ','Ⅻ'][diceValues[2]-1] : '?' }}
        </div>
      </div>
    </div>

    <!-- 结果显示 -->
    <div v-if="phase === 'done'" class="result-reveal">
      <h3 class="result-title">{{ title }}</h3>
      <pre class="result-symbol">{{ symbolText }}</pre>
      <p class="result-meaning">{{ meaning }}</p>
    </div>
  </div>
</template>

<style scoped>
.mystic-animation {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  min-height: 200px;
}

/* 塔罗牌样式 */
.tarot-container {
  width: 100%;
}

.tarot-cards {
  display: flex;
  justify-content: center;
  gap: var(--space-4);
  perspective: 1000px;
}

.tarot-card {
  width: 100px;
  height: 150px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.tarot-card.flipped {
  transform: rotateY(180deg);
}

.card-front,
.card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-front {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.card-back {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  transform: rotateY(180deg);
}

.card-symbol {
  font-size: 32px;
}

.card-content {
  font-size: 12px;
  font-weight: 600;
  color: white;
  text-align: center;
  padding: var(--space-2);
}

/* 骰子样式 */
.dice-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.dice-row {
  display: flex;
  gap: var(--space-3);
}

.dice {
  font-size: 48px;
  animation: diceRoll 0.5s ease-out;
}

@keyframes diceRoll {
  0% { transform: rotate(0deg) scale(0.5); opacity: 0; }
  50% { transform: rotate(360deg) scale(1.2); }
  100% { transform: rotate(720deg) scale(1); opacity: 1; }
}

.hexagram {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-family: var(--font-mono);
  font-size: var(--fs-lg);
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 小六壬样式 */
.xiaoliuren-container {
  width: 100%;
}

.reveal-sequence {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.reveal-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  opacity: 0;
  transform: translateX(-20px);
  transition: all 0.4s ease-out;
}

.reveal-item.visible {
  opacity: 1;
  transform: translateX(0);
}

.reveal-icon {
  font-size: 24px;
}

.reveal-text {
  font-size: var(--fs-base);
}

/* 占星骰子样式 */
.astro-container {
  width: 100%;
}

.astro-dice {
  display: flex;
  justify-content: center;
  gap: var(--space-5);
}

.astro-symbol {
  font-size: 56px;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.5s ease-out;
}

.astro-symbol.bounce {
  opacity: 1;
  transform: scale(1);
  animation: bounceIn 0.6s ease-out;
}

@keyframes bounceIn {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

/* 结果显示 */
.result-reveal {
  text-align: center;
  animation: slideUp 0.5s ease-out;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.result-title {
  margin: 0 0 var(--space-2);
  font-size: var(--fs-xl);
  font-weight: 700;
}

.result-symbol {
  margin: 0 0 var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  white-space: pre-wrap;
}

.result-meaning {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--color-muted);
  line-height: 1.5;
}
</style>
