import type { VercelRequest, VercelResponse } from '@vercel/node'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { command, args = [] } = req.body || {}

  if (!command) {
    return res.status(400).json({ success: false, error: 'Command is required' })
  }

  // 安全检查：只允许 westock 命令
  const allowedCommands = [
    'search', 'quote', 'kline', 'minute', 'finance', 'profile',
    'asfund', 'hkfund', 'usfund', 'technical', 'chip', 'shareholder',
    'dividend', 'etf', 'etf-holdings', 'etf-nav', 'etf-company',
    'etf-holders', 'etf-financial', 'lhb', 'blocktrade', 'margintrade',
    'hot', 'board', 'calendar', 'ipo', 'exdiv', 'reserve', 'suspension',
  ]

  if (!allowedCommands.includes(command)) {
    return res.status(400).json({ success: false, error: 'Invalid command' })
  }

  // 安全检查：参数只能包含字母、数字、逗号、点、连字符
  const safeArgs = args.filter((arg: string) => /^[\w,\.\-]+$/.test(arg))

  try {
    const cmd = `npx -y westock-data-clawhub@1.0.4 ${command} ${safeArgs.join(' ')}`
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 5, // 5MB
    })

    return res.status(200).json({
      success: true,
      output: stdout || stderr,
    })
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Command execution failed',
    })
  }
}
