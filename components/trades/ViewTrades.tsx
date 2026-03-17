import {
  FormControl,
  FormLabel,
  Input,
  Stack,
  Heading,
  Radio,
  RadioGroup,
} from '@chakra-ui/react'
import ViewTradeTable from '@components/tables/ViewTradeTable'
import { GET } from '@constants/http-methods'
import { query } from '@pages/api/database/query'
import { ListResponse, SortDirection } from '@pages/api/v3'
import axios from 'axios'
import { useSession } from 'contexts/AuthContext'
import { useSearchParams, useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useDebounce } from 'use-debounce'

const TRADE_STATUS_OPTIONS: {
  value: TradeStatus
  label: string
  sortLabel: (direciton: SortDirection) => string
}[] = [
  {
    value: 'COMPLETE',
    label: 'Complete',
    sortLabel: (direction: SortDirection) =>
      direction === 'DESC' ? '(Descending)' : '(Ascending)',
  },
  {
    value: 'PENDING',
    label: 'Pending',
    sortLabel: (direction: SortDirection) =>
      direction === 'DESC' ? '(Descending)' : '(Ascending)',
  },
  {
    value: 'DECLINED',
    label: 'Declined',
    sortLabel: (direction: SortDirection) =>
      direction === 'DESC' ? '(Descending)' : '(Ascending)',
  },
  {
    value: 'AUTO_DECLINED',
    label: 'Auto Declined',
    sortLabel: (direction: SortDirection) =>
      direction === 'DESC' ? '(Descending)' : '(Ascending)',
  },
] as const

export default function ViewTrades() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialStatus = (searchParams.get('status') as TradeStatus) ?? 'PENDING'
  const [tradeStatusFilter, setTradeStatusFilter] =
    useState<TradeStatus>(initialStatus)

  const [partnerUsername, setPartnerUsername] = useState<string>('')
  const [debouncedUsername] = useDebounce(partnerUsername, 500)
  const { session, loggedIn } = useSession()
  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(Array.from(searchParams.entries()))
      params.set(name, value)
      return params.toString()
    },
    [searchParams]
  )

  const setStatusCallback = useCallback(
    (value: TradeStatus) => {
      router.push(`/trade?${createQueryString('status', value)}`)
      setTradeStatusFilter(value)
    },
    [router, createQueryString]
  )

  const { payload: loggedInTrades, isLoading } = query<ListResponse<Trade>>({
    queryKey: [
      'trades',
      session?.token,
      JSON.stringify(tradeStatusFilter),
      debouncedUsername,
    ],
    queryFn: () =>
      axios({
        method: GET,
        url: `/api/v3/trades`,
        headers: { Authorization: `Bearer ${session?.token}` },
        params: {
          username: debouncedUsername?.length >= 3 ? debouncedUsername : '',
          status: tradeStatusFilter,
          userid: session.userId,
        },
      }),
    enabled: loggedIn,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Don't auto-refetch when switching tabs
    refetchOnMount: true, // Refetch when component mounts if data is stale
  })

  return (
    <>
      <div className="border-b-8 border-b-blue700 bg-secondary p-4">
        <Stack
          direction={{ base: 'column', md: 'row' }}
          spacing={6}
          align={{ base: 'stretch', md: 'flex-end' }}
        >
          <Heading as="h1" size="md" color="secondaryText" mb={{ base: 0, md: 2 }}>
            View Your Trades
          </Heading>

          <FormControl flex="2">
            <FormLabel className="text-secondaryText font-semibold">Status</FormLabel>
            <RadioGroup
              value={tradeStatusFilter}
              onChange={(value) => setStatusCallback(value as TradeStatus)}
            >
              <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
                {TRADE_STATUS_OPTIONS.map((option) => (
                  <Radio
                    key={option.value}
                    value={option.value}
                    colorScheme="blue"
                    size="md"
                    bg="white"
                    borderColor="gray.300"
                    px={2}
                    py={1}
                    borderRadius="md"
                    _checked={{
                      bg: 'blue.50',
                      borderColor: 'blue.500',
                    }}
                  >
                    <span className="text-sm md:text-base font-medium text-gray-800">{option.label}</span>
                  </Radio>
                ))}
              </Stack>
            </RadioGroup>
          </FormControl>

          <FormControl flex="1">
            <FormLabel className="text-secondaryText font-semibold">Partner</FormLabel>
            <Input
              placeholder="Partner username"
              type="text"
              value={partnerUsername}
              onChange={(e) => setPartnerUsername(e.target.value)}
              bg="white"
              borderColor="gray.300"
              _placeholder={{ color: 'gray.400' }}
              _hover={{ borderColor: 'gray.400' }}
              _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)' }}
              className="text-gray-800"
            />
          </FormControl>
        </Stack>
      </div>

      <ViewTradeTable trades={loggedInTrades?.rows} isLoading={isLoading} />
    </>
  )
}
