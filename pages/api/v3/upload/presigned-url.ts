import { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

const S3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { filename, contentType } = req.body

    if (!filename || !contentType) {
      return res.status(400).json({ error: 'Missing filename or contentType' })
    }

    // Generate unique filename to avoid collisions
    const ext = filename.split('.').pop()
    const uniqueFilename = `${uuidv4()}.${ext}`

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: uniqueFilename,
      ContentType: contentType,
    })

    // Generate presigned URL valid for 5 minutes
    const presignedUrl = await getSignedUrl(S3, command, { expiresIn: 300 })

    // Construct the public URL where the image will be accessible
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${uniqueFilename}`

    res.status(200).json({
      presignedUrl,
      publicUrl,
      filename: uniqueFilename,
    })
  } catch (error) {
    console.error('Error generating presigned URL:', error)
    res.status(500).json({ error: 'Failed to generate presigned URL' })
  }
}
