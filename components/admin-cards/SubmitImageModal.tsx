import {
  Alert,
  AlertIcon,
  Button,
  Input,
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  useToast,
} from '@chakra-ui/react'
import { POST } from '@constants/http-methods'
import { mutation } from '@pages/api/database/mutation'
import { warningToastOptions } from '@utils/toast'
import axios from 'axios'
import { useState } from 'react'
import { errorToastOptions, successToastOptions } from '@utils/toast'
import { CardInfo } from '@components/common/CardInfo'
import { useQueryClient } from 'react-query'

export default function SubmitImageModal({
  card,
  isOpen,
  onClose,
}: {
  card: Card
  isOpen: boolean
  onClose: () => void
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string>('')
  const [imageUrl, setImageUrl] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { mutateAsync: submitCardImage, isLoading } = mutation({
    mutationFn: () =>
      axios({
        method: POST,
        url: `/api/v3/cards/${card.cardid}/image`,
        data: { imageUrl },
      }),
    onSuccess: () => {
      // Invalidate queries to refresh the cards list
      queryClient.invalidateQueries('cards')
      queryClient.invalidateQueries(['card', card.cardid])

      toast({
        title: 'Successfully Updated Card Image URL',
        ...successToastOptions,
      })
    },
  })

  const validateAndPreviewUrl = (url: string) => {
    setImageUrl(url)
    setFormError('') // Clear any previous errors

    // Basic URL validation
    if (!url) {
      setPreviewUrl('')
      return
    }

    try {
      const urlObj = new URL(url)
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setFormError('Please enter a valid HTTP or HTTPS URL')
        setPreviewUrl('')
        return
      }

      // Set preview URL if valid
      setPreviewUrl(url)
    } catch (error) {
      setFormError('Please enter a valid URL')
      setPreviewUrl('')
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFormError('')
    setIsUploading(true)
    setSelectedFile(file)

    try {
      // Step 1: Get presigned URL from API
      const presignedResponse = await axios.post('/api/v3/upload/presigned-url', {
        filename: file.name,
        contentType: file.type,
      })

      const { presignedUrl, publicUrl } = presignedResponse.data
      console.log('Presigned URL API response:', { presignedUrl, publicUrl })

      // Step 2: Upload file directly to R2
      await axios.put(presignedUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
      })

      // Step 3: Set the public URL for preview and saving
      console.log('Setting imageUrl and previewUrl to:', publicUrl)
      setImageUrl(publicUrl)
      setPreviewUrl(publicUrl)

      toast({
        title: 'Image Uploaded',
        description: 'Image uploaded successfully to cloud storage',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Error uploading image:', error)
      setFormError('Failed to upload image. Please try again.')
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload image. Please try again.',
        ...errorToastOptions,
      })
      setSelectedFile(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (isLoading) {
      toast({ title: 'Already submitting a card', ...warningToastOptions })
      return
    }

    if (!imageUrl) {
      toast({
        title: 'No Image URL',
        description: 'Please enter an image URL',
        ...warningToastOptions,
      })
      return
    }

    try {
      await submitCardImage({ cardID: card.cardid, imageUrl })
      setImageUrl('')
      setPreviewUrl('')
      setSelectedFile(null)
      onClose()
    } catch (error) {
      console.error(error)

      const errorMessage: string =
        'message' in error
          ? error.message
          : 'Error updating card, please message lemonoppy on Discord'

      toast({
        title: 'Error Updating Card',
        description: errorMessage,
        ...errorToastOptions,
      })
      setFormError(errorMessage)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent className="!bg-primary">
        <ModalHeader className="!bg-primary !text-secondary">
          Submit Image for #{card.cardid} - {card.player_name}
        </ModalHeader>
        <ModalCloseButton />
        <div className="flex flex-col !bg-primary !text-secondary p-6">
          {formError && (
            <Alert className="text-white mb-4" status="error">
              <AlertIcon />
              {formError}
            </Alert>
          )}
          <div className="flex flex-col items-center gap-4">
            {previewUrl && (
              <div className="flex justify-center items-center w-full">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full h-auto"
                  onError={() => {
                    setFormError('Failed to load image. Please check the URL.')
                    setPreviewUrl('')
                  }}
                />
              </div>
            )}
            <div className="w-full space-y-4">
              {/* File Upload Option */}
              <div>
                <label className="block mb-2">
                  Upload Image File
                  {isUploading && (
                    <span className="ml-2 text-sm text-yellow-400">
                      (Uploading...)
                    </span>
                  )}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={isLoading || isUploading}
                  className="w-full"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Select an image from your computer (unlimited size)
                </p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-gray-600"></div>
                <span className="text-xs text-gray-400">OR</span>
                <div className="flex-1 border-t border-gray-600"></div>
              </div>

              {/* URL Input Option */}
              <div>
                <label className="block mb-2">Paste Image URL</label>
                <Input
                  disabled={isLoading || isUploading}
                  type="url"
                  value={imageUrl}
                  onChange={(e) => validateAndPreviewUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Or paste a URL from external storage (S3, Postimages, etc.)
                </p>
              </div>
            </div>
            <CardInfo card={card} />
          </div>
          <div className="flex items-center justify-end gap-2 mt-6">
            <Button
              disabled={isLoading}
              colorScheme="red"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              disabled={isLoading || isUploading || !imageUrl}
              colorScheme="green"
              onClick={handleSubmit}
            >
              {isUploading ? 'Uploading...' : 'Save Image'}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  )
}
