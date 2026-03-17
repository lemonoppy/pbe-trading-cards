import { put } from '@vercel/blob'
import { v4 as uuid } from 'uuid'

class ImageService {
  /**
   * Convert base64 string to data URI format
   * @param base64 - Base64 encoded image string
   * @returns Data URI string
   */
  base64ToString(base64: string): string {
    return base64.replace(/^data:image\/png;base64/, '')
  }

  /**
   * Upload image to Vercel Blob Storage
   * @param base64Image - Base64 encoded image (with or without data URI prefix)
   * @param filename - Optional filename (will generate UUID if not provided)
   * @returns Success status and image URL or error
   */
  async saveImage(
    base64Image: string,
    filename?: string
  ): Promise<{ success: boolean; error?: any; url?: string }> {
    try {
      // Generate filename if not provided
      const imageName = filename || this.generateFilename()

      // Convert base64 to Buffer
      const base64Data = base64Image.startsWith('data:')
        ? base64Image.split(',')[1] // Remove data URI prefix
        : base64Image

      const imageBuffer = Buffer.from(base64Data, 'base64')

      // Upload to Vercel Blob
      const blob = await put(`dotts-cards/${imageName}`, imageBuffer, {
        access: 'public',
        contentType: 'image/png',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })

      console.log('[ImageService] Upload successful:', blob.url)

      return {
        success: true,
        url: blob.url,
      }
    } catch (error) {
      console.error('[ImageService] Upload failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Generate a unique filename
   * @returns UUID-based filename
   */
  generateFilename(): string {
    return `${uuid()}.png`
  }
}

export const imageService = new ImageService()
