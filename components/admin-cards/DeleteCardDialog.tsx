import React, { useRef, useState } from 'react'
import {
  Alert,
  AlertDialog,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertIcon,
  Button,
} from '@chakra-ui/react'
import { mutation } from '@pages/api/database/mutation'
import axios from 'axios'
import { DELETE } from '@constants/http-methods'
import { useFormik } from 'formik'
import { useQueryClient } from 'react-query'
import { useSession } from 'contexts/AuthContext'

export default function DeleteCardDialog({
  card,
  isOpen,
  onClose,
}: {
  card: Card
  isOpen: boolean
  onClose: () => void
}) {
  const [formError, onFormError] = useState<string>(null)
  const cancelRef = useRef(null)
  const queryClient = useQueryClient()
  const { session } = useSession()
  const { mutateAsync: deleteCard } = mutation<void, { cardID: number }>({
    mutationFn: ({ cardID }) =>
      axios({
        method: DELETE,
        url: `/api/v3/cards/${cardID}`,
        headers: {
          Authorization: `Bearer ${session?.token}`,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['cards'])
      onClose()
    },
  })

  const { isSubmitting, isValid, handleSubmit } = useFormik({
    initialValues: {},
    onSubmit: async ({}, { setSubmitting }) => {
      try {
        setSubmitting(true)
        onFormError(null)
        await deleteCard({ cardID: card.cardid })
      } catch (error) {
        console.error(error)
        const errorMessage: string =
          'message' in error
            ? error.message
            : 'Error submitting, please message lemonoppy on Discord'
        onFormError(errorMessage)
      } finally {
        setSubmitting(false)
      }
    },
  })

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader
            className="bg-primary text-secondary"
            fontSize="lg"
            fontWeight="bold"
          >
            Delete Card #{card.cardid}
          </AlertDialogHeader>
          <AlertDialogCloseButton />
          <AlertDialogBody className="bg-primary text-secondary">
            Are you sure? You can't undo this action afterwards.
            {formError && (
              <Alert className="text-white mt-4" status="error">
                <AlertIcon /> {formError}
              </Alert>
            )}
          </AlertDialogBody>
          <AlertDialogFooter className="bg-primary text-secondary">
            <Button ref={cancelRef} onClick={onClose}>
              Cancel
            </Button>
            <form onSubmit={handleSubmit}>
              <Button
                disabled={!isValid || isSubmitting}
                colorScheme="red"
                type="submit"
                ml={3}
              >
                Delete Card
              </Button>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}
