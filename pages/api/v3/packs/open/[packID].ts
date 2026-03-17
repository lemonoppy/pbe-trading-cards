import { NextApiRequest, NextApiResponse } from 'next'
import { cardsQuery } from '@pages/api/database/database'
import { POST } from '@constants/http-methods'
import { rarityMapRuby, rarityMap, Rarity } from '@constants/rarity-map'
import { StatusCodes } from 'http-status-codes'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import SQL from 'sql-template-strings'
import assertBoom from '@pages/api/lib/assertBoom'
import { packService } from 'services/packService'
import { checkUserAuthorization } from '../../lib/checkUserAuthorization'
import { rateLimit } from 'lib/rateLimit'

const allowedMethods = []
const cors = Cors({
  methods: allowedMethods,
})

const randomIntFromInterval = (maximum: number): number => {
  const minimum = 0
  const num = Math.floor(Math.random() * maximum - minimum + 1) + minimum
  return num
}

const getBasePackRarity = (): string => {
  const num: number = randomIntFromInterval(10000)
  const rarities: Rarity[] = Object.values(rarityMap)

  let counter = 0
  const foundRarityRecord = rarities.find((rarity, index) => {
    if (num > counter && num <= counter + rarity.rarity) {
      return true
    }

    counter += rarity.rarity
    return false
  })

  return foundRarityRecord.label
}

const pullBaseCards = async (): Promise<{ cardID: string }[]> => {
  let pulledCards: { cardID: string }[] = []
  for (let i = 0; i < 6; i++) {
    const rarity: string = getBasePackRarity()

    const cardResult = await cardsQuery(
      SQL`
        SELECT cardID as "cardID"
        FROM pbe_cards
        WHERE card_rarity=${rarity}
          AND approved=true
          AND pullable=true
          AND sub_type !='Unique'
        ORDER BY RANDOM()
        LIMIT 1;`
    )

    if (cardResult) {
      pulledCards.push(cardResult[0])
    } else {
      throw new Error('No card found or query failed.')
    }
  }

  return pulledCards
}

const getRubyPlusPackRarity = (): string => {
  const num: number = randomIntFromInterval(10000)
  const rarities: Rarity[] = Object.values(rarityMapRuby)

  let counter = 0
  const foundRarityRecord = rarities.find((rarity, index) => {
    if (num > counter && num <= counter + rarity.rarity) {
      return true
    }

    counter += rarity.rarity
    return false
  })

  return foundRarityRecord.label
}

const pullRubyPlusCards = async (): Promise<{ cardID: string }[]> => {
  let pulledCards: { cardID: string }[] = []

  // Pull 6 cards using Ultimus pack weight distribution (better rare card odds)
  for (let i = 0; i < 6; i++) {
    const rarity: string = getRubyPlusPackRarity()

    const cardResult = await cardsQuery(
      SQL`
        SELECT cardID as "cardID"
        FROM pbe_cards
        WHERE card_rarity=${rarity}
          AND approved=true
          AND pullable=true
          AND sub_type !='Unique'
        ORDER BY RANDOM()
        LIMIT 1;`
    )

    if (cardResult && cardResult[0]) {
      pulledCards.push(cardResult[0])
    } else {
      throw new Error(`No ${rarity} card found or query failed.`)
    }
  }

  return pulledCards
}

const pullThrowbackCards = async (): Promise<{ cardID: string }[]> => {
  let pulledCards: { cardID: string }[] = []

  // Pull 6 cards from non-pullable legacy cards using Ultimus pack weights
  for (let i = 0; i < 6; i++) {
    const rarity: string = getRubyPlusPackRarity()

    const cardResult = await cardsQuery(
      SQL`
        SELECT cardID as "cardID"
        FROM pbe_cards
        WHERE card_rarity=${rarity}
          AND approved=true
          AND (pullable=false OR sub_type='Hall of Fame')
          AND sub_type !='Unique'
        ORDER BY RANDOM()
        LIMIT 1;`
    )

    if (cardResult && cardResult[0]) {
      pulledCards.push(cardResult[0])
    } else {
      throw new Error(`No ${rarity} non-pullable card found or query failed.`)
    }
  }

  return pulledCards
}

const pullEventCards = async (): Promise<{ cardID: string }[]> => {
  let pulledCards: { cardID: string }[] = []

  // Pull 6 cards using Ultimus pack weight distribution
  for (let i = 0; i < 6; i++) {
    const rarity: string = getRubyPlusPackRarity()

    const cardResult = await cardsQuery(
      SQL`
        SELECT cardID as "cardID"
        FROM pbe_cards
        WHERE card_rarity=${rarity}
          AND approved=true
          AND pullable=true
          AND event_pullable=true
          AND sub_type !='Unique'
        ORDER BY RANDOM()
        LIMIT 1;`
    )

    if (cardResult && cardResult[0]) {
      pulledCards.push(cardResult[0])
    } else {
      throw new Error(`No ${rarity} card found or query failed.`)
    }
  }

  return pulledCards
}

const handler = async (
  request: NextApiRequest,
  response: NextApiResponse
): Promise<void> => {
  await middleware(request, response, cors)
  const { method, query } = request

  if (method === POST) {
    if (!(await checkUserAuthorization(request))) {
      response.status(StatusCodes.UNAUTHORIZED).end('Not authorized')
      return
    }
    const { packID } = query

    const missingPackId: boolean = assertBoom(
      !!packID,
      response,
      'Missing Pack ID',
      StatusCodes.BAD_REQUEST
    )
    if (missingPackId) return

    const packResult = await cardsQuery<PackData>(
      SQL`
      SELECT packID as "packID",
        userID as "userID",
        packType as "packType",
        opened,
        purchaseDate as "purchaseDate",
        openDate as "openDate"
      FROM pbe_packs_owned
      WHERE packID=${packID};`
    )

    if ('error' in packResult) {
      console.error('Pack query error:', packResult.error)
      response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Database query failed',
      })
      return
    }

    if (!packResult || packResult.length === 0) {
      response.status(StatusCodes.NOT_FOUND).json({
        error: 'Pack not found',
      })
      return
    }

    const pack: PackData = packResult[0]

    const packAlreadyOpened: boolean = assertBoom(
      !Boolean(pack.opened),
      response,
      'Pack Already Opened',
      StatusCodes.BAD_REQUEST
    )
    if (packAlreadyOpened) return

    let pulledCards: { cardID: string }[] = []

    if (pack.packType === packService.packs.base.id) {
      pulledCards = await pullBaseCards()
    } else if (pack.packType === packService.packs.ruby.id) {
      pulledCards = await pullRubyPlusCards()
    } else if (pack.packType === packService.packs.throwback.id) {
      pulledCards = await pullThrowbackCards()
    } else if (pack.packType === packService.packs.event.id) {
      pulledCards = await pullEventCards()
    } else {
      response.status(StatusCodes.BAD_REQUEST).json({
        error: `Invalid pack type ${pack.packType}`,
      })
      return
    }

    if (pulledCards.length > 6) {
      response.status(StatusCodes.BAD_REQUEST).json({
        error: `Pack can only hold 6 cards`,
      })
      return
    }

    // Insert all pulled cards into collection (wait for all to complete)
    const insertResults = await Promise.all(
      pulledCards.map(async (pulledCard) => {
        return cardsQuery(
          SQL`
          INSERT INTO pbe_collection
            (userID, cardID, packID)
          VALUES
            (${pack.userID}, ${pulledCard.cardID}, ${packID});`
        )
      })
    )

    // Check if any insertions failed
    const hasErrors = insertResults.some((result) => result && 'error' in result)
    if (hasErrors) {
      console.error('Failed to insert cards into collection:', insertResults)
      response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to add cards to collection',
      })
      return
    }

    // Mark pack as opened
    const updateResult = await cardsQuery(
      SQL`
      UPDATE pbe_packs_owned
      SET opened=true, openDate=CURRENT_TIMESTAMP
      WHERE packID=${packID};`
    )

    if ('error' in updateResult) {
      console.error('Failed to mark pack as opened:', updateResult.error)
      response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to mark pack as opened',
      })
      return
    }

    response.status(StatusCodes.OK).json({ openingSuccessful: true })
    return
  }

  response.setHeader('Allowed', allowedMethods)
  response.status(StatusCodes.METHOD_NOT_ALLOWED).end()
}

export default rateLimit(handler)
