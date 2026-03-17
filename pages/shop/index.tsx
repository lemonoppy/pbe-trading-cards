import { PageWrapper } from '@components/common/PageWrapper'
import useBuyPack from '@pages/api/mutations/use-buy-pack'
import React, { useEffect, useMemo, useState } from 'react'
import { packService, PackInfo } from 'services/packService'
import useUpdateSubscription from '@pages/api/mutations/use-update-subscription'
import { NextSeo } from 'next-seo'
import { GET } from '@constants/http-methods'
import { UserData } from '@pages/api/v3/user'
import axios from 'axios'
import { useSession } from 'contexts/AuthContext'
import { DailySettingsData } from '@pages/api/v3/settings/daily'
import { query } from '@pages/api/database/query'
import {
  Button,
  Heading,
  Skeleton,
  Image as ChakraImage,
  useToast,
  Box,
  Progress,
  Text,
} from '@chakra-ui/react'
import { warningToastOptions } from '@utils/toast'
import { TimeUntilMidnight } from '@utils/time-until-midnight'
import router from 'next/router'
import RarityInfoButton from '@components/common/RarityInfoButton'

export type PackInfoWithCover = PackInfo & {
  cover: string
}

const PackShop = () => {
  const toast = useToast()
  const { session, loggedIn } = useSession()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [isUserLoading, setIsUserLoading] = useState<boolean>(true)
  const [, setSubscriptionValue] = useState<number>(0)
  const { buyPack, isLoading: buyBackIsLoading } = useBuyPack()
  const { updateSubscription } = useUpdateSubscription()

  const { payload: user, isLoading: useridLoading } = query<UserData>({
    queryKey: ['baseUser', session?.token],
    queryFn: () =>
      axios({
        method: GET,
        url: '/api/v3/user',
        headers: { Authorization: `Bearer ${session?.token}` },
      }),
    enabled: loggedIn,
  })

  useEffect(() => {
    if (!useridLoading && user?.uid) {
      setIsUserLoading(false)
    }
  }, [useridLoading, user])

  const { payload: dailySubscription, isLoading: dailySubscriptionLoading } =
    query<DailySettingsData[]>({
      queryKey: ['daily-subscription', String(user?.uid)],
      queryFn: () =>
        axios({
          method: GET,
          url: `/api/v3/settings/daily?userid=${user?.uid}`,
        }),
      enabled: !!user?.uid,
    })

  // Fetch today's pack purchase counts + DB config (daily_limit, enabled, subscription_enabled)
  const { payload: packLimits, isLoading: packLimitsLoading } = query<
    Record<string, { count: number; daily_limit: number; enabled: boolean; subscription_enabled: boolean; price: number }>
  >({
    queryKey: ['pack-limits-today', String(user?.uid)],
    queryFn: () =>
      axios({
        method: GET,
        url: `/api/v3/packs/limits/${user?.uid}`,
      }),
    enabled: !!user?.uid,
  })

  useEffect(() => {
    if (dailySubscription && dailySubscription[0]?.subscription > 0) {
      setSubscriptionValue(dailySubscription[0]?.subscription || 0)
    }
  }, [dailySubscription])

  const packsWithCovers: PackInfoWithCover[] = useMemo(() => {
    return Object.values(packService.packs)
      .filter((pack) => packLimits?.[pack.id]?.enabled === true) // Only show once loaded + enabled
      .map((pack) => {
        const typedPack = pack as PackInfo
        if (typedPack.id === 'base') {
          return { ...typedPack, cover: packService.basePackCover() }
        } else if (typedPack.id === 'ruby') {
          return { ...typedPack, cover: packService.rubyPackCover() }
        } else if (typedPack.id === 'throwback') {
          return { ...typedPack, cover: packService.throwbackPackCover() }
        } else if (typedPack.id === 'event') {
          return { ...typedPack, cover: packService.eventPackCover() }
        }
        return { ...typedPack, cover: typedPack.imageUrl }
      })
  }, [packLimits])

  const isPackLimitReached = (packId: string): boolean => {
    if (!packLimits) return false
    const cfg = packLimits[packId]
    if (!cfg) return false
    return cfg.count >= cfg.daily_limit
  }

  const handleSelectedPack = (pack: PackInfoWithCover): void => {
    if (!loggedIn) {
      toast({
        title: 'Log in to purchase packs',
        ...warningToastOptions,
      })
      return
    }

    if (isPackLimitReached(pack.id)) {
      toast({
        title: 'Daily Limit Reached',
        description: `You've already purchased the maximum ${packLimits?.[pack.id]?.daily_limit ?? ''} ${pack.label} pack(s) today`,
        ...warningToastOptions,
      })
      return
    }

    if (buyBackIsLoading) {
      toast({
        title: 'Already buying a pack',
        description: `Calm down man`,
        ...warningToastOptions,
      })
      return
    }

    const qty = quantities[pack.id] ?? 1
    buyPack({ uid: user.uid, packType: pack.id as any, quantity: qty })
    setQuantities((prev) => ({ ...prev, [pack.id]: 1 }))
  }

  const baseSubscriptionValue = useMemo(() => {
    return String(dailySubscription?.[0]?.subscription ?? 0)
  }, [dailySubscription])

  const rubySubscriptionValue = useMemo(() => {
    return String(dailySubscription?.[0]?.rubySubscription ?? 0)
  }, [dailySubscription])

  const handleUpdateBaseSubscription = (value: string): void => {
    const newSubscription = parseInt(value)
    if (user?.uid) {
      updateSubscription({
        uid: user.uid,
        subscriptionAmount: newSubscription,
        label: `Base Pack subscription set to ${newSubscription}/day`,
      })
    }
  }

  const handleUpdateRubySubscription = (value: string): void => {
    const newSubscription = parseInt(value)
    if (user?.uid) {
      updateSubscription({
        uid: user.uid,
        subscriptionAmount: newSubscription,
        isRuby: true,
        label: `Ultimus Pack subscription set to ${newSubscription}/day`,
      })
    }
  }

  const subscriptionConfig: Record<string, { value: string; handler: (v: string) => void; options: number[] }> = {
    base: {
      value: baseSubscriptionValue,
      handler: handleUpdateBaseSubscription,
      options: Array.from({ length: (packLimits?.['base']?.daily_limit ?? 1) + 1 }, (_, i) => i),
    },
    ruby: {
      value: rubySubscriptionValue,
      handler: handleUpdateRubySubscription,
      options: Array.from({ length: (packLimits?.['ruby']?.daily_limit ?? 1) + 1 }, (_, i) => i),
    },
  }

  return (
    <PageWrapper>
      <NextSeo title="Shop" />
      <div className="m-2">
        {/* Shop header banner */}
        <div
          className="w-full max-w-4xl mx-auto mt-8 mb-6 rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 40%, #0f2244 100%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.07)',
            position: 'relative',
          }}
        >
          {/* Radial glow accents */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at 15% 60%, rgba(25,118,210,0.18) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(66,165,245,0.1) 0%, transparent 45%)',
          }} />

          <div className="relative flex flex-col sm:flex-row items-stretch">
            {/* Title side */}
            <div className="flex flex-col justify-center px-8 py-7 flex-1">
              <Text
                fontSize="10px"
                fontWeight="bold"
                style={{ color: '#42a5f5', letterSpacing: '0.2em', textTransform: 'uppercase' }}
              >
                PBE Trading Cards
              </Text>
              <Heading
                as="h1"
                style={{ color: 'white', fontWeight: 800, fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: '4px' }}
              >
                Pack Shop
              </Heading>
              {packLimits && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {Object.entries(packLimits)
                    .filter(([, cfg]) => cfg.enabled)
                    .map(([packtype, cfg]) => (
                      <span
                        key={packtype}
                        style={{
                          background: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '999px',
                          padding: '2px 10px',
                          fontSize: '11px',
                          color: 'rgba(255,255,255,0.65)',
                          fontWeight: 500,
                          letterSpacing: '0.01em',
                        }}
                      >
                        {cfg.daily_limit} {packService.packs[packtype]?.label ?? packtype}/day
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div
              className="hidden sm:block"
              style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '20px 0' }}
            />

            {/* Reset timer side */}
            <div className="flex flex-col justify-center items-center px-8 py-7 gap-1 sm:min-w-[180px]">
              <Text
                fontSize="10px"
                fontWeight="bold"
                style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.18em' }}
              >
                Resets in
              </Text>
              <Text
                fontWeight="bold"
                style={{ color: 'white', fontVariantNumeric: 'tabular-nums', fontSize: 'clamp(1.5rem, 3vw, 2rem)', letterSpacing: '-0.02em' }}
              >
                {TimeUntilMidnight()}
              </Text>
              <Text fontSize="xs" style={{ color: 'rgba(255,255,255,0.35)' }}>midnight EST</Text>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-5 mt-8 w-full max-w-4xl mx-auto px-4">
          {packLimitsLoading ? (
            <>
              {[0, 1].map((i) => (
                <Skeleton key={i} w="100%" h="200px" borderRadius="xl" />
              ))}
            </>
          ) : (
            packsWithCovers.map((pack: PackInfoWithCover, index: number) => {
              const limitReached = isPackLimitReached(pack.id)
              const count = packLimits?.[pack.id]?.count ?? 0
              const dailyLimit = packLimits?.[pack.id]?.daily_limit ?? 1
              const remaining = Math.max(0, dailyLimit - count)
              const qty = quantities[pack.id] ?? 1
              const subCfg = subscriptionConfig[pack.id]
              const subEnabled = packLimits?.[pack.id]?.subscription_enabled && subCfg

              return (
                <div
                  key={index}
                  className="w-full flex flex-col sm:flex-row items-stretch rounded-2xl overflow-hidden bg-primary"
                  style={{
                    opacity: limitReached ? 0.65 : 1,
                    transition: 'opacity 0.2s, box-shadow 0.2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.12), 0 4px 20px rgba(0,0,0,0.09)',
                    border: '1px solid rgba(128, 128, 128, 0.15)',
                  }}
                >
                  {/* Pack image */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center p-6 sm:w-[220px]"
                  >
                    <ChakraImage
                      src={pack.cover}
                      alt={`${pack.label} Pack`}
                      className="transition-transform duration-300 ease-in-out hover:scale-110"
                      objectFit="contain"
                      maxH="200px"
                    />
                  </div>

                  {/* Divider */}
                  <div className="hidden sm:block border-l border-inherit" style={{ margin: '20px 0' }} />

                  {/* Details */}
                  <div className="flex flex-col justify-between flex-1 px-6 py-5 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Heading as="h2" size="md" className="flex items-center gap-1">
                          {pack.label} Pack
                          <RarityInfoButton packID={pack?.id} />
                        </Heading>
                        <Text fontSize="sm" fontWeight="bold" className="text-primary">
                          ${new Intl.NumberFormat().format(packLimits?.[pack.id]?.price ?? pack.price)}
                        </Text>
                      </div>
                      <Text fontSize="xs" className="!text-tertiary" noOfLines={2}>
                        {pack.description}
                      </Text>
                    </div>

                    {loggedIn ? (
                      <div className="flex flex-col gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <Text fontSize="xs" className="!text-tertiary">Daily limit</Text>
                            <Text fontSize="xs" className="!text-tertiary">{count} / {dailyLimit}</Text>
                          </div>
                          <Progress
                            value={(count / dailyLimit) * 100}
                            size="xs"
                            colorScheme={limitReached ? 'red' : 'blue'}
                            borderRadius="full"
                          />
                        </div>

                        <div className="flex flex-col gap-2">
                          {/* Quantity selector pills (only when >1 remaining) */}
                          {!limitReached && remaining > 1 && (
                            <div className="flex items-center gap-3">
                              <Text fontSize="sm" fontWeight="semibold" className="!text-secondary" flexShrink={0}>Qty:</Text>
                              <div className="flex gap-2 flex-wrap">
                                {[
                                  ...Array.from({ length: Math.min(5, remaining) }, (_, i) => i + 1),
                                  ...Array.from({ length: Math.floor(remaining / 5) }, (_, i) => (i + 2) * 5).filter((n) => n <= remaining),
                                ].map((n) => (
                                  <button
                                    key={n}
                                    onClick={() => setQuantities((prev) => ({ ...prev, [pack.id]: n }))}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'background 0.15s, color 0.15s',
                                      background: qty === n ? 'rgba(25,118,210,0.1)' : 'var(--color-background-secondary)',
                                      color: qty === n ? '#1976D2' : 'var(--color-text-primary)',
                                      border: qty === n ? '2px solid #1976D2' : '2px solid transparent',
                                      boxShadow: 'none',
                                    }}
                                  >
                                    {n}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Buy / limit button — always in same position */}
                          {limitReached ? (
                            <Box
                              alignSelf="flex-start"
                              px={4}
                              py={2}
                              borderRadius="md"
                              fontSize="sm"
                              fontWeight="semibold"
                              style={{
                                border: '1px solid rgba(128,128,128,0.4)',
                                color: 'rgba(160,160,160,0.9)',
                                cursor: 'not-allowed',
                              }}
                            >
                              Daily Limit Reached
                            </Box>
                          ) : (
                            <Button
                              size="md"
                              colorScheme="blue"
                              onClick={() => handleSelectedPack(pack)}
                              alignSelf="flex-start"
                            >
                              {qty > 1 ? `Buy ${qty} Packs` : 'Buy Pack'}
                            </Button>
                          )}

                          {/* Subscription pills */}
                          {subEnabled && (
                            <div className="flex items-center gap-3">
                              <Text fontSize="sm" fontWeight="semibold" className="!text-secondary" flexShrink={0}>Subscription:</Text>
                              <div className="flex gap-2">
                                {subCfg.options.map((opt) => (
                                  <button
                                    key={opt}
                                    onClick={() => subCfg.handler(String(opt))}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'background 0.15s, color 0.15s',
                                      background: subCfg.value === String(opt) ? 'rgba(25,118,210,0.1)' : 'var(--color-background-secondary)',
                                      color: subCfg.value === String(opt) ? '#1976D2' : 'var(--color-text-primary)',
                                      border: subCfg.value === String(opt) ? '2px solid #1976D2' : '2px solid transparent',
                                      boxShadow: 'none',
                                    }}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        colorScheme="blue"
                        alignSelf="flex-start"
                        onClick={() => router.push('/login')}
                      >
                        Sign in to purchase
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

      </div>
    </PageWrapper>
  )
}

export default PackShop
