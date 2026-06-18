// 股票分析 Prompt 模板

export interface StockAnalysisContext {
  symbol: string
  name: string
  market: 'A' | 'HK' | 'US'
  currentPrice?: number
  change?: number
  klineData?: string
  fundFlowData?: string
  technicalData?: string
  financeData?: string
  profileData?: string
  chipData?: string
  shareholderData?: string
  dividendData?: string
  etfData?: string
}

// AI 评级维度（这些是AI分析的维度，不是数据展示）
export interface RatingDimension {
  name: string
  description: string
  weight: number
}

export const RATING_DIMENSIONS: RatingDimension[] = [
  { name: '趋势判断', description: '价格趋势方向和强度', weight: 0.2 },
  { name: '动量分析', description: '价格变动的速度和力度', weight: 0.15 },
  { name: '量价配合', description: '成交量与价格的协调性', weight: 0.15 },
  { name: '风险评估', description: '潜在下跌风险和波动性', weight: 0.2 },
  { name: '时机判断', description: '当前是否适合买入/卖出', weight: 0.3 },
]

// AI 评级 Prompt - 专注于交易决策
export function buildRatingPrompt(context: StockAnalysisContext): string {
  return `你是一位专业的量化交易分析师，请基于以下数据给出明确的交易建议。

## 股票信息
- 代码：${context.symbol}
- 名称：${context.name}
- 市场：${context.market}
${context.currentPrice ? `- 当前价格：${context.currentPrice}` : ''}
${context.change ? `- 今日涨跌：${context.change}%` : ''}

## 数据来源
${context.klineData ? `\n### K线数据\n${context.klineData}` : ''}
${context.fundFlowData ? `\n### 资金流向\n${context.fundFlowData}` : ''}
${context.technicalData ? `\n### 技术指标\n${context.technicalData}` : ''}
${context.chipData ? `\n### 筹码数据\n${context.chipData}` : ''}

## 分析要求

请从以下5个维度进行评分（1-10分）：

1. **趋势判断**：价格趋势方向、趋势强度、关键位置
2. **动量分析**：价格变动速度、力度、加速度
3. **量价配合**：成交量变化、量价关系、资金动向
4. **风险评估**：下跌风险、波动性、止损位置
5. **时机判断**：是否适合买入/卖出、入场点位、目标价位

## 输出格式

请严格按以下JSON格式输出，不要有任何其他文字：

{"overallRating":"买入/增持/持有/减持/卖出","overallScore":7.5,"summary":"一句话总结","buyPrice":100,"sellPrice":120,"stopLoss":95,"riskLevel":"低/中/高","dimensions":[{"name":"趋势判断","score":8,"analysis":"分析内容","signal":"positive/neutral/negative"},{"name":"动量分析","score":7,"analysis":"分析内容","signal":"positive/neutral/negative"},{"name":"量价配合","score":6,"analysis":"分析内容","signal":"positive/neutral/negative"},{"name":"风险评估","score":8,"analysis":"分析内容","signal":"positive/neutral/negative"},{"name":"时机判断","score":7,"analysis":"分析内容","signal":"positive/neutral/negative"}],"risks":["风险1","风险2"],"catalysts":["催化剂1","催化剂2"]}`
}

// 自选股批量评级 Prompt
export function buildBatchRatingPrompt(stocks: Array<{
  symbol: string
  name: string
  price: number | null
  change: number | null
}>): string {
  const stockList = stocks.map(s =>
    `- ${s.symbol} ${s.name}: 价格${s.price || 'N/A'}, 涨跌${s.change ? (s.change * 100).toFixed(2) + '%' : 'N/A'}`
  ).join('\n')

  return `请对以下自选股进行快速评级，给出明确的买卖建议。

## 股票列表
${stockList}

## 分析要求

对每只股票：
1. 根据当前价格和涨跌幅判断短期走势
2. 给出明确的评级：买入/增持/持有/减持/卖出
3. 说明理由（一句话）
4. 提示主要风险

## 输出格式

请严格按以下JSON格式输出，不要有任何其他文字：

{"ratings":[{"symbol":"NVDA.US","rating":"买入","score":8,"reason":"理由","risk":"风险","targetPrice":120},{"symbol":"AAPL.US","rating":"持有","score":6,"reason":"理由","risk":"风险","targetPrice":180}]}`
}

// 持仓盈亏分析 Prompt
export function buildPortfolioRatingPrompt(holdings: Array<{
  symbol: string
  name: string
  buyPrice: number
  currentPrice: number | null
  profitRate: number | null
  quantity: number
}>): string {
  const holdingsList = holdings.map(h =>
    `- ${h.symbol} ${h.name}: 买入价${h.buyPrice}, 现价${h.currentPrice || 'N/A'}, 盈亏${h.profitRate ? (h.profitRate * 100).toFixed(2) + '%' : 'N/A'}, 数量${h.quantity}`
  ).join('\n')

  return `请对以下持仓进行分析，给出操作建议。

## 持仓明细
${holdingsList}

## 分析要求

对每只持仓：
1. 评估当前盈亏状态
2. 给出操作建议：加仓/持有/减仓/清仓
3. 说明理由
4. 提示风险和机会

## 输出格式

请严格按以下JSON格式输出，不要有任何其他文字：

{"summary":"整体评价","totalRisk":"低/中/高","suggestions":[{"symbol":"NVDA.US","action":"持有","reason":"理由","risk":"风险"},{"symbol":"AAPL.US","action":"减仓","reason":"理由","risk":"风险"}]}`
}

// 资金面分析 Prompt
export function buildFundFlowPrompt(fundFlowData: string): string {
  return `请分析以下资金流向数据：

${fundFlowData}

分析要点：
1. 主力资金净流入/流出趋势
2. 大单资金动向
3. 散户资金对比
4. 资金面强弱判断

请严格按以下JSON格式输出，不要有任何其他文字：

{"rating":"强势/中性/弱势","mainFlow":"流入/流出/持平","analysis":"分析结论","score":7}`
}

// 技术面分析 Prompt
export function buildTechnicalPrompt(technicalData: string): string {
  return `请分析以下技术指标数据：

${technicalData}

分析要点：
1. 均线系统：多头/空头/震荡
2. MACD：金叉/死叉/背离
3. KDJ：超买/超卖/金叉/死叉
4. RSI：强弱状态
5. 支撑/压力位

请严格按以下JSON格式输出，不要有任何其他文字：

{"rating":"强势/中性/弱势","trend":"多头/空头/震荡","macd":"金叉/死叉/背离","kdj":"超买/超卖/正常","support":100,"resistance":120,"analysis":"分析结论","score":7}`
}
