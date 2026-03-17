import { Button, Spinner, Textarea, useToast } from '@chakra-ui/react'
import { POST } from '@constants/http-methods'
import { rarityMap } from '@constants/rarity-map'
import { mutation } from '@pages/api/database/mutation'
import { successToastOptions } from '@utils/toast'
import axios from 'axios'
import { useEffect, useState } from 'react'
import CSVReader from 'react-csv-reader'

type CustomCardResult = {
  playerID: number | null
  playerName: string
  team: string
  rarity: string
  subType: string | null
  season: number
  success: boolean
  error?: string
}

type SimplifiedCardInput = {
  team: string
  playerid: number | null
  season: number
  card_rarity: string
  sub_type: string | null
}

const DATA_COLUMNS = {
  team: 0,
  playerid: 1,
  season: 2,
  card_rarity: 3,
  sub_type: 4,
}

export default function RequestCustomCardsForm({
  onError,
}: {
  onError: (errorMessage) => void
}) {
  const toast = useToast()
  const [csvToUpload, setCsvToUpload] = useState(null)
  const [canSubmitCsv, setCanSubmitCsv] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [numberOfCardsToUpload, setNumberOfCardsToUpload] = useState<number>(0)
  const [created, setCreated] = useState<CustomCardResult[]>(null)
  const [failed, setFailed] = useState<CustomCardResult[]>(null)

  const { mutateAsync: requestCustomCards, isLoading } = mutation<
    { created: CustomCardResult[]; failed: CustomCardResult[] },
    { cards: SimplifiedCardInput[] }
  >({
    mutationFn: async ({ cards }) => {
      const response = await axios({
        method: POST,
        url: '/api/v3/cards/custom-requests',
        data: { cards },
      })
      return response.data.payload
    },
    onSuccess: (data) => {
      setCreated(data.created)
      setFailed(data.failed)

      if (data.created.length > 0) {
        toast({
          title: `${data.created.length} card(s) inserted successfully`,
          ...successToastOptions,
        })
      }

      if (data.failed.length > 0) {
        toast({
          title: `${data.failed.length} card(s) failed`,
          status: 'warning',
          duration: 5000,
          isClosable: true,
        })
      }
    },
  })

  useEffect(() => {
    setCanSubmitCsv(csvToUpload !== null)
  }, [csvToUpload])

  const handleSelectCsv = (data, fileInfo) => {
    setNumberOfCardsToUpload(data.length - 1)
    setCsvToUpload(data)
  }

  const handleUploadCsv = async () => {
    setIsSubmitting(true)
    const errors: string[] = []
    const cards: SimplifiedCardInput[] = csvToUpload.map((row, index) => {
      if (index === 0) return

      const newCard: SimplifiedCardInput = {
        team: row[DATA_COLUMNS.team],
        playerid: row[DATA_COLUMNS.playerid] && row[DATA_COLUMNS.playerid].length > 0
          ? parseInt(row[DATA_COLUMNS.playerid])
          : null,
        season: parseInt(row[DATA_COLUMNS.season]),
        card_rarity: row[DATA_COLUMNS.card_rarity],
        sub_type:
          row[DATA_COLUMNS.sub_type]?.length === 0
            ? null
            : row[DATA_COLUMNS.sub_type],
      }

      const validation = validateCard(newCard, index)
      if (validation.status === false) {
        errors.push(validation.error)
        return null
      }

      return newCard
    })

    // remove header row
    cards.shift()

    if (errors.length === 0) {
      await requestCustomCards({ cards })
    } else {
      onError(errors.join('. '))
    }

    setIsSubmitting(false)
  }

  const handleDownloadTemplate = () => {
    const headers = [
      'team',
      'playerid',
      'season',
      'card_rarity',
      'sub_type',
    ]

    const csvString = headers.join(',')
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `custom-cards-template.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="mb-4 flex justify-start items-center">
        <Button onClick={handleDownloadTemplate} size="sm" variant="outline">
          Download CSV Template
        </Button>
      </div>

      <CSVReader
        cssClass="react-csv-input"
        label="Upload CSV&nbsp;"
        onFileLoaded={handleSelectCsv}
      />
      <div className="mb-5 flex justify-start items-center">
        Cards Awaiting Submission: {numberOfCardsToUpload}
      </div>

      <div className="flex justify-end items-center">
        <Button
          disabled={!canSubmitCsv || isSubmitting || isLoading}
          onClick={handleUploadCsv}
        >
          {isLoading || isSubmitting ? <Spinner /> : 'Submit Cards'}
        </Button>
      </div>

      <div className="flex flex-col mt-4">
        {created && created.length > 0 && (
          <div className="my-2 p-2 border border-green-500 rounded">
            <div className="font-bold text-green-600 mb-2">
              Created - {created.length}
            </div>
            <Textarea
              value={JSON.stringify(created, null, 2)}
              disabled={true}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
        )}

        {failed && failed.length > 0 && (
          <div className="my-2 p-2 border border-red-500 rounded">
            <div className="font-bold text-red-600 mb-2">
              Failed - {failed.length}
            </div>
            <Textarea
              value={JSON.stringify(failed, null, 2)}
              disabled={true}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
        )}
      </div>
    </div>
  )
}

const validateCard = (
  card: SimplifiedCardInput,
  index: number
): { status: true } | { status: false; error: string } => {
  if (!card.team || card.team.length === 0) {
    return { status: false, error: `team missing on row ${index}` }
  }

  // playerid is now optional for custom cards

  if (!card.season || card.season < 0) {
    return { status: false, error: `season missing or invalid on row ${index}` }
  }

  if (
    !card.card_rarity ||
    !Object.values(rarityMap).some(
      (rarity) => rarity.label === card.card_rarity
    )
  ) {
    return {
      status: false,
      error: `card_rarity missing or invalid on row ${index}`,
    }
  }

  return { status: true }
}
