import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse } from '../..'
import middleware from '@pages/api/database/middleware'
import { DELETE, POST } from '@constants/http-methods'
import Cors from 'cors'
import { StatusCodes } from 'http-status-codes'
import { cardsQuery } from '@pages/api/database/database'
import SQL from 'sql-template-strings'
import methodNotAllowed from '../../lib/methodNotAllowed'
import { imageService } from 'services/imageService'

const allowedMethods: string[] = [DELETE, POST] as const
const cors = Cors({
  methods: allowedMethods,
})

// Increase body size limit for legacy base64 image uploads (default is 1mb)
// Note: Images are base64 encoded which increases size by ~33%
// New approach: Use imageUrl to provide direct URL to externally hosted images
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb', // Allow up to 15MB for base64-encoded image uploads (legacy)
    },
  },
}

export default async function imageEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<null | string>>
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === DELETE) {
    const cardID = req.query.cardID as string

    if (!cardID) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Please provide a cardID in your request',
      })
      return
    }

    const count = await cardsQuery<{ total: number }>(SQL`
      SELECT count(*) as total
      FROM pbe_cards
      WHERE cardid=${cardID}
    `)

    if ('error' in count) {
      console.error(count)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Server connection failed')
      return
    }

    if (count[0].total > 1) {
      console.error('Multiple cards with same id')
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Multiple cards with same id')
      return
    }

    if (count[0].total === 0) {
      console.error('Card not found')
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).end('Card not found')
      return
    }

    const queryResult = await cardsQuery(SQL`
      UPDATE pbe_cards
      SET image_url = NULL,
        approved = false,
        author_paid = false,
        pullable = false
      WHERE cardid=${parseInt(cardID)}
    `)

    if ('error' in queryResult) {
      console.error(queryResult)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Server connection failed')
      return
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: null,
    })
    return
  }

  if (req.method === POST) {
    const cardID = req.query.cardID as string
    const image = req.body.image as string // Base64 image (legacy)
    const imageUrl = req.body.imageUrl as string // Direct URL (new)

    if (!cardID || (!image && !imageUrl)) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Please provide a cardID and an image or imageUrl in your request',
      })
      return
    }

    const count = await cardsQuery<{ total: number }>(SQL`
      SELECT count(*) as total
      FROM pbe_cards
      WHERE cardid=${cardID}
    `)

    if ('error' in count) {
      console.error(count)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Server connection failed')
      return
    }

    if (count[0].total > 1) {
      console.error('Multiple cards with same id')
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Multiple cards with same id')
      return
    }

    if (count[0].total === 0) {
      console.error('Card not found')
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).end('Card not found')
      return
    }

    let url: string

    // If imageUrl is provided, use it directly
    if (imageUrl) {
      // Validate URL format
      try {
        const urlObj = new URL(imageUrl)
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          res.status(StatusCodes.BAD_REQUEST).json({
            status: 'error',
            message: 'Invalid URL protocol. Must be HTTP or HTTPS.',
          })
          return
        }
        url = imageUrl
      } catch (error) {
        res.status(StatusCodes.BAD_REQUEST).json({
          status: 'error',
          message: 'Invalid URL format',
        })
        return
      }
    } else {
      // Legacy base64 upload path
      const filename: string = imageService.generateFilename()
      const { success, error, url: uploadedUrl } = await imageService.saveImage(image, filename)

      if (!success) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          status: 'error',
          message: error || 'Failed to upload image',
        })
        return
      }
      url = uploadedUrl
    }

    const result = await cardsQuery(SQL`
      UPDATE pbe_cards
      SET image_url=${url}
      WHERE cardid=${cardID}
    `)

    if ('error' in result) {
      console.error(result)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Server connection failed')
      return
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: null,
    })
    return
  }

  methodNotAllowed(req, res, allowedMethods)
}
