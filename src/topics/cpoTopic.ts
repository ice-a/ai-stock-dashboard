// CPO (Co-Packaged Optics / 共封装光学) 主题
// 聚焦 CPO 产业链：硅光芯片、光引擎、FAU、光纤连接器、交换机、激光器、调制器、PD/APD
import type { Topic } from './types'

export const CPO_TOPIC: Topic = {
  id: 'cpo',
  name: 'CPO 共封装光学',
  emoji: '🔦',
  description: 'CPO (Co-Packaged Optics) 产业链深度研究：硅光芯片、光引擎、激光器/调制器/探测器、光纤阵列/连接器、CPO 交换机、光学封装与测试',
  systemPrompt: '你是一位深度跟踪 CPO (Co-Packaged Optics) 产业链的股票研究分析师。你的专长覆盖：硅光芯片设计、光引擎集成、InP/DFB/EML 激光器、硅基调制器、PD/APD 探测器、光纤阵列单元 (FAU)、光纤连接器/插芯、CPO 交换机架构、光学封装与测试、数据中心光互连。你熟悉 Broadcom、Coherent、Lumentum、中际旭创、天孚通信、光迅科技、华工科技、沪电股份、致尚科技、太辰光、炬光科技、长光华芯等核心标的。',
  isBuiltIn: true,
  createdAt: 1717296000000,
  updatedAt: 1717296000000,
  data: {
    leaderUniverse: [
      // 美股 - 光通信/CPO 核心
      { region: '美股', layer: 'CPO 芯片', symbol: 'AVGO.US', name: 'Broadcom', status: '核心' },
      { region: '美股', layer: '激光器', symbol: 'COHR.US', name: 'Coherent', status: '核心' },
      { region: '美股', layer: '光器件', symbol: 'LITE.US', name: 'Lumentum', status: '重点' },
      { region: '美股', layer: '光互连', symbol: 'MRVL.US', name: 'Marvell', status: '重点' },
      { region: '美股', layer: '光互连', symbol: 'CRDO.US', name: 'Credo Technology', status: '重点' },
      { region: '美股', layer: '连接器', symbol: 'APH.US', name: 'Amphenol', status: '重点' },
      { region: '美股', layer: '连接器', symbol: 'TEL.US', name: 'TE Connectivity', status: '重点' },
      { region: '美股', layer: '硅光', symbol: 'INTC.US', name: 'Intel', status: '观察' },
      { region: '美股', layer: '硅光', symbol: 'NVDA.US', name: 'NVIDIA', status: '观察' },
      // A股 - 光模块/CPO
      { region: 'A股', layer: '光模块', symbol: '300308.SZ', name: '中际旭创', status: '核心' },
      { region: 'A股', layer: '光器件', symbol: '300394.SZ', name: '天孚通信', status: '核心' },
      { region: 'A股', layer: '光模块', symbol: '002281.SZ', name: '光迅科技', status: '重点' },
      { region: 'A股', layer: '光模块', symbol: '000988.SZ', name: '华工科技', status: '重点' },
      { region: 'A股', layer: '连接器', symbol: '301486.SZ', name: '致尚科技', status: '重点' },
      { region: 'A股', layer: '连接器', symbol: '300570.SZ', name: '太辰光', status: '重点' },
      { region: 'A股', layer: '光纤', symbol: '600487.SH', name: '亨通光电', status: '观察' },
      { region: 'A股', layer: '光纤', symbol: '600120.SH', name: '永鼎股份', status: '观察' },
      { region: 'A股', layer: '激光器芯片', symbol: '688048.SH', name: '长光华芯', status: '重点' },
      { region: 'A股', layer: '光学元件', symbol: '688167.SH', name: '炬光科技', status: '重点' },
      { region: 'A股', layer: 'PCB', symbol: '002463.SZ', name: '沪电股份', status: '重点' },
      { region: 'A股', layer: 'PCB', symbol: '002916.SZ', name: '深南电路', status: '观察' },
      { region: 'A股', layer: '硅光', symbol: '300223.SZ', name: '北京君正', status: '观察' },
      // 台股
      { region: '台湾', layer: '光通信', symbol: '2345.TW', name: '智邦', status: '重点' },
      { region: '台湾', layer: '光通信', symbol: '2455.TW', name: '全新', status: '观察' },
      { region: '台湾', layer: '光通信', symbol: '4977.TW', name: '众达', status: '观察' },
      // 日股
      { region: '日本', layer: '光器件', symbol: '6976.T', name: '太阳诱电', status: '观察' },
      { region: '日本', layer: '光器件', symbol: '6752.T', name: '松下', status: '观察' },
      // 韩股
      { region: '韩国', layer: '光通信', symbol: '005930.KS', name: '三星电子', status: '观察' },
    ],
    watchlistIdeas: [
      { symbol: '300308.SZ', name: '中际旭创', region: 'A股', layer: '光模块', evidence: '800G 全球龙头，1.6T 送样，硅光 CPO 平台合作', d1: 2.1, d5: 5.6, d20: 18.2, d60: 42.5, d252: 156.3, risk: '估值高拥挤', tags: ['高优先级', '交易拥挤'], tagLabel: '交易拥挤' },
      { symbol: 'COHR.US', name: 'Coherent', region: '美股', layer: '激光器', evidence: 'InP 激光器 + 硅光 CPO 光引擎，数据中心收入占比提升', d1: 0.6, d5: 2.3, d20: 8.1, d60: 19.4, d252: 56.2, risk: '竞争加剧', tags: ['重点'], tagLabel: '等待确认' },
      { symbol: 'AVGO.US', name: 'Broadcom', region: '美股', layer: 'CPO 芯片', evidence: 'Tomahawk 5 CPO 交换机芯片 + 硅光 PIC 协同，Broadcom 是 CPO 架构定义者', d1: 0.3, d5: 1.8, d20: 6.2, d60: 18.7, d252: 78.3, risk: '客户集中', tags: ['核心'], tagLabel: '核心高估值' },
      { symbol: '300394.SZ', name: '天孚通信', region: 'A股', layer: '光器件', evidence: '光引擎 + FAU + 隔离器，CPO 时代光器件平台化受益', d1: 1.5, d5: 4.2, d20: 14.8, d60: 35.2, d252: 112.4, risk: '客户集中', tags: ['高优先级'], tagLabel: '高优先级' },
      { symbol: 'LITE.US', name: 'Lumentum', region: '美股', layer: '光器件', evidence: 'WSS + 可调激光器 + 3D 传感，CPO 用窄线宽激光器', d1: 0.4, d5: 1.8, d20: 6.5, d60: 15.3, d252: 42.1, risk: '苹果依赖', tags: ['重点'], tagLabel: '等待确认' },
      { symbol: '002281.SZ', name: '光迅科技', region: 'A股', layer: '光模块', evidence: '国内唯一垂直整合光芯片-模块，硅光 CPO 研发领先', d1: 1.2, d5: 3.5, d20: 11.2, d60: 28.6, d252: 85.3, risk: '毛利率压力', tags: ['重点'], tagLabel: '等待确认' },
      { symbol: '000988.SZ', name: '华工科技', region: 'A股', layer: '光模块', evidence: '800G 硅光模块量产，1.6T 研发中，子公司华工正源', d1: 1.8, d5: 4.8, d20: 15.3, d60: 32.1, d252: 98.7, risk: '估值偏高', tags: ['重点'], tagLabel: '高优先级' },
      { symbol: '301486.SZ', name: '致尚科技', region: 'A股', layer: '连接器', evidence: 'FAU + 光纤连接器，CPO 光互连关键组件', d1: 2.5, d5: 6.2, d20: 20.1, d60: 45.3, d252: 135.6, risk: '新业务不确定性', tags: ['高优先级', '交易拥挤'], tagLabel: '交易拥挤' },
      { symbol: '300570.SZ', name: '太辰光', region: 'A股', layer: '连接器', evidence: '光纤连接器 + MPO/MTP，高密度光互连 CPO 化受益', d1: 1.1, d5: 3.2, d20: 10.5, d60: 24.8, d252: 72.3, risk: '客户集中', tags: ['重点'], tagLabel: '等待确认' },
      { symbol: '688048.SH', name: '长光华芯', region: 'A股', layer: '激光器芯片', evidence: '高功率激光芯片，VCSEL/DFB/EML 全平台，CPO 光源国产替代', d1: 0.8, d5: 2.8, d20: 9.2, d60: 22.4, d252: 68.5, risk: '产能爬坡', tags: ['重点'], tagLabel: '等待确认' },
      { symbol: '688167.SH', name: '炬光科技', region: 'A股', layer: '光学元件', evidence: '微光学透镜 + 光束整形，CPO 光引擎光学耦合关键', d1: 0.5, d5: 2.1, d20: 7.8, d60: 18.6, d252: 52.4, risk: '汽车业务波动', tags: ['观察'], tagLabel: '等待确认' },
      { symbol: 'MRVL.US', name: 'Marvell', region: '美股', layer: '光互连', evidence: 'PAM4 DSP + 硅光 TIA/驱动器，CPO 电芯片核心', d1: 0.9, d5: 3.4, d20: 11.2, d60: 28.4, d252: 87.6, risk: '估值高位', tags: ['重点'], tagLabel: '等待确认' },
      { symbol: 'CRDO.US', name: 'Credo Technology', region: '美股', layer: '光互连', evidence: '高速 AEC + PAM4 DSP，CPO 短距互连替代方案', d1: 1.4, d5: 4.5, d20: 14.2, d60: 36.7, d252: 98.4, risk: '客户依赖', tags: ['重点'], tagLabel: '等待确认' },
      { symbol: 'APH.US', name: 'Amphenol', region: '美股', layer: '连接器', evidence: '高速连接器 + 光纤互连，CPO 外部光 I/O 连接器', d1: 0.4, d5: 1.5, d20: 5.8, d60: 14.2, d252: 38.6, risk: '估值中性', tags: ['观察'], tagLabel: '等待确认' },
    ],
    deepDiveStocks: [
      {
        symbol: '300308.SZ', name: '中际旭创', region: 'A股', layer: '光模块', status: '交易拥挤',
        kline: [
          { label: '60日涨幅', value: '+42.5%' },
          { label: '60日波动', value: '28.6%' },
          { label: 'TTM PE', value: '38.5' },
          { label: 'TTM PS', value: '8.9' },
        ],
        flow: '北向资金连续净买入，融资余额创历史新高，机构持仓环比 +3.2%',
        evidence: '800G 出货翻倍、1.6T 客户送样、硅光 CPO 平台与 Broadcom 合作',
        valuation: 'PE 38x 较历史中枢溢价 60%，但 1.6T 和 CPO 预期尚未充分定价',
        peers: '300394.SZ · 002281.SZ · COHR.US',
        bear: '估值已透支 1.6T 预期，CPO 替代时间点不确定，订单波动大',
        sourceLabel: '公司公告 + 行业调研',
        sourceUrl: '#',
      },
      {
        symbol: 'COHR.US', name: 'Coherent', region: '美股', layer: '激光器', status: '等待确认',
        kline: [
          { label: '60日涨幅', value: '+19.4%' },
          { label: '60日波动', value: '24.1%' },
          { label: 'TTM PE', value: 'N/A' },
          { label: 'TTM PS', value: '3.2' },
        ],
        flow: '机构持仓环比 +2.8%，数据中心收入占比持续提升',
        evidence: 'InP 激光器全球领先，硅光 CPO 光引擎送样，3D 传感 + 数据中心双轮驱动',
        valuation: 'PS 3.2x 处历史低位，数据中心收入增速 40%+',
        peers: 'LITE.US · 300308.SZ · 688048.SH',
        bear: '传统工业激光业务下滑，CPO 收入贡献尚小',
        sourceLabel: '公司财报 + 行业研报',
        sourceUrl: '#',
      },
      {
        symbol: '300394.SZ', name: '天孚通信', region: 'A股', layer: '光器件', status: '高优先级',
        kline: [
          { label: '60日涨幅', value: '+35.2%' },
          { label: '60日波动', value: '22.8%' },
          { label: 'TTM PE', value: '45.2' },
          { label: 'TTM PS', value: '12.4' },
        ],
        flow: '北向资金持续增持，机构持仓创历史新高',
        evidence: '光引擎平台化、FAU 量产、隔离器全球份额第一，CPO 时代光器件价值量提升',
        valuation: 'PE 45x 较高，但平台化逻辑和 CPO 增量支撑溢价',
        peers: '300308.SZ · 301486.SZ · 300570.SZ',
        bear: '客户集中度高（中际旭创占比大），CPO 光引擎验证进度',
        sourceLabel: '公司业绩 + 行业调研',
        sourceUrl: '#',
      },
    ],
    chainLayers: [
      {
        id: 'cpo-switch', name: 'CPO 交换机', emoji: '🔀',
        description: '将光引擎集成到交换机 ASIC 旁，降低功耗和延迟',
        stocks: [
          { symbol: 'AVGO.US', name: 'Broadcom', note: 'Tomahawk 5 CPO 架构定义者' },
          { symbol: 'MRVL.US', name: 'Marvell', note: 'Innovium 交换机芯片' },
          { symbol: 'INTC.US', name: 'Intel', note: '硅光交换机研究' },
          { symbol: 'NVDA.US', name: 'NVIDIA', note: 'Spectrum-X 以太网交换机' },
        ],
      },
      {
        id: 'silicon-photonics', name: '硅光芯片', emoji: '💎',
        description: '硅基 PIC（光子集成电路）：调制器、波导、耦合器、WDM',
        stocks: [
          { symbol: 'INTC.US', name: 'Intel', note: '硅光收发器全球领先' },
          { symbol: 'AVGO.US', name: 'Broadcom', note: '硅光 PIC 与 ASIC 协同' },
          { symbol: '300223.SZ', name: '北京君正', note: '硅光芯片研发' },
        ],
      },
      {
        id: 'laser', name: '激光器', emoji: '🔴',
        description: 'DFB、EML、VCSEL、可调激光器，CPO 光源',
        stocks: [
          { symbol: 'COHR.US', name: 'Coherent', note: 'InP 激光器全球领先' },
          { symbol: 'LITE.US', name: 'Lumentum', note: '可调激光器 + WSS' },
          { symbol: '688048.SH', name: '长光华芯', note: 'VCSEL/DFB/EML 国产替代' },
          { symbol: '6752.T', name: '松下', note: 'VCSEL' },
        ],
      },
      {
        id: 'modulator-detector', name: '调制器/探测器', emoji: '📡',
        description: '硅基调制器、MZ 调制器、PD、APD',
        stocks: [
          { symbol: 'AVGO.US', name: 'Broadcom', note: '硅光调制器' },
          { symbol: 'MRVL.US', name: 'Marvell', note: 'PAM4 DSP + TIA' },
          { symbol: 'CRDO.US', name: 'Credo', note: 'PAM4 DSP' },
        ],
      },
      {
        id: 'optical-engine', name: '光引擎', emoji: '⚙️',
        description: '光引擎集成：激光器 + 调制器 + PD + 光学耦合',
        stocks: [
          { symbol: '300394.SZ', name: '天孚通信', note: '光引擎平台' },
          { symbol: '300308.SZ', name: '中际旭创', note: '硅光 CPO 光引擎' },
          { symbol: 'COHR.US', name: 'Coherent', note: 'CPO 光引擎' },
        ],
      },
      {
        id: 'fau-connector', name: 'FAU/连接器', emoji: '🔌',
        description: '光纤阵列单元、MPO/MTP 连接器、光纤插芯',
        stocks: [
          { symbol: '301486.SZ', name: '致尚科技', note: 'FAU + 光纤连接器' },
          { symbol: '300570.SZ', name: '太辰光', note: 'MPO/MTP 连接器' },
          { symbol: 'APH.US', name: 'Amphenol', note: '高速光纤连接器' },
          { symbol: 'TEL.US', name: 'TE Connectivity', note: '光纤互连' },
          { symbol: '600487.SH', name: '亨通光电', note: '光纤光缆' },
          { symbol: '600120.SH', name: '永鼎股份', note: '光纤光缆' },
        ],
      },
      {
        id: 'optical-module', name: '光模块', emoji: '📦',
        description: '800G/1.6T 光模块，CPO 时代过渡方案',
        stocks: [
          { symbol: '300308.SZ', name: '中际旭创', note: '800G/1.6T 龙头' },
          { symbol: '002281.SZ', name: '光迅科技', note: '垂直整合光芯片-模块' },
          { symbol: '000988.SZ', name: '华工科技', note: '800G 硅光模块' },
          { symbol: '2345.TW', name: '智邦', note: '光模块 ODM' },
        ],
      },
      {
        id: 'optical-packaging', name: '光学封装测试', emoji: '🔬',
        description: '光学耦合、贴片、wire bonding、测试',
        stocks: [
          { symbol: '688167.SH', name: '炬光科技', note: '微光学透镜 + 光束整形' },
          { symbol: '300394.SZ', name: '天孚通信', note: '光学封装平台' },
        ],
      },
      {
        id: 'pcb-substrate', name: 'PCB/基板', emoji: '🟩',
        description: '高速 PCB、载板，CPO 基板互连',
        stocks: [
          { symbol: '002463.SZ', name: '沪电股份', note: '高速 PCB' },
          { symbol: '002916.SZ', name: '深南电路', note: '高速载板' },
        ],
      },
    ],
    dsxLayers: [
      {
        id: 'L1', name: 'CPO 系统', description: 'CPO 交换机 + 光引擎',
        stocks: [
          { symbol: 'AVGO.US', name: 'Broadcom' },
          { symbol: 'NVDA.US', name: 'NVIDIA' },
        ],
      },
      {
        id: 'L2', name: '光芯片', description: '硅光 PIC + 激光器 + 调制器 + PD',
        stocks: [
          { symbol: 'INTC.US', name: 'Intel' },
          { symbol: 'COHR.US', name: 'Coherent' },
          { symbol: '688048.SH', name: '长光华芯' },
        ],
      },
      {
        id: 'L3', name: '光引擎/器件', description: '光引擎集成 + 无源器件',
        stocks: [
          { symbol: '300394.SZ', name: '天孚通信' },
          { symbol: 'LITE.US', name: 'Lumentum' },
        ],
      },
      {
        id: 'L4', name: '光互连组件', description: 'FAU + 光纤连接器 + 光纤',
        stocks: [
          { symbol: '301486.SZ', name: '致尚科技' },
          { symbol: '300570.SZ', name: '太辰光' },
          { symbol: 'APH.US', name: 'Amphenol' },
        ],
      },
      {
        id: 'L5', name: '光模块', description: '800G/1.6T 可插拔光模块',
        stocks: [
          { symbol: '300308.SZ', name: '中际旭创' },
          { symbol: '002281.SZ', name: '光迅科技' },
          { symbol: '000988.SZ', name: '华工科技' },
        ],
      },
      {
        id: 'L6', name: '光学材料与封装', description: '光学透镜 + 基板 + 封装',
        stocks: [
          { symbol: '688167.SH', name: '炬光科技' },
          { symbol: '002463.SZ', name: '沪电股份' },
        ],
      },
    ],
    homeCards: [
      { id: 'cpo-timeline', title: 'CPO 量产时间线', value: '2026-2028', tone: 'info', description: 'Broadcom Tomahawk 5 CPO 预计 2026 年量产，1.6T CPO 预计 2027-2028 年。可插拔光模块仍是 2026 年主流。' },
      { id: 'cpo-driver', title: 'CPO 核心驱动力', value: '功耗 + 带宽', tone: 'up', description: '3.2T 以上光互连功耗瓶颈显著，CPO 将光引擎移至 ASIC 旁，降低 30-50% 功耗，提升带宽密度。' },
      { id: 'cpo-risk', title: 'CPO 主要风险', value: '替代节奏', tone: 'down', description: '可插拔光模块技术持续进步（LPO/LRO），CPO 替代时间点可能延后。光学耦合良率和可靠性仍是工程挑战。' },
      { id: 'cn-cpo', title: '中国 CPO 链条', value: '光模块强', tone: 'info', description: '中际旭创、天孚通信、光迅科技在 800G/1.6T 领先，但硅光芯片和激光器芯片仍依赖进口。长光华芯、炬光科技加速国产替代。' },
    ],
    postMarketStrong: [
      { symbol: 'AVGO.US', name: 'Broadcom', region: '美股', reason: 'CPO 交换机芯片架构定义者，Tomahawk 5 CPO 送样', change: 0.018 },
      { symbol: '300308.SZ', name: '中际旭创', region: 'A股', reason: '800G 出货量超预期，1.6T 客户认证推进', change: 0.025 },
      { symbol: '300394.SZ', name: '天孚通信', region: 'A股', reason: '光引擎平台化逻辑持续验证', change: 0.019 },
    ],
    postMarketWeak: [
      { symbol: 'LITE.US', name: 'Lumentum', region: '美股', reason: '盘后 -1.2%，苹果需求不确定性', change: -0.012 },
      { symbol: 'INTC.US', name: 'Intel', region: '美股', reason: '盘后 -0.8%，硅光业务剥离传闻', change: -0.008 },
    ],
    counterConditions: [
      { title: 'CPO 产业反证', items: [
        'Broadcom / NVIDIA 推迟 CPO 交换机量产时间表',
        '可插拔光模块（LPO/LRO）功耗持续改善，CPO 必要性下降',
        '硅光芯片良率不达预期，成本无法下降',
        '光学耦合可靠性问题导致数据中心客户拒绝 CPO 方案',
        '云厂商 CapEx 下修，光互连整体需求放缓',
      ]},
      { title: '市场反证', items: [
        '光模块龙头连续 20 日跑输 SOXX 或 SMH',
        'CPO 相关标的估值大幅回撤且无基本面支撑',
        '公司财报不再提及 CPO / 硅光 / 数据中心光互连',
        '出口管制导致中国光模块厂商失去海外客户',
      ]},
    ],
  },
}