import { NextApiRequest, NextApiResponse } from 'next'
import { pool } from '@pages/api/database/database'
import { portalApi } from 'services/portalApiService'
import { packService } from 'services/packService'

const DAILY_LIMITS = {
  base: 3,
  ruby: 1,
}

// TEST ENDPOINT - Same logic as cron but without auth check for local testing
// DO NOT deploy this to production without proper authentication!
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('🧪 TEST: Starting subscription distribution')

  try {
    // 1. Get all users with subscriptions
    const users = await pool.query(`
      SELECT userid, subscription, rubysubscription
      FROM pbe_settings
      WHERE subscription > 0 OR rubysubscription > 0
    `)

    console.log(`Found ${users.rowCount} users with active subscriptions`)

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

          console.log(
            `User ${user.userid}: subscription=${user.subscription}, ruby=${user.rubysubscription}, already purchased: base=${purchased.base}, ruby=${purchased.ruby}`
          )

          // Calculate how many packs to give (respecting limits)
          const basePacks = Math.max(
            0,
            Math.min(
              user.subscription || 0,
              DAILY_LIMITS.base - (purchased.base || 0)
            )
          )

          const rubyPacks = Math.max(
            0,
            Math.min(
              user.rubysubscription || 0,
              DAILY_LIMITS.ruby - (purchased.ruby || 0)
            )
          )

          console.log(
            `  → Will distribute: ${basePacks} base packs, ${rubyPacks} ultimus packs`
          )

          // Calculate total cost and create bank transaction
          const baseCost = basePacks * packService.packs.base.price
          const rubyCost = rubyPacks * packService.packs.ruby.price
          const totalCost = baseCost + rubyCost

          console.log(
            `  → Total cost: $${totalCost.toLocaleString()} (Base: $${baseCost.toLocaleString()}, Ultimus: $${rubyCost.toLocaleString()})`
          )

          if (totalCost > 0) {
            await portalApi.createBankTransaction({
              uid: user.userid,
              type: 'trading cards',
              groupName: 'Dotts Pack Purchase (Pack Fairy 🧚)',
              description: `Daily subscription: ${basePacks} Base, ${rubyPacks} Ultimus`,
              amount: -totalCost, // Negative for deduction
              status: 'completed', // Mark as completed immediately
            })
            console.log('  ✅ Bank transaction created and marked completed')
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

          return {
            userid: user.userid,
            basePacks,
            rubyPacks,
            success: true,
          }
        } catch (error) {
          console.error(`Failed to distribute to user ${user.userid}:`, error)
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

    console.log('\n✅ Distribution complete!')
    console.log(`  Users processed: ${results.length}`)
    console.log(`  Base packs distributed: ${totalBase}`)
    console.log(`  Ultimus packs distributed: ${totalRuby}`)
    console.log(`  Failed: ${failed}`)

    res.status(200).json({
      success: true,
      usersProcessed: results.length,
      packsDistributed: {
        base: totalBase,
        ruby: totalRuby,
      },
      failed,
      results, // Include detailed results for debugging
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Subscription distribution error:', error)
    res.status(500).json({ error: 'Distribution failed', details: error.message })
  }
}
