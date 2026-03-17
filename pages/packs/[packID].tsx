import React from 'react'
import { Box, Spinner, VStack, HStack, Link, Heading, Text } from '@chakra-ui/react'
import { query } from '@pages/api/database/query'
import { GET } from '@constants/http-methods'
import axios from 'axios'
import { UserPacks } from '@pages/api/v3'
import { PageWrapper } from '@components/common/PageWrapper'
import { formatDateTime } from '@utils/formatDateTime'
import PackOpen from '@components/collection/PackOpen'
import GetUsername from '@components/common/GetUsername'
import { GetServerSideProps } from 'next'

export default ({ packID }: { packID: string }) => {
  // Handle legacy imports (packID = -1 or negative)
  if (packID === '-1' || Number(packID) < 0) {
    return (
      <PageWrapper>
        <Box p={8} textAlign="center">
          <Heading size="lg" mb={4} className="text-secondaryText">
            Legacy Import
          </Heading>
          <Text className="text-secondary">
            This card was imported from the original Dotts system during the portal migration.
            No pack details are available for legacy imports.
          </Text>
        </Box>
      </PageWrapper>
    )
  }

  const { payload: packs, isLoading: packsLoading } = query<UserPacks[]>({
    queryKey: ['latest-packs', packID],
    queryFn: () =>
      axios({
        method: GET,
        url: `/api/v3/collection/uid/latest-packs?packID=${packID}`,
      }),
    enabled: !!packID,
  })

  if (packsLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <Spinner size="xl" />
      </Box>
    )
  }

  const pack = packs?.[0]

  if (!pack) {
    return (
      <PageWrapper>
        <Box p={6}>
          <div className="text-base sm:text-lg">Pack not found.</div>
        </Box>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <Box p={6}>
        <div className="border-b-8 border-b-blue700 bg-secondary p-4 text-lg sm:text-xl font-bold text-secondaryText mb-6">
          <VStack spacing={4} align="start">
            <HStack justify="space-between" width="100%">
              <div className="font-bold">
                <div className="text-xs sm:text-lg">
                  Opened by:{' '}
                  <Link
                    className="!text-link"
                    href={`/collect/${pack.userid}`}
                    target="_blank"
                  >
                    <GetUsername userID={pack.userid} />
                  </Link>{' '}
                </div>
                <div className="text-xs sm:text-lg">
                  Pack Type: {pack.packtype === 'ruby' ? 'Ultimus' : pack.packtype.charAt(0).toUpperCase() + pack.packtype.slice(1)}
                </div>
              </div>
              <div className="font-bold">
                <div className="text-xs sm:text-lg">
                  Bought On: {formatDateTime(pack.purchasedate)}
                </div>
                <div className="text-xs sm:text-lg">
                  Opened On: {formatDateTime(pack.opendate)}
                </div>
              </div>
            </HStack>
          </VStack>
        </div>
        {pack.opened ? (
          <PackOpen packID={packID} />
        ) : (
          <div className="text-base sm:text-lg">
            No cards available for this pack.
          </div>
        )}
      </Box>
    </PageWrapper>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const { packID } = query

  return {
    props: {
      packID,
    },
  }
}
