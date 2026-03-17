import { NextApiRequest, NextApiResponse } from 'next'
import { pool } from '@pages/api/database/database'
import logger from 'lib/logger'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify request is from Vercel Cron
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.error({ authHeader }, 'Unauthorized cron request')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  logger.info('Starting weekly card retirement job')

  try {
    // Fetch current season from Portal API
    const response = await fetch(
      'https://portal.pbe.simflow.io/api/isfl/v1/season'
    )
    if (!response.ok) {
      throw new Error(
        `Portal API returned ${response.status}: ${response.statusText}`
      )
    }

    const data = await response.json()
    const currentSeason: number = data.season

    if (!currentSeason || typeof currentSeason !== 'number') {
      throw new Error(`Unexpected season value from Portal API: ${JSON.stringify(data)}`)
    }

    const retireBefore = currentSeason - 14

    logger.info(
      { currentSeason, retireBefore },
      'Retiring cards from old seasons'
    )

    const result = await pool.query(
      `UPDATE pbe_cards
       SET pullable = false
       WHERE season <= $1
         AND sub_type != 'Hall of Fame'
         AND pullable = true`,
      [retireBefore]
    )

    logger.info(
      { currentSeason, retireBefore, rowsUpdated: result.rowCount },
      'Card retirement complete'
    )

    res.status(200).json({
      success: true,
      currentSeason,
      retiredCardsBeforeSeason: retireBefore,
      rowsUpdated: result.rowCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error({ err: error }, 'Card retirement job failed')
    res.status(500).json({ error: 'Card retirement failed' })
  }
}
