<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const visible = ref(!userStore.isLoggedIn && !localStorage.getItem('ai-dashboard:welcome-dismissed'))

function skipLogin() {
  localStorage.setItem('ai-dashboard:welcome-dismissed', 'true')
  visible.value = false
}

function goToLogin() {
  localStorage.setItem('ai-dashboard:welcome-dismissed', 'true')
  visible.value = false
  // 跳转到用户页面
  window.location.href = '/user'
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="welcome-overlay">
      <div class="welcome-modal">
        <div class="welcome-header">
          <h2>🌟 欢迎使用星盘智投</h2>
          <p class="muted">AI驱动的智能股票分析与玄学选股</p>
        </div>

        <div class="welcome-content">
          <div class="feature-list">
            <div class="feature-item">
              <span class="feature-icon">📊</span>
              <div>
                <strong>智能选股</strong>
                <p class="small muted">AI 多维度分析，精准推荐</p>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🔮</span>
              <div>
                <strong>玄学选股</strong>
                <p class="small muted">塔罗牌、六爻、占星多种方式</p>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">☁️</span>
              <div>
                <strong>云端同步</strong>
                <p class="small muted">登录后数据多设备同步</p>
              </div>
            </div>
          </div>
        </div>

        <div class="welcome-actions">
          <button class="btn primary" @click="goToLogin">
            登录 / 注册
          </button>
          <button class="btn ghost" @click="skipLogin">
            跳过，先看看
          </button>
        </div>

        <p class="welcome-note small muted">
          💡 登录后可获得 100 次免费 AI 分析额度
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.welcome-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: var(--space-4);
}

.welcome-modal {
  width: 100%;
  max-width: 420px;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-xl);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.welcome-header {
  text-align: center;
  margin-bottom: var(--space-5);
}

.welcome-header h2 {
  margin: 0 0 var(--space-2);
  font-size: var(--fs-2xl);
}

.welcome-content {
  margin-bottom: var(--space-5);
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.feature-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.feature-item strong {
  display: block;
  margin-bottom: 2px;
}

.feature-item p {
  margin: 0;
}

.welcome-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.welcome-actions .btn {
  width: 100%;
  padding: var(--space-3);
  font-size: var(--fs-base);
}

.welcome-note {
  text-align: center;
  margin-top: var(--space-4);
  margin-bottom: 0;
}
</style>
