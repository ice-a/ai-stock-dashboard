import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { i18n } from '../i18n'
import { useAccountStore } from '../stores/account'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: '概览' }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { title: '访问验证', public: true }
  },
  {
    path: '/sectors',
    name: 'sectors',
    component: () => import('../views/SectorsView.vue'),
    meta: { title: '板块选择' }
  },
  {
    path: '/sector/:id',
    name: 'sector-detail',
    component: () => import('../views/SectorDetailView.vue'),
    meta: { title: '板块详情' }
  },
  {
    path: '/stock/:symbol',
    name: 'stock-detail',
    component: () => import('../views/StockDetailView.vue'),
    meta: { title: '个股详情' }
  },
  {
    path: '/search',
    name: 'stock-search',
    component: () => import('../views/StockSearchView.vue'),
    meta: { title: '自定义查询' }
  },
  {
    path: '/portfolio',
    name: 'portfolio',
    component: () => import('../views/PortfolioView.vue'),
    meta: { title: '个人持仓' }
  },
  {
    path: '/alerts',
    name: 'alerts',
    component: () => import('../views/AlertsView.vue'),
    meta: { title: '预警中心' }
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: () => import('../views/MyFavoritesView.vue'),
    meta: { title: '自选股' }
  },
  {
    path: '/ask',
    name: 'ask',
    component: () => import('../views/AskView.vue'),
    meta: { title: 'AI 问答' }
  },
  {
    path: '/mystic',
    name: 'mystic-pick',
    component: () => import('../views/MysticPickView.vue'),
    meta: { title: '玄学选股' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { title: '设置' }
  },
  { path: '/chain', redirect: '/sectors' },
  { path: '/dsx', redirect: '/' },
  { path: '/universe', redirect: '/sectors' },
  { path: '/watchlist', redirect: '/favorites' },
  { path: '/deep-dive', redirect: '/favorites' },
  { path: '/topics', redirect: '/sectors' },
  { path: '/research', redirect: '/' },
  { path: '/compare', redirect: '/' },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.afterEach((to) => {
  const baseTitle = i18n.global.t('app.title')
  const pageTitle = (to.meta?.title as string) || baseTitle
  document.title = `${pageTitle} · ${baseTitle}`
})

router.beforeEach(async (to) => {
  if (to.meta?.public === true) return true

  const account = useAccountStore()
  if (!account.checked && !account.loading) {
    account.refresh({ timeoutMs: 2000 }).catch(() => undefined)
  }
  if (account.enabled && !account.authenticated && !account.guest) {
    return { path: '/login', query: { next: to.fullPath } }
  }
  return true
})
