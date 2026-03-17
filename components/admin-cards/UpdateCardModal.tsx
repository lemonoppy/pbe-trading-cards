import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Alert,
  AlertIcon,
  Button,
  FormLabel,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useToast,
  FormControl,
  Input as ChakraInput,
} from '@chakra-ui/react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { mutation } from '@pages/api/database/mutation'
import { query } from '@pages/api/database/query'
import axios from 'axios'
import { PATCH, GET } from '@constants/http-methods'
import Input from '@components/forms/Input'
import Select from '@components/forms/Select'
import { rarityMap } from '@constants/rarity-map'
import positionMap from '@constants/position-map'
import { useQueryClient } from 'react-query'
import { errorToastOptions, successToastOptions } from '@utils/toast'
import { useDebounce } from 'use-debounce'
import { useSession } from 'contexts/AuthContext'

const updateValidationSchema = Yup.object({}).shape({
  cardid: Yup.number().integer().required('Card ID is required'),
  teamid: Yup.number().integer().required('Team ID is required'),
  playerid: Yup.number().integer().nullable().optional(),
  author_userid: Yup.number().integer().optional(),
  card_rarity: Yup.string().required('Rarity is required'),
  sub_type: Yup.string(),
  player_name: Yup.string().required('Player Name'),
  render_name: Yup.string().optional(),
  pullable: Yup.number()
    .integer()
    .min(0)
    .max(1)
    .required('Pullable is required'),
  event_pullable: Yup.number()
    .integer()
    .min(0)
    .max(1)
    .required('Event Pullable is required'),
  approved: Yup.number()
    .integer()
    .min(0)
    .max(1)
    .required('Approved is required'),
  image_url: Yup.string().optional(),
  position: Yup.string().required(),
  season: Yup.number().integer().min(1).optional(),
  author_paid: Yup.number()
    .integer()
    .min(0)
    .max(1)
    .required('Author Paid is required'),
  leagueid: Yup.number().integer().min(0).required('League is required'),
})

type UpdateFormValues = Yup.InferType<typeof updateValidationSchema>

export default function UpdateCardModal({
  card,
  isOpen,
  onClose,
}: {
  card: Card
  isOpen: boolean
  onClose: () => void
}) {
  const { session } = useSession()
  const [formError, setFormError] = useState<string>('')
  const [usernameSearch, setUsernameSearch] = useState<string>('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [debouncedUsername] = useDebounce(usernameSearch, 500)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const toast = useToast()

  const { mutateAsync: updateCard } = mutation<
    void,
    { cardID: number; card: Partial<Card> }
  >({
    mutationFn: ({ cardID, card }) =>
      axios({
        method: PATCH,
        url: `/api/v3/cards/${cardID}`,
        data: { card },
        headers: {
          Authorization: `Bearer ${session?.token}`,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['cards'])
      onClose()
    },
  })

  // Query Portal API for users matching username
  const { payload: matchingUsers } = query<{ uid: number; username: string }[]>({
    queryKey: ['userSearch', debouncedUsername],
    queryFn: () =>
      axios({
        method: GET,
        url: `${process.env.NEXT_PUBLIC_PORTAL_API_URL || 'https://portal.pbe.simflow.io'}/api/isfl/v1/userinfo`,
        params: { username: debouncedUsername?.length >= 3 ? debouncedUsername : '' },
      }),
    enabled: debouncedUsername?.length >= 3,
  })

  const userOptions = useMemo(() => {
    if (!matchingUsers || matchingUsers.length === 0) return []

    // Filter client-side by username (case-insensitive)
    const searchTerm = debouncedUsername?.toLowerCase() || ''
    return matchingUsers
      .filter((user) => user.username?.toLowerCase().includes(searchTerm))
      .map((user) => ({
        label: user.username,
        value: user.uid,
      }))
  }, [matchingUsers, debouncedUsername])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    isValid,
    handleSubmit,
  } = useFormik<UpdateFormValues>({
    enableReinitialize: true,
    validateOnBlur: true,
    validateOnChange: true,
    initialValues: {
      cardid: card.cardid ?? undefined,
      teamid: card.teamid ?? undefined,
      playerid: card.playerid ?? undefined,
      author_userid: card.author_userid ?? undefined,
      card_rarity: card.card_rarity ?? undefined,
      sub_type: card.sub_type ?? undefined,
      player_name: card.player_name ?? undefined,
      render_name: card.render_name ?? undefined,
      pullable: card.pullable ? 1 : 0,
      event_pullable: card.event_pullable ? 1 : 0,
      approved: card.approved ? 1 : 0,
      image_url: card.image_url ?? undefined,
      position: card.position ?? undefined,
      season: card.season ?? undefined,
      author_paid: card.author_paid ? 1 : 0,
      leagueid: card.leagueid ?? undefined,
    },
    onSubmit: async (cardUpdates, { setSubmitting }) => {
      try {
        await updateValidationSchema.validate(cardUpdates)
      } catch (error) {
        console.error(error)
        setFormError(String(error))
        return
      }

      try {
        setSubmitting(true)
        setFormError(null)

        // Ensure all fields are included, even if null
        const cardData = {
          ...cardUpdates,
          author_userid: cardUpdates.author_userid ?? null,
          image_url: cardUpdates.image_url ?? null,
          render_name: cardUpdates.render_name ?? null,
          sub_type: cardUpdates.sub_type ?? null,
        }

        console.log('Sending card update:', cardData)

        await updateCard({ cardID: card.cardid, card: cardData as unknown as Partial<Card> })
        toast({
          title: 'Sucessfully Updated Card',
          ...successToastOptions,
        })
      } catch (error) {
        console.error('Update error:', error)
        console.error('Error response:', error.response?.data)
        toast({
          title: 'Error Updating Card',
          ...errorToastOptions,
        })
        const errorMessage: string =
          error.response?.data?.message ||
          ('message' in error
            ? error.message
            : 'Error updating card, please message lemonoppy on Discord')
        setFormError(errorMessage)
      } finally {
        setSubmitting(false)
      }
    },
  })

  return (
    <Modal size="6xl" isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent className="!bg-primary !text-secondary">
        <ModalHeader fontSize="xx-large">
          Update Card #{card.cardid}
        </ModalHeader>
        <ModalCloseButton />
        {formError && (
          <Alert className="text-white" status="error">
            <AlertIcon />
            {formError}
          </Alert>
        )}
        <form onSubmit={handleSubmit}>
          <ModalBody className="flex flex-row">
            <Stack className="mx-2">
              <FormLabel fontSize="x-large">Player Data</FormLabel>
              <Input
                label="Player Name"
                value={values.player_name}
                disabled={isSubmitting}
                type="string"
                name="player_name"
                isInvalid={!!errors.player_name && touched.player_name}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <Input
                label="Render Name"
                value={values.render_name}
                disabled={isSubmitting}
                type="string"
                name="render_name"
                isInvalid={!!errors.render_name && touched.render_name}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <Input
                label="Player ID"
                value={values.playerid}
                disabled={isSubmitting}
                type="number"
                name="playerid"
                isInvalid={!!errors.playerid && touched.playerid}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <Input
                label="Team ID"
                value={values.teamid}
                disabled={isSubmitting}
                type="number"
                name="teamid"
                isInvalid={!!errors.teamid && touched.teamid}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <Select
                name="position"
                disabled={isSubmitting}
                value={values.position}
                label="Position"
                options={Object.values(positionMap).map((position) => ({
                  id: position.label,
                  name: position.label,
                }))}
                placeholder="Select Position"
                isInvalid={!!errors.position && touched.position}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <Input
                label="Season"
                value={values.season}
                disabled={isSubmitting}
                type="number"
                name="season"
                isInvalid={!!errors.season && touched.season}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <Select
                name="leagueid"
                disabled={isSubmitting}
                value={String(values.leagueid ?? '')}
                label="League"
                options={[
                  { id: '0', name: 'PBE' },
                  { id: '1', name: 'MiLPBE' },
                ]}
                placeholder="Select League"
                isInvalid={!!errors.leagueid && touched.leagueid}
                onChange={handleChange}
                onBlur={handleBlur}
              />
            </Stack>
            <Stack className="mx-2">
              <FormLabel fontSize="x-large">Card Data</FormLabel>
              <Input
                label="Card ID"
                value={values.cardid}
                disabled={true}
                type="number"
                name="cardid"
                isInvalid={!!errors.cardid && touched.cardid}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <FormControl className="relative">
                <FormLabel>Author (Search by Username)</FormLabel>
                <ChakraInput
                  ref={inputRef}
                  placeholder="Enter username to search"
                  value={usernameSearch}
                  disabled={isSubmitting}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setUsernameSearch(e.target.value)
                    setIsDropdownOpen(true)
                  }}
                />
                {isDropdownOpen && debouncedUsername?.length >= 3 && (
                  <div
                    ref={dropdownRef}
                    className="absolute flex flex-col justify-start items-start w-full bg-primary z-20 max-h-60 overflow-y-auto border border-gray-600"
                  >
                    {userOptions.length > 0 ? (
                      userOptions.map((option) => (
                        <Button
                          key={option.value}
                          className="w-full rounded-none flex justify-start items-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onClick={() => {
                            if (inputRef.current) {
                              inputRef.current.value = option.label
                            }
                            setUsernameSearch(option.label)
                            handleChange({ target: { name: 'author_userid', value: option.value } })
                            setIsDropdownOpen(false)
                            toast({
                              title: 'Author set',
                              description: `Set author to ${option.label}`,
                              status: 'success',
                              duration: 2000,
                            })
                          }}
                        >
                          {option.label}
                        </Button>
                      ))
                    ) : (
                      <div className="w-full p-2 text-gray-400">No users found</div>
                    )}
                  </div>
                )}
                {debouncedUsername?.length > 0 && debouncedUsername?.length < 3 && (
                  <Alert className="text-white mt-2" status="info" size="sm">
                    <AlertIcon />
                    At least three characters are required to search for a username
                  </Alert>
                )}
              </FormControl>
              <Input
                label="Author ID (Current)"
                value={values.author_userid}
                disabled={true}
                type="number"
                name="author_userid"
                isInvalid={false}
              />
              <Select
                name="card_rarity"
                disabled={isSubmitting}
                value={values.card_rarity}
                label="Rarity"
                options={Object.values(rarityMap).map((rarity) => ({
                  id: rarity.label,
                  name: rarity.label,
                }))}
                placeholder="Select Rarity"
                isInvalid={!!errors.card_rarity && touched.card_rarity}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <Input
                label="Sub Rarity"
                value={values.sub_type}
                disabled={isSubmitting}
                type="string"
                name="sub_type"
                isInvalid={!!errors.sub_type && touched.sub_type}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <Input
                label="Approved"
                value={values.approved}
                disabled={isSubmitting}
                type="number"
                name="approved"
                isInvalid={!!errors.approved && touched.approved}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <Input
                label="Pullable"
                value={values.pullable}
                disabled={isSubmitting}
                type="number"
                name="pullable"
                isInvalid={!!errors.pullable && touched.pullable}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <Input
                label="Event Pullable"
                value={values.event_pullable}
                disabled={isSubmitting}
                type="number"
                name="event_pullable"
                isInvalid={!!errors.event_pullable && touched.event_pullable}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <Input
                label="Author Paid"
                value={values.author_paid}
                disabled={isSubmitting}
                type="number"
                name="author_paid"
                isInvalid={!!errors.author_paid && touched.author_paid}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <Input
                disabled={true}
                label="Image URL"
                value={values.image_url}
                type="string"
                name="image_url"
                isInvalid={!!errors.image_url && touched.image_url}
                onChange={handleChange}
                onBlur={handleBlur}
              />
            </Stack>
            {card.image_url && (
              <Stack className="flex justify-center items-center">
                <Image
                  className={`cursor-pointer`}
                  src={card.image_url}
                  fallback={
                    <div className="relative z-10">
                      <Image src="/cardback.png" />
                      <div className="absolute top-0 left-0 w-full h-full bg-black opacity-50 z-20"></div>
                    </div>
                  }
                  alt={`${card.player_name} Card`}
                />
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={onClose}>
              Close
            </Button>
            <Button
              colorScheme="green"
              type="submit"
              disabled={!isValid || isSubmitting}
              isLoading={isSubmitting}
              loadingText="Submitting..."
            >
              Submit Update
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
