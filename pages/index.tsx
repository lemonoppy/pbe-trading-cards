import { PageWrapper } from '@components/common/PageWrapper'
import DiscordWidget from '@components/widgets/DiscordWidget'
import axios from 'axios'
import config from 'lib/config'
import { GetServerSidePropsContext } from 'next'
import { dehydrate, QueryClient } from 'react-query'
import { UserCollection, UserMostCards, ListResponse } from './api/v3'
import { query } from './api/database/query'
import { GET } from '@constants/http-methods'
import MostCardsTable from '@components/tables/MostCardsTable'
import { Carousel } from '@components/carousel/Carousel'
import { useMemo } from 'react'
import { useSession } from 'contexts/AuthContext'
import { UserData } from './api/v3/user'
import { Button } from '@chakra-ui/react'
import NewestCards from '@components/tables/NewestCards'
import { HOME_CARDS_TABLE_NO_FILTER } from '@components/tables/tableBehaviorFlags'
import router from 'next/router'

export default function HomePage() {
  const { session, loggedIn, handleLogout } = useSession()

  const { payload, isLoading } = query<UserMostCards[]>({
    queryKey: ['most-cards'],
    queryFn: () =>
      axios({
        method: GET,
        data: { limit: 10 },
        url: `/api/v3/user/most-cards`,
      }),
    staleTime: 2 * 60 * 1000, // 2 minutes - leaderboard changes slowly
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  })

  const { payload: packs, isLoading: packsLoading } = query<UserCollection[]>({
    queryKey: ['last-five-packs'],
    queryFn: () =>
      axios({
        method: GET,
        url: `/api/v3/cards/last-five-packs`,
      }),
    staleTime: 1 * 60 * 1000, // 1 minute - recent packs change frequently
    cacheTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { payload: user, isLoading: isLoadingUser } = query<UserData>({
    queryKey: ['baseUser', session?.token],
    queryFn: () =>
      axios({
        url: '/api/v3/user',
        method: GET,
        headers: { Authorization: `Bearer ${session?.token}` },
      }),
    enabled: loggedIn,
    staleTime: 5 * 60 * 1000, // 5 minutes - user data changes infrequently
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const limitedCards = useMemo(
    () => (packs?.length ? packs.slice(0, 30) : []),
    [packs]
  )

  const { payload: latestCards, isLoading: isLoadingLatestCards } = query<
    ListResponse<Card>
  >({
    queryKey: ['cards-homepage'],
    queryFn: () =>
      axios({
        method: GET,
        url: '/api/v3/cards',
        params: {
          limit: 15,
          date_approved: 'true',
          sortColumn: 'date_approved',
          sortDirection: 'DESC',
          viewDone: 'true',
        },
      }),
    staleTime: 2 * 60 * 1000, // 2 minutes - new cards approved occasionally
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  return (
    <PageWrapper>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-center mt-5">
          Welcome to Dotts, {user?.username}
        </h1>

        <div>
          <Carousel cards={limitedCards} isLoading={packsLoading} />
        </div>
        <div className="bg-primary shadow-md rounded-lg p-6">
          <h2 className="border-b-8 border-b-blue700 bg-secondary p-4 text-lg font-bold text-secondaryText sm:text-xl">
            Most Cards Collected
          </h2>
          <MostCardsTable data={payload} isLoading={isLoading} />
        </div>
        <div className="bg-primary shadow-md rounded-lg p-6">
          <h2 className="border-b-8 border-b-blue700 bg-secondary p-4 text-lg font-bold text-secondaryText sm:text-xl">
            Newest Cards
          </h2>
          <NewestCards
            data={latestCards}
            isLoading={isLoadingLatestCards}
            BehaviorFlag={HOME_CARDS_TABLE_NO_FILTER}
            uid={String(user?.uid)}
          />
          <Button
            mt={4}
            className="w-full bg-blue-500 !hover:bg-blue-600 hover:shadow-xl text-secondary font-bold py-2 px-4 rounded text-sm sm:text-xs"
            onClick={() => router.push('/community/new-cards')}
          >
            See All New Cards
          </Button>
        </div>

        <div className="bg-primary shadow-md rounded-lg p-6">
          <h2 className="border-b-8 border-b-blue700 bg-secondary p-4 text-lg font-bold text-secondaryText sm:text-xl">
            Join Our Community
          </h2>
          <DiscordWidget />
        </div>
      </div>
    </PageWrapper>
  )
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const queryClient = new QueryClient()

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
  }
}
