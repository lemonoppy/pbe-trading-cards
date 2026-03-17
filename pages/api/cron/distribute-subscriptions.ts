import { NextApiRequest, NextApiResponse } from 'next'
import { pool } from '@pages/api/database/database'
import logger from 'lib/logger'
import { portalApi } from 'services/portalApiService'
import { packService } from 'services/packService'

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

  logger.info('Starting daily subscription distribution')

  try {
    // Load pack config from DB
    const packConfigRows = await pool.query(`
      SELECT packtype, daily_limit, subscription_enabled, price
      FROM pbe_pack_config
    `)
    const packConfig: Record<
      string,
      { daily_limit: number; subscription_enabled: boolean; price: number }
    > = {}
    for (const row of packConfigRows.rows) {
      packConfig[row.packtype] = {
        daily_limit: row.daily_limit,
        subscription_enabled: row.subscription_enabled,
        price: row.price,
      }
    }

    const baseEnabled = packConfig['base']?.subscription_enabled ?? false
    const rubyEnabled = packConfig['ruby']?.subscription_enabled ?? false
    const baseDailyLimit = packConfig['base']?.daily_limit ?? 3
    const rubyDailyLimit = packConfig['ruby']?.daily_limit ?? 1

    // 1. Get all users with subscriptions
    const users = await pool.query(`
      SELECT userid, subscription, rubysubscription
      FROM pbe_settings
      WHERE subscription > 0 OR rubysubscription > 0
    `)

    logger.info(
      { userCount: users.rowCount },
      'Found users with active subscriptions'
    )

    // 2. For each user, check today's purchases and distribute packs
    const results = await Promise.all(
      users.rows.map(async (user) => {
        try {
          // Get today's purchase count from VIEW
          const todayPacks = await pool.query(
            `SELECT base, ruby FROM pbe_pack_today WHERE userid = $1`,
            [user.userid]
          )

          const purchased = todayPacks.rows[0] || { base: 0, ruby: 0 }

          // Calculate how many packs to give (respecting limits and subscription_enabled)
          const basePacks = baseEnabled
            ? Math.max(
                0,
                Math.min(
                  user.subscription || 0,
                  baseDailyLimit - (purchased.base || 0)
                )
              )
            : 0

          const rubyPacks = rubyEnabled
            ? Math.max(
                0,
                Math.min(
                  user.rubysubscription || 0,
                  rubyDailyLimit - (purchased.ruby || 0)
                )
              )
            : 0

          // Calculate total cost and create bank transaction
          const baseCost = basePacks * (packConfig['base']?.price ?? packService.packs.base.price)
          const rubyCost = rubyPacks * (packConfig['ruby']?.price ?? packService.packs.ruby.price)
          const totalCost = baseCost + rubyCost

          if (totalCost > 0) {
            try {
              await portalApi.createBankTransaction({
                uid: user.userid,
                type: 'trading cards',
                groupName: 'Dotts Pack Purchase - Daily Subscription',
                description: `Daily subscription: ${basePacks} Base, ${rubyPacks} Ultimus`,
                amount: -totalCost, // Negative for deduction
                status: 'completed', // Mark as completed immediately
              })
              logger.info(
                { userid: user.userid, amount: totalCost },
                'Bank transaction successful'
              )
            } catch (error) {
              logger.error(
                { userid: user.userid, error, totalCost },
                'Failed to create bank transaction - skipping pack distribution for this user'
              )
              throw error // Re-throw to be caught by outer catch
            }
          }

          // Insert packs
          const promises = []

          for (let i = 0; i < basePacks; i++) {
            promises.push(
              pool.query(
                `INSERT INTO pbe_packs_owned (userid, packtype, source)
                 VALUES ($1, 'base', 'Daily Subscription')`,
                [user.userid]
              )
            )
          }

          for (let i = 0; i < rubyPacks; i++) {
            promises.push(
              pool.query(
                `INSERT INTO pbe_packs_owned (userid, packtype, source)
                 VALUES ($1, 'ruby', 'Daily Subscription')`,
                [user.userid]
              )
            )
          }

          await Promise.all(promises)

          logger.info(
            {
              userid: user.userid,
              basePacks,
              rubyPacks,
              alreadyPurchased: purchased,
            },
            'Distributed packs to user'
          )

          return {
            userid: user.userid,
            basePacks,
            rubyPacks,
            success: true,
          }
        } catch (error) {
          logger.error(
            { userid: user.userid, error },
            'Failed to distribute packs to user'
          )
          return {
            userid: user.userid,
            basePacks: 0,
            rubyPacks: 0,
            success: false,
            error: error.message,
          }
        }
      })
    )

    const totalBase = results.reduce((sum, r) => sum + r.basePacks, 0)
    const totalRuby = results.reduce((sum, r) => sum + r.rubyPacks, 0)
    const failed = results.filter((r) => !r.success).length

    logger.info(
      {
        usersProcessed: results.length,
        totalBase,
        totalRuby,
        failed,
      },
      'Subscription distribution complete'
    )

    res.status(200).json({
      success: true,
      usersProcessed: results.length,
      packsDistributed: {
        base: totalBase,
        ruby: totalRuby,
      },
      failed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error({ err: error }, 'Subscription distribution error')
    res.status(500).json({ error: 'Distribution failed' })
  }
}
