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
    path: '/user',
    name: 'user',
    component: () => import('../views/UserView.vue'),
    meta: { title: '用户中心' }
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
    path: '/favorites',
    name: 'favorites',
    component: () => import('../views/MyFavoritesView.vue'),
    meta: { title: '自选股' }
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
  { path: '/watchlist', redirect: '/favorites' },
  { path: '/deep-dive', redirect: '/favorites' },
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
