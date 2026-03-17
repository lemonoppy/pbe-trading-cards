import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Image,
  Box,
  SimpleGrid,
  Spinner,
  Button,
} from '@chakra-ui/react'
import React, { useState, useMemo, useCallback } from 'react'
import axios from 'axios'
import { query } from '@pages/api/database/query'
import { GET } from '@constants/http-methods'
import PackOpen from '@components/collection/PackOpen'
import { UserPacks } from '@pages/api/v3'
import { useRouter } from 'next/router'
import { packService } from 'services/packService'

interface DisplayPacksProps {
  userID: string
}

const DisplayPacks: React.FC<DisplayPacksProps> = React.memo(({ userID }) => {
  const router = useRouter()
  const [selectedPackID, setSelectedPackID] = useState<string | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const { payload: packsRaw, isLoading: packsLoading } = query<UserPacks[]>({
    queryKey: ['latest-cards', userID],
    queryFn: () =>
      axios({
        method: GET,
        url: `/api/v3/collection/uid/latest-packs?userID=${userID}`,
      }),
    enabled: !!userID && isPanelOpen,
  })

  // Filter out legacy packs (packid < 0)
  const packs = useMemo(
    () => packsRaw?.filter(pack => pack.packid >= 0) || [],
    [packsRaw]
  )

  const handlePackClick = useCallback(
    (packID: string) => {
      setSelectedPackID(packID === selectedPackID ? null : packID)
    },
    [selectedPackID]
  )

  const packImages = useMemo(
    () =>
      packs?.map((pack) =>
        pack.packtype === 'base'
          ? packService.basePackCover()
          : pack.packtype === 'throwback'
              ? packService.throwbackPackCover()
              : pack.packtype === 'event'
                ? packService.eventPackCover()
                : '/ruby-pack-cover.png'
      ) || [],
    [packs]
  )

  return (
    <Accordion allowToggle>
      <AccordionItem>
        <h2>
          <AccordionButton onClick={() => setIsPanelOpen((prev) => !prev)}>
            <Box flex="1" textAlign="left" fontWeight="bold" fontSize="lg">
              Latest Packs Opened
            </Box>
            <AccordionIcon />
          </AccordionButton>
        </h2>
        <AccordionPanel pb={4}>
          {isPanelOpen && (
            <>
              {packsLoading ? (
                <Spinner />
              ) : packs && packs.length > 0 ? (
                <SimpleGrid columns={3} spacing={4}>
                  {packImages.map((imageSrc, index) => (
                    <Box key={packs[index].packid} textAlign="center">
                      <Image
                        src={imageSrc}
                        alt={`Pack Cover ${index + 1}`}
                        onClick={() => handlePackClick(String(packs[index].packid))}
                        className="cursor-pointer"
                        width={100}
                        height={175}
                        style={{
                          border:
                            selectedPackID === String(packs[index].packid)
                              ? '2px solid yellow'
                              : 'none',
                        }}
                      />
                    </Box>
                  ))}
                </SimpleGrid>
              ) : (
                <div>No packs available.</div>
              )}
              {selectedPackID && (
                <>
                  <Button
                    mt={4}
                    colorScheme="green"
                    onClick={() => router.push(`/packs/${selectedPackID}`)}
                  >
                    Go to pack
                  </Button>
                  <Box mt={4}>
                    <PackOpen packID={selectedPackID} />
                  </Box>
                </>
              )}
            </>
          )}
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  )
})

export default DisplayPacks
