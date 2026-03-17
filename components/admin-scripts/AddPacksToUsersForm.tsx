import {
  Button,
  FormControl,
  FormLabel,
  Input,
  useToast,
} from '@chakra-ui/react'
import { POST } from '@constants/http-methods'
import { mutation } from '@pages/api/database/mutation'
import { successToastOptions, warningToastOptions } from '@utils/toast'
import axios from 'axios'
import { useFormik } from 'formik'
import { Fragment, useState } from 'react'
import * as Yup from 'yup'
import { useSession } from 'contexts/AuthContext'
import SimpleUserAutocomplete from '@components/forms/SimpleUserAutocomplete'

const addPacksValidationSchema = Yup.object({}).shape({
  userId: Yup.number().integer().required('User ID is required'),
  username: Yup.string().optional(),
  basePacks: Yup.number().integer().min(0).required('Base packs is required'),
  rubyPacks: Yup.number().integer().min(0).required('Ruby packs is required'),
  retroPacks: Yup.number().integer().min(0).required('Throwback packs is required'),
  eventPacks: Yup.number().integer().min(0).required('Event packs is required'),
})

type AddPacksValues = Yup.InferType<typeof addPacksValidationSchema>

type PacksToIssue = {
  userId: number
  basePacks: number
  rubyPacks: number
  retroPacks: number
  eventPacks: number
}

export default function AddPacksToUsersForm({
  onError,
}: {
  onError: (errorMessage: string | null) => void
}) {
  const [packsToAdd, setPacksToAdd] = useState<PacksToIssue[]>([])
  const toast = useToast()
  const { session } = useSession()

  const { mutateAsync: issuePacksToUsers, isLoading: issuePacksIsLoading } =
    mutation<{ packIds: number[] }, { packsToIssue: PacksToIssue[] }>({
      mutationFn: (packsToIssue: { packsToIssue: PacksToIssue[] }) =>
        axios({
          method: POST,
          url: '/api/v3/packs/issue-packs',
          data: packsToIssue,
          headers: {
            Authorization: `Bearer ${session?.token}`,
          },
        }),
      onSuccess: () => {
        toast({ title: 'Packs issued successfully', ...successToastOptions })
        setPacksToAdd([])
      },
    })

  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    isValid,
    handleSubmit,
    setFieldValue,
  } = useFormik<AddPacksValues>({
    validateOnBlur: true,
    validateOnChange: true,
    initialValues: {
      userId: 0,
      username: '',
      basePacks: 0,
      rubyPacks: 0,
      retroPacks: 0,
      eventPacks: 0,
    },
    onSubmit: async (
      { userId, basePacks, rubyPacks, retroPacks, eventPacks }: AddPacksValues,
      { setSubmitting, resetForm }
    ) => {
      try {
        setSubmitting(true)
        onError(null)
        if (userId === 0) throw new Error('0 is not a valid User ID')
        if (basePacks === 0 && rubyPacks === 0 && retroPacks === 0 && eventPacks === 0) {
          throw new Error('Must add at least one pack')
        }

        setPacksToAdd((oldState) => [
          ...oldState,
          { userId, basePacks, rubyPacks, retroPacks, eventPacks },
        ])

        resetForm()
      } catch (error) {
        console.error(error)
        const errorMessage: string =
          'message' in error
            ? error.message
            : 'Error submitting, please message lemonoppy on Discord'
        onError(errorMessage)
      } finally {
        setSubmitting(false)
      }
    },
    validationSchema: addPacksValidationSchema,
  })

  const deletePackEntry = (index: number) => {
    setPacksToAdd((currentState) =>
      currentState.filter((_, i) => i !== index)
    )
  }

  const handleSubmitPacksIssue = () => {
    if (packsToAdd.length === 0) {
      toast({
        title: 'Invalid Data',
        description: 'Please include at least one user in your request',
        ...warningToastOptions,
      })
      return
    }
    issuePacksToUsers({ packsToIssue: packsToAdd })
  }

  const handleUserSelect = (userId: string, username: string) => {
    setFieldValue('userId', parseInt(userId, 10))
    setFieldValue('username', username)
  }

  return (
    <div>
      <div className="flex justify-end items-center">
        <Button
          onClick={handleSubmitPacksIssue}
          disabled={!isValid || isSubmitting || issuePacksIsLoading}
          type="button"
          className="mt-4 mx-1"
          isLoading={isSubmitting || issuePacksIsLoading}
          loadingText="Submitting..."
        >
          Issue Packs to Users
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <SimpleUserAutocomplete
          label="Search User"
          onSelect={handleUserSelect}
        />

        <FormControl
          isInvalid={!!errors.userId && touched.userId}
          className="mt-4"
        >
          <FormLabel>User ID</FormLabel>
          <Input
            value={values.userId || ''}
            disabled={isSubmitting || issuePacksIsLoading}
            type="number"
            isRequired={true}
            onBlur={handleBlur}
            onChange={handleChange}
            onFocus={(event) => event.target.select()}
            name="userId"
            placeholder="Enter user ID or search above"
            className="font-mont"
          />
        </FormControl>

        <FormControl
          isInvalid={!!errors.basePacks && touched.basePacks}
          className="mt-4"
        >
          <FormLabel>Base Packs</FormLabel>
          <Input
            value={values.basePacks}
            disabled={isSubmitting || issuePacksIsLoading}
            type="number"
            isRequired={true}
            onBlur={handleBlur}
            onChange={handleChange}
            onFocus={(event) => event.target.select()}
            name="basePacks"
            className="font-mont"
          />
        </FormControl>

        <FormControl
          isInvalid={!!errors.rubyPacks && touched.rubyPacks}
          className="mt-4"
        >
          <FormLabel>Ruby (Ultimus) Packs</FormLabel>
          <Input
            value={values.rubyPacks}
            disabled={isSubmitting || issuePacksIsLoading}
            type="number"
            isRequired={true}
            onBlur={handleBlur}
            onChange={handleChange}
            onFocus={(event) => event.target.select()}
            name="rubyPacks"
            className="font-mont"
          />
        </FormControl>

        <FormControl
          isInvalid={!!errors.retroPacks && touched.retroPacks}
          className="mt-4"
        >
          <FormLabel>Retro Packs</FormLabel>
          <Input
            value={values.retroPacks}
            disabled={isSubmitting || issuePacksIsLoading}
            type="number"
            isRequired={true}
            onBlur={handleBlur}
            onChange={handleChange}
            onFocus={(event) => event.target.select()}
            name="retroPacks"
            className="font-mont"
          />
        </FormControl>

        <FormControl
          isInvalid={!!errors.eventPacks && touched.eventPacks}
          className="mt-4"
        >
          <FormLabel>Event Packs</FormLabel>
          <Input
            value={values.eventPacks}
            disabled={isSubmitting || issuePacksIsLoading}
            type="number"
            isRequired={true}
            onBlur={handleBlur}
            onChange={handleChange}
            onFocus={(event) => event.target.select()}
            name="eventPacks"
            className="font-mont"
          />
        </FormControl>

        <Button
          disabled={!isValid || isSubmitting || issuePacksIsLoading}
          type="submit"
          className="mt-6 mx-1"
          isLoading={isSubmitting || issuePacksIsLoading}
        >
          Add to Queue
        </Button>
      </form>

      <div className="mt-8">
        {packsToAdd.length > 0 && (
          <>
            <h3 className="text-lg font-bold mb-4">Packs to Issue:</h3>
            {packsToAdd.map((pack, index) => (
              <div
                key={index}
                className="mb-4 p-4 border border-grey100 rounded"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p>
                      <strong>User ID:</strong> {pack.userId}
                    </p>
                    <p>
                      <strong>Base Packs:</strong> {pack.basePacks}
                    </p>
                    <p>
                      <strong>Ruby Packs:</strong> {pack.rubyPacks}
                    </p>
                    <p>
                      <strong>Retro Packs:</strong> {pack.retroPacks}
                    </p>
                    <p>
                      <strong>Event Packs:</strong> {pack.eventPacks}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    colorScheme="red"
                    onClick={() => deletePackEntry(index)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
