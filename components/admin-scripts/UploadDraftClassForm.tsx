import { Button, Spinner, useToast } from '@chakra-ui/react'
import { POST } from '@constants/http-methods'
import { rarityMap } from '@constants/rarity-map'
import { mutation } from '@pages/api/database/mutation'
import { successToastOptions } from '@utils/toast'
import axios from 'axios'
import { useEffect, useState } from 'react'
import CSVReader from 'react-csv-reader'
import UploadDraftClassResultsTable from './UploadDraftClassResultsTable'

type DraftClassCardResult = {
  playerID: number | null
  playerName: string
  team: string
  rarity: string
  subType: string | null
  season: number
  success: boolean
  error?: string
}

type DraftClassCardInput = {
  team: string
  playerid: number | null
  season: number
  card_rarity: string
  sub_type: string | null
  // Optional enrichment fields from CSV
  player_name?: string
  render_name?: string | null
  position?: string
  image_url?: string | null
  author_userid?: number | null
  pullable?: boolean
}

const DATA_COLUMNS = {
  // Core fields (always required)
  team: 0,
  playerid: 1,
  season: 2,
  card_rarity: 3,
  sub_type: 4,
  // Optional enrichment fields (new)
  player_name: 5,
  render_name: 6,
  position: 7,
  image_url: 8,
  author_userid: 9,
  pullable: 10,
}

export default function UploadDraftClassForm({
  onError,
}: {
  onError: (errorMessage) => void
}) {
  const toast = useToast()
  const [csvToUpload, setCsvToUpload] = useState(null)
  const [canSubmitCsv, setCanSubmitCsv] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [numberOfCardsToUpload, setNumberOfCardsToUpload] = useState<number>(0)
  const [created, setCreated] = useState<DraftClassCardResult[]>(null)
  const [failed, setFailed] = useState<DraftClassCardResult[]>(null)

  const { mutateAsync: uploadDraftClass, isLoading } = mutation<
    { created: DraftClassCardResult[]; failed: DraftClassCardResult[] },
    { cards: DraftClassCardInput[] }
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
          title: `${data.created.length} draft class card(s) inserted successfully`,
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

  const handleDownloadTemplate = () => {
    const headers = [
      'team',
      'playerid',
      'season',
      'card_rarity',
      'sub_type',
      'player_name',
      'render_name',
      'position',
      'image_url',
      'author_userid',
      'pullable',
    ]
    const csvContent = headers.join(',')

    // Create a blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', 'card_set_template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleUploadCsv = async () => {
    setIsSubmitting(true)
    const errors: string[] = []

    // Detect CSV format: 5 columns (legacy) or 10 columns (new)
    const isExtendedFormat = csvToUpload[0]?.length >= 10

    const cards: DraftClassCardInput[] = csvToUpload
      .slice(1) // Skip header row
      .map((row, index) => {
        const coreCard: DraftClassCardInput = {
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

        // Parse optional enrichment fields if extended format
        if (isExtendedFormat) {
          const extendedCard: DraftClassCardInput = {
            ...coreCard,
            player_name: row[DATA_COLUMNS.player_name] || undefined,
            render_name: row[DATA_COLUMNS.render_name] || undefined,
            position: row[DATA_COLUMNS.position] || undefined,
            image_url: row[DATA_COLUMNS.image_url] || undefined,
            author_userid: row[DATA_COLUMNS.author_userid]
              ? parseInt(row[DATA_COLUMNS.author_userid])
              : undefined,
            pullable: row[DATA_COLUMNS.pullable]
              ? row[DATA_COLUMNS.pullable].toLowerCase() === 'true' || row[DATA_COLUMNS.pullable] === '1'
              : undefined,
          }

          const validation = validateCard(extendedCard, index + 2)
          if (validation.status === false) {
            errors.push(validation.error)
            return null
          }

          return extendedCard
        }

        const validation = validateCard(coreCard, index + 2)
        if (validation.status === false) {
          errors.push(validation.error)
          return null
        }

        return coreCard
      })
      .filter(card => card !== null)

    if (errors.length === 0) {
      await uploadDraftClass({ cards })
    } else {
      onError(errors.join('. '))
    }

    setIsSubmitting(false)
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <Button
          size="sm"
          colorScheme="blue"
          onClick={handleDownloadTemplate}
          width="fit-content"
        >
          Download CSV Template
        </Button>
        <CSVReader
          cssClass="react-csv-input"
          label=""
          onFileLoaded={handleSelectCsv}
        />
      </div>
      <div className="mb-5 flex justify-start items-center">
        Cards Awaiting Submission: {numberOfCardsToUpload}
      </div>

      <div className="flex justify-end items-center">
        <Button
          disabled={!canSubmitCsv || isSubmitting || isLoading}
          onClick={handleUploadCsv}
        >
          {isLoading || isSubmitting ? <Spinner /> : 'Submit Draft Class Cards'}
        </Button>
      </div>

      <div className="flex flex-col mt-4">
        {created && created.length > 0 && (
          <UploadDraftClassResultsTable
            data={created}
            title="Created Successfully"
          />
        )}

        {failed && failed.length > 0 && (
          <UploadDraftClassResultsTable
            data={failed}
            title="Failed to Create"
          />
        )}
      </div>
    </div>
  )
}

const validateCard = (
  card: DraftClassCardInput,
  index: number
): { status: true } | { status: false; error: string } => {
  if (!card.team || card.team.length === 0) {
    return { status: false, error: `team missing on row ${index}` }
  }

  if (!card.playerid || card.playerid <= 0) {
    return { status: false, error: `playerid missing or invalid on row ${index}` }
  }

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
