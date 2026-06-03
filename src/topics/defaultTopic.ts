// 默认主题: 全球 AI 底层供应链股票研究（2026-06 快照）
// 所有数据从原 HTML 报告迁移而来
import type { Topic } from './types'

export const AI_SUPPLY_CHAIN_TOPIC: Topic = {
  id: 'ai-supply-chain',
  name: 'AI 底层供应链',
  emoji: '🤖',
  description: '全球 AI 底层供应链股票研究：GPU/ASIC、HBM/存储、CCL/基板、液冷/电源、光通信/CPO、测试制造、设施',
  systemPrompt: '你是一位深度跟踪全球 AI 底层供应链的股票研究分析师。你的专长覆盖：云厂商 CapEx、GPU/ASIC 设计、HBM/DRAM/NAND 存储、CCL/ABF 基板、CoWoS 封装、液冷与电源、光通信/CPO、测试制造、机房与电力设施。',
  isBuiltIn: true,
  createdAt: 1717296000000,
  updatedAt: 1717296000000,
  data: {
    leaderUniverse: [
      // 来自原报告
      { region: '美股', layer: '需求', symbol: 'NVDA.US', name: 'NVIDIA', status: '核心' },
      { region: '美股', layer: '需求', symbol: 'MSFT.US', name: 'Microsoft', status: '核心' },
      { region: '美股', layer: '需求', symbol: 'GOOGL.US', name: 'Alphabet', status: '核心' },
      { region: '美股', layer: '需求', symbol: 'AMZN.US', name: 'Amazon', status: '核心' },
      { region: '美股', layer: '需求', symbol: 'META.US', name: 'Meta Platforms', status: '核心' },
      { region: '美股', layer: '需求', symbol: 'ORCL.US', name: 'Oracle', status: '重点' },
      { region: '美股', layer: '计算', symbol: 'AVGO.US', name: 'Broadcom', status: '核心' },
      { region: '美股', layer: '计算', symbol: 'AMD.US', name: 'AMD', status: '核心' },
      { region: '美股', layer: '计算', symbol: 'MRVL.US', name: 'Marvell', status: '重点' },
      { region: '美股', layer: '计算', symbol: 'ALAB.US', name: 'Astera Labs', status: '重点' },
      { region: '美股', layer: '计算', symbol: 'CRDO.US', name: 'Credo Technology', status: '重点' },
      { region: '美股', layer: '存储', symbol: 'MU.US', name: 'Micron', status: '核心' },
      { region: '美股', layer: '存储', symbol: 'WDC.US', name: 'Western Digital', status: '观察' },
      { region: '美股', layer: '存储', symbol: 'STX.US', name: 'Seagate', status: '观察' },
      { region: '美股', layer: '封装', symbol: 'ASX.US', name: 'ASE Technology', status: '重点' },
      { region: '美股', layer: '封装', symbol: 'AMKR.US', name: 'Amkor', status: '核心' },
      { region: '美股', layer: '测试', symbol: 'COHU.US', name: 'Cohu', status: '重点' },
      { region: '美股', layer: '测试', symbol: 'FORM.US', name: 'FormFactor', status: '重点' },
      { region: '美股', layer: '测试', symbol: 'TER.US', name: 'Teradyne', status: '核心' },
      { region: '美股', layer: '光通信', symbol: 'COHR.US', name: 'Coherent', status: '核心' },
      { region: '美股', layer: '光通信', symbol: 'LITE.US', name: 'Lumentum', status: '重点' },
      { region: '美股', layer: '设施', symbol: 'VRT.US', name: 'Vertiv', status: '核心' },
      { region: '美股', layer: '设施', symbol: 'CLS.US', name: 'Celestica', status: '重点' },
      { region: '美股', layer: '设施', symbol: 'GEV.US', name: 'GE Vernova', status: '核心' },
      { region: '美股', layer: '需求', symbol: 'CRWV.US', name: 'CoreWeave', status: '重点' },
      { region: '美股', layer: '需求', symbol: 'NBIS.US', name: 'Nebius', status: '重点' },
      { region: '美股', layer: '需求', symbol: 'IREN.US', name: 'Iris Energy', status: '重点' },
      { region: '美股', layer: '设计', symbol: 'CDNS.US', name: 'Cadence', status: '重点' },
      { region: '美股', layer: '设计', symbol: 'SNPS.US', name: 'Synopsys', status: '重点' },
      { region: '美股', layer: '设备', symbol: 'KLAC.US', name: 'KLA', status: '重点' },
      { region: '美股', layer: '设备', symbol: 'LRCX.US', name: 'Lam Research', status: '重点' },
      { region: '美股', layer: '设备', symbol: 'AMAT.US', name: 'Applied Materials', status: '重点' },
      { region: '美股', layer: '电源', symbol: 'ETN.US', name: 'Eaton', status: '重点' },
      { region: '美股', layer: '电源', symbol: 'APH.US', name: 'Amphenol', status: '重点' },
      { region: '美股', layer: '汽车AI', symbol: 'NXPI.US', name: 'NXP', status: '观察' },
      { region: '美股', layer: '服务器', symbol: 'SMCI.US', name: 'Super Micro', status: '重点' },
      { region: '美股', layer: '服务器', symbol: 'DELL.US', name: 'Dell', status: '重点' },
      { region: '美股', layer: '服务器', symbol: 'HPE.US', name: 'HPE', status: '观察' },
      // 台股
      { region: '台湾', layer: '晶圆', symbol: 'TSM.US', name: 'TSMC ADR', status: '核心' },
      { region: '台湾', layer: '光通信', symbol: '2345.TW', name: '智邦', status: '重点' },
      { region: '台湾', layer: '服务器', symbol: '6669.TW', name: '纬颖', status: '核心' },
      { region: '台湾', layer: '服务器', symbol: '3231.TW', name: '纬创', status: '重点' },
      { region: '台湾', layer: 'PCB', symbol: '3037.TW', name: '欣兴电子', status: '重点' },
      // 港股
      { region: '港股', layer: '服务器', symbol: '0992.HK', name: '联想集团', status: '观察' },
      { region: '港股', layer: '晶圆', symbol: '0981.HK', name: '中芯国际', status: '重点' },
      // 日股
      { region: '日本', layer: '设备', symbol: '8035.T', name: '东京电子', status: '重点' },
      { region: '日本', layer: '光通信', symbol: '6976.T', name: '太阳诱电', status: '观察' },
      // 韩股
      { region: '韩国', layer: '存储', symbol: '005930.KS', name: '三星电子', status: '核心' },
      { region: '韩国', layer: '存储', symbol: '000660.KS', name: 'SK海力士', status: '核心' },
      // A股
      { region: 'A股', layer: '光通信', symbol: '300308.SZ', name: '中际旭创', status: '核心' },
      { region: 'A股', layer: '光通信', symbol: '300394.SZ', name: '天孚通信', status: '重点' },
      { region: 'A股', layer: '光通信', symbol: '002463.SZ', name: '沪电股份', status: '重点' },
      { region: 'A股', layer: 'PCB', symbol: '002916.SZ', name: '深南电路', status: '重点' },
      { region: 'A股', layer: 'CCL', symbol: '600183.SH', name: '生益科技', status: '观察' },
      { region: 'A股', layer: '电源', symbol: '002837.SZ', name: '英维克', status: '重点' },
      { region: 'A股', layer: '电源', symbol: '002050.SZ', name: '三花智控', status: '观察' },
      { region: 'A股', layer: 'MLCC', symbol: '000636.SZ', name: '风华高科', status: '观察' },
      { region: 'A股', layer: '服务器', symbol: '300308.SZ', name: '中际旭创', status: '重点' },
      { region: 'A股', layer: '封装', symbol: '600584.SH', name: '长电科技', status: '观察' },
      { region: 'A股', layer: '晶圆', symbol: '688981.SH', name: '中芯国际', status: '重点' },
    ],
    watchlistIdeas: [
      { symbol: 'NVDA.US', name: 'NVIDIA', region: '美股', layer: '计算', evidence: 'AI 算力中心硬件主轴', d1: 0.5, d5: 2.1, d20: 8.3, d60: 25.4, d252: 95.2, risk: '估值高位', tags: ['核心', '高估值'], tagLabel: '核心高估值' },
      { symbol: 'AVGO.US', name: 'Broadcom', region: '美股', layer: '计算', evidence: 'ASIC + 网络芯片双驱动', d1: 0.3, d5: 1.8, d20: 6.2, d60: 18.7, d252: 78.3, risk: '客户集中', tags: ['核心'], tagLabel: '核心高估值' },
      { symbol: 'MU.US', name: 'Micron', region: '美股', layer: '存储', evidence: 'HBM 强劲需求', d1: 1.2, d5: 4.3, d20: 12.5, d60: 35.6, d252: 62.1, risk: '周期波动', tags: ['重点'], tagLabel: '等待确认' },
      { symbol: 'TSM.US', name: 'TSMC ADR', region: '台湾', layer: '晶圆', evidence: 'CoWoS 产能扩张', d1: 0.7, d5: 2.5, d20: 9.1, d60: 28.3, d252: 88.5, risk: '地缘政治', tags: ['核心'], tagLabel: '核心高估值' },
      { symbol: '300308.SZ', name: '中际旭创', region: 'A股', layer: '光通信', evidence: '800G/1.6T 龙头', d1: 2.1, d5: 5.6, d20: 18.2, d60: 42.5, d252: 156.3, risk: '估值高拥挤', tags: ['高优先级', '交易拥挤'], tagLabel: '交易拥挤' },
      { symbol: 'VRT.US', name: 'Vertiv', region: '美股', layer: '设施', evidence: '液冷 + UPS 龙头', d1: 0.8, d5: 3.1, d20: 11.4, d60: 22.6, d252: 67.8, risk: '客户集中', tags: ['重点'], tagLabel: '高优先级' },
      { symbol: 'GEV.US', name: 'GE Vernova', region: '美股', layer: '设施', evidence: '电网 + 燃气轮机', d1: 1.5, d5: 4.8, d20: 15.6, d60: 38.9, d252: 124.7, risk: '估值高位', tags: ['高优先级'], tagLabel: '高优先级' },
      { symbol: 'AMKR.US', name: 'Amkor', region: '美股', layer: '封装', evidence: '2.5D/3D 封装', d1: 0.4, d5: 1.5, d20: 5.2, d60: 12.3, d252: 45.6, risk: '客户依赖', tags: ['重点'], tagLabel: '等待确认' },
      { symbol: 'COHR.US', name: 'Coherent', region: '美股', layer: '光通信', evidence: 'InP + 硅光', d1: 0.6, d5: 2.3, d20: 8.1, d60: 19.4, d252: 56.2, risk: '竞争加剧', tags: ['重点'], tagLabel: '等待确认' },
      { symbol: '005930.KS', name: '三星电子', region: '韩国', layer: '存储', evidence: 'HBM 追赶', d1: 0.3, d5: 1.2, d20: 4.3, d60: 11.8, d252: 35.2, risk: '落后 HBM 进度', tags: ['观察'], tagLabel: '相对滞后' },
      { symbol: '000660.KS', name: 'SK海力士', region: '韩国', layer: '存储', evidence: 'HBM 龙头', d1: 1.8, d5: 5.2, d20: 16.4, d60: 41.2, d252: 124.5, risk: '估值高位', tags: ['高优先级'], tagLabel: '高优先级' },
      { symbol: '6669.TW', name: '纬颖', region: '台湾', layer: '服务器', evidence: 'AI 服务器 ODM', d1: 2.3, d5: 6.1, d20: 19.5, d60: 47.8, d252: 178.9, risk: '客户集中', tags: ['高优先级', '交易拥挤'], tagLabel: '交易拥挤' },
      { symbol: 'CRDO.US', name: 'Credo Technology', region: '美股', layer: '光通信', evidence: '高速连接芯片', d1: 1.4, d5: 4.5, d20: 14.2, d60: 36.7, d252: 98.4, risk: '客户依赖', tags: ['重点'], tagLabel: '等待确认' },
      { symbol: 'ETN.US', name: 'Eaton', region: '美股', layer: '电源', evidence: '数据中心电力', d1: 0.5, d5: 2.0, d20: 7.8, d60: 18.9, d252: 52.3, risk: '估值中性', tags: ['重点'], tagLabel: '等待确认' },
      { symbol: 'MRVL.US', name: 'Marvell', region: '美股', layer: '计算', evidence: 'ASIC + 光通信芯片', d1: 0.9, d5: 3.4, d20: 11.2, d60: 28.4, d252: 87.6, risk: '估值高位', tags: ['重点'], tagLabel: '等待确认' },
    ],
    deepDiveStocks: [
      { symbol: 'NVDA.US', name: 'NVIDIA', region: '美股', layer: '计算', status: '核心高估值',
        kline: [
          { label: '60日涨幅', value: '+25.4%' },
          { label: '60日波动', value: '18.2%' },
          { label: 'TTM PE', value: '52.3' },
          { label: 'TTM PS', value: '24.1' },
        ],
        flow: '主力资金持续净流入，期权 IV 30.5%，市场关注 8 月份财报指引',
        evidence: 'Hopper/Blackwell 量产爬坡、H200/B200 满产、GB200 NVL72 平台放量',
        valuation: 'EV/Sales 24x（高位），但 FY26 营收预期 +50%',
        peers: 'AVGO.US · AMD.US · MRVL.US',
        bear: '客户集中（前 4 客户占 40%），AI 训练需求见顶风险',
        sourceLabel: '公司财报 + 行业研报',
        sourceUrl: '#'
      },
      { symbol: '300308.SZ', name: '中际旭创', region: 'A股', layer: '光通信', status: '交易拥挤',
        kline: [
          { label: '60日涨幅', value: '+42.5%' },
          { label: '60日波动', value: '28.6%' },
          { label: 'TTM PE', value: '38.5' },
          { label: 'TTM PS', value: '8.9' },
        ],
        flow: '北向资金连续 10 日净买入，融资余额创历史新高',
        evidence: '800G 出货翻倍、1.6T 客户送样、硅光 CPO 平台合作',
        valuation: 'PE 38x 较历史中枢溢价 60%',
        peers: '300394.SZ · 002463.SZ · COHR.US',
        bear: '估值已透支 1.6T 预期，订单波动大',
        sourceLabel: '公司公告 + 行业调研',
        sourceUrl: '#'
      },
      { symbol: 'MU.US', name: 'Micron', region: '美股', layer: '存储', status: '等待确认',
        kline: [
          { label: '60日涨幅', value: '+35.6%' },
          { label: '60日波动', value: '22.4%' },
          { label: 'TTM PE', value: '26.8' },
          { label: 'TTM PS', value: '4.2' },
        ],
        flow: '机构持仓环比 +5.2%，对冲基金净多仓创年内新高',
        evidence: 'HBM3E 量产出货、HBM4 客户认证、NAND 价格反弹',
        valuation: 'PE 26x 处历史 70% 分位',
        peers: '005930.KS · 000660.KS · WDC.US',
        bear: 'AI HBM 需求集中，价格弹性或低于预期',
        sourceLabel: '公司业绩 + 行业研报',
        sourceUrl: '#'
      },
    ],
    chainLayers: [
      { id: 'demand', name: '需求', emoji: '☁️', description: '云厂商、模型、企业 AI、边缘 AI',
        stocks: [
          { symbol: 'MSFT.US', name: 'Microsoft' },
          { symbol: 'GOOGL.US', name: 'Alphabet' },
          { symbol: 'AMZN.US', name: 'Amazon' },
          { symbol: 'META.US', name: 'Meta' },
          { symbol: 'ORCL.US', name: 'Oracle' },
          { symbol: 'CRWV.US', name: 'CoreWeave' },
        ]
      },
      { id: 'compute', name: '计算', emoji: '🧮', description: 'GPU、ASIC、CPU、网络芯片',
        stocks: [
          { symbol: 'NVDA.US', name: 'NVIDIA' },
          { symbol: 'AVGO.US', name: 'Broadcom' },
          { symbol: 'AMD.US', name: 'AMD' },
          { symbol: 'MRVL.US', name: 'Marvell' },
          { symbol: 'ALAB.US', name: 'Astera Labs' },
          { symbol: 'CRDO.US', name: 'Credo' },
        ]
      },
      { id: 'memory', name: '存储', emoji: '💾', description: 'HBM、DRAM、NAND、eSSD',
        stocks: [
          { symbol: 'MU.US', name: 'Micron' },
          { symbol: '005930.KS', name: '三星电子' },
          { symbol: '000660.KS', name: 'SK海力士' },
          { symbol: 'WDC.US', name: 'Western Digital' },
        ]
      },
      { id: 'ccl', name: '电子布/CCL', emoji: '🧵', description: '电子纱、低介电玻纤布、铜箔、树脂、覆铜板',
        stocks: [
          { symbol: '600183.SH', name: '生益科技' },
        ]
      },
      { id: 'packaging', name: '封装/基板', emoji: '📦', description: 'CoWoS、ABF、FCBGA、陶瓷基板、高速 PCB',
        stocks: [
          { symbol: 'ASX.US', name: 'ASE' },
          { symbol: 'AMKR.US', name: 'Amkor' },
          { symbol: '600584.SH', name: '长电科技' },
          { symbol: '3037.TW', name: '欣兴电子' },
        ]
      },
      { id: 'passive', name: '被动元件', emoji: '⚡', description: 'MLCC、电容、电感、磁性元件',
        stocks: [
          { symbol: '000636.SZ', name: '风华高科' },
        ]
      },
      { id: 'power', name: '电源', emoji: '🔌', description: 'VRM、GaN/SiC、PSU、BBU、UPS',
        stocks: [
          { symbol: 'ETN.US', name: 'Eaton' },
          { symbol: '002837.SZ', name: '英维克' },
        ]
      },
      { id: 'optics', name: '光通信/CPO', emoji: '💡', description: '易中天、800G/1.6T、InP/EML、硅光、交换机',
        stocks: [
          { symbol: '300308.SZ', name: '中际旭创' },
          { symbol: '300394.SZ', name: '天孚通信' },
          { symbol: '002463.SZ', name: '沪电股份' },
          { symbol: 'COHR.US', name: 'Coherent' },
          { symbol: 'LITE.US', name: 'Lumentum' },
        ]
      },
      { id: 'test', name: '测试制造', emoji: '🔬', description: 'ATE、probe card、socket、burn-in',
        stocks: [
          { symbol: 'TER.US', name: 'Teradyne' },
          { symbol: 'COHU.US', name: 'Cohu' },
          { symbol: 'FORM.US', name: 'FormFactor' },
        ]
      },
      { id: 'facility', name: '设施', emoji: '🏗️', description: '液冷、CDU、变压器、开关柜、电网',
        stocks: [
          { symbol: 'VRT.US', name: 'Vertiv' },
          { symbol: 'CLS.US', name: 'Celestica' },
          { symbol: 'GEV.US', name: 'GE Vernova' },
        ]
      },
    ],
    dsxLayers: [
      { id: 'L1', name: 'AI 云服务', description: '算力出租',
        stocks: [
          { symbol: 'CRWV.US', name: 'CoreWeave' },
          { symbol: 'NBIS.US', name: 'Nebius' },
          { symbol: 'IREN.US', name: 'Iris Energy' },
        ]
      },
      { id: 'L2', name: 'AI 工厂软件', description: '调度运转',
        stocks: [
          { symbol: 'IBM.US', name: 'IBM' },
        ]
      },
      { id: 'L3', name: '设计与工程', description: '设计建设',
        stocks: [
          { symbol: 'CDNS.US', name: 'Cadence' },
          { symbol: 'SNPS.US', name: 'Synopsys' },
        ]
      },
      { id: 'L4', name: '能源与散热', description: '供电降温',
        stocks: [
          { symbol: 'VRT.US', name: 'Vertiv' },
          { symbol: 'GEV.US', name: 'GE Vernova' },
          { symbol: 'ETN.US', name: 'Eaton' },
        ]
      },
      { id: 'L5', name: '机房与园区', description: '机房供给',
        stocks: []
      },
      { id: 'L6', name: '算力系统', description: '服务器制造',
        stocks: [
          { symbol: 'SMCI.US', name: 'Super Micro' },
          { symbol: 'DELL.US', name: 'Dell' },
          { symbol: '6669.TW', name: '纬颖' },
        ]
      },
    ],
    homeCards: [
      { id: 'heat', title: '半导体主线热度', value: '高', tone: 'up', description: 'SMH.US 60日 +53.7%，SOXX.US 60日 +69.4%。' },
      { id: 'priority', title: '重点优先层', value: '材料/测试/连接', tone: 'neutral', description: 'ABF、陶瓷基板、probe card、连接器、低位液冷更容易出现预期差。' },
      { id: 'cn', title: '中国链条', value: '分化', tone: 'info', description: '光模块、PCB、MLCC、电容短期热度较高。' },
      { id: 'eu', title: '欧洲机会', value: '稳健型', tone: 'neutral', description: '施耐德、西门子、Eaton、VAT、GE Vernova直接受数据中心电气化拉动。' },
    ],
    postMarketStrong: [
      { symbol: 'AVGO.US', name: 'Broadcom', region: '美股', reason: '盘后 +2.71%，ASIC/网络芯片仍强', change: 0.0271 },
      { symbol: 'MU.US', name: 'Micron', region: '美股', reason: '盘后 +0.44%，内存主线仍具相对强度', change: 0.0044 },
      { symbol: 'VRT.US', name: 'Vertiv', region: '美股', reason: '盘后 +0.75%，数据中心设施资金表现相对较强', change: 0.0075 },
      { symbol: 'CLS.US', name: 'Celestica', region: '美股', reason: '盘后 +2.22%，数据中心设施资金表现相对较强', change: 0.0222 },
    ],
    postMarketWeak: [
      { symbol: 'ALAB.US', name: 'Astera Labs', region: '美股', reason: '盘后 -2.49%，但 60 日仍 +166.7%，偏高位回撤', change: -0.0249 },
      { symbol: 'FORM.US', name: 'FormFactor', region: '美股', reason: '盘后 -0.60%，20 日 -16.2%，需要技术面修复', change: -0.006 },
      { symbol: 'NXPI.US', name: 'NXP', region: '美股', reason: '盘后 -0.89%，汽车/边缘AI混合敞口', change: -0.0089 },
    ],
    counterConditions: [
      { title: '产业链反证', items: [
        '云厂商 CapEx 或 AI 服务器订单指引下修',
        'HBM/DRAM 价格和交期不再上行，或者库存重新累积',
        'ABF、FCBGA、MLCC、电容、电感没有涨价或交期拉长',
        'probe card、socket、burn-in 订单没有随 AI 芯片量产恢复',
        '液冷收入增长但毛利率下降',
      ]},
      { title: '市场反证', items: [
        'QQQ.US 与 SMH.US 同时走弱，且强势股 AVGO/MU/TSM 也转负',
        '候选股连续 20 个交易日跑输对应区域 ETF 或行业 ETF',
        '公司官方财报不再提 AI/data center/HBM/HPC 相关需求',
        '出口管制、战争、关税导致订单取消或供应链迁移',
      ]},
    ],
  },
}
