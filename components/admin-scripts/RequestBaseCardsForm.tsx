import { DownloadIcon } from '@chakra-ui/icons'
import {
  Button,
  FormControl,
  FormLabel,
  Input,
} from '@chakra-ui/react'
import { POST } from '@constants/http-methods'
import { mutation } from '@pages/api/database/mutation'
import { BaseRequest } from '@pages/api/v3/cards/base-requests'
import axios from 'axios'
import { useFormik } from 'formik'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as Yup from 'yup'
import BaseRequestResultsTable from './BaseRequestResultsTable'

type DraftClassCsvRow = {
  team: string
  playerid: number
  season: number
  card_rarity: string
  sub_type: string
  player_name: string
  render_name: string | null
  position: string
  image_url: string
  author_userid: string
}

const requestCardsValidationSchema = Yup.object({}).shape({
  season: Yup.number().integer().required('Season number is required'),
})

type RequestBaseCardsValues = Yup.InferType<typeof requestCardsValidationSchema>

export default function RequestBaseCardsForm({
  onError,
}: {
  onError: (errorMessage) => void
}) {
  const router = useRouter()
  const [created, setCreated] = useState<BaseRequest[]>(null)
  const [duplicates, setDuplicates] = useState<BaseRequest[]>(null)
  const [errors, setErrors] = useState<BaseRequest[]>(null)
  const [hasInvalidSeason, setHasInvalidSeason] = useState<BaseRequest[]>(null)
  const [draftClassCsv, setDraftClassCsv] = useState<DraftClassCsvRow[]>(null)

  const handleDownloadDraftClassCsv = () => {
    if (!draftClassCsv?.length) return

    const headers = [
      'team', 'playerid', 'season', 'card_rarity', 'sub_type',
      'player_name', 'render_name', 'position', 'image_url', 'author_userid'
    ]
    const rows = draftClassCsv.map((row) =>
      [
        row.team,
        row.playerid,
        row.season,
        row.card_rarity,
        row.sub_type,
        row.player_name,
        row.render_name || '',
        row.position,
        row.image_url || '',
        row.author_userid || ''
      ].join(',')
    )
    const csvString = [headers.join(','), ...rows].join('\n')

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `draft-class-base-cards-s${draftClassCsv[0]?.season || 'unknown'}-${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const { mutateAsync: requestBaseCards } = mutation<void, { season: number }>({
    mutationFn: async ({ season }: { season: number }) => {
      const response = await axios({
        method: POST,
        url: '/api/v3/cards/base-requests',
        data: { season },
      })

      if (response.data.payload) {
        setCreated(response.data.payload.created)
        setDuplicates(response.data.payload.duplicates)
        setErrors(response.data.payload.errors)
        setHasInvalidSeason(response.data.payload.hasInvalidSeason)
        setDraftClassCsv(response.data.payload.draftClassCsv)
      }
    },
  })

  const { isSubmitting, handleChange, handleBlur, isValid, handleSubmit } =
    useFormik<RequestBaseCardsValues>({
      validateOnBlur: true,
      validateOnChange: true,
      initialValues: {
        season: 0,
      },
      onSubmit: async ({ season }, { setSubmitting }) => {
        try {
          setSubmitting(true)
          onError(null)
          await requestBaseCards({ season })
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
      validationSchema: requestCardsValidationSchema,
    })

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="flex justify-end items-center">
          <Button
            disabled={
              !isValid ||
              isSubmitting || // disable this in dev
              router.pathname.includes('localhost') ||
              router.pathname.includes('cardsdev')
            }
            type="submit"
            className="mt-4 mx-1"
            isLoading={isSubmitting}
            loadingText="Submitting..."
          >
            Request Draft Class
          </Button>
        </div>

        <FormControl>
          <FormLabel>Season</FormLabel>
          <Input
            type="number"
            isRequired={true}
            disabled={isSubmitting}
            onChange={handleChange}
            onBlur={handleBlur}
            name="season"
            className="font-mont"
          />
        </FormControl>
      </form>
      <div className="flex flex-col">
        {draftClassCsv && (
          <Button
            leftIcon={<DownloadIcon />}
            mt={2}
            onClick={handleDownloadDraftClassCsv}
            colorScheme="blue"
          >
            Download Base Cards CSV (for import)
          </Button>
        )}
        {created && created.length > 0 && (
          <BaseRequestResultsTable
            data={created}
            title="Created"
            showError={false}
          />
        )}
        {hasInvalidSeason && hasInvalidSeason.length > 0 && (
          <BaseRequestResultsTable
            data={hasInvalidSeason}
            title="Created but Invalid Season"
            showError={false}
          />
        )}
        {duplicates && duplicates.length > 0 && (
          <BaseRequestResultsTable
            data={duplicates}
            title="Duplicates"
            showError={true}
          />
        )}
        {errors && errors.length > 0 && (
          <BaseRequestResultsTable
            data={errors}
            title="Errors"
            showError={true}
          />
        )}
      </div>
    </div>
  )
}
