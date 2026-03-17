import OpenPackModal from '@components/modals/OpenPackModal'
import { packService } from 'services/packService'
import useOpenPack from '@pages/api/mutations/use-open-pack'
import React, { useMemo, useState, KeyboardEvent } from 'react'
import Router from 'next/router'
import { NextSeo } from 'next-seo'
import { UserPacks } from '@pages/api/v3'
import { PageWrapper } from '@components/common/PageWrapper'
import { GET } from '@constants/http-methods'
import { query } from '@pages/api/database/query'
import axios from 'axios'
import { Skeleton, useToast, Text, Heading, Box } from '@chakra-ui/react'
import { UserData } from '@pages/api/v3/user'
import { useSession } from 'contexts/AuthContext'
import { errorToastOptions, warningToastOptions } from '@utils/toast'
import Image from 'next/image'
import { getPackLabel } from '@utils/get-pack-label'
import Link from 'next/link'

export type UserPackWithCover = UserPacks & {
  cover: string
}

const getPackCover = (pack: UserPacks): string => {
  if (pack.packtype === 'base') return packService.basePackCover()
  if (pack.packtype === 'ruby') return packService.rubyPackCover()
  if (pack.packtype === 'throwback') return packService.throwbackPackCover()
  if (pack.packtype === 'event') return packService.eventPackCover()
  return packService.basePackCover()
}

const OpenPacks = () => {
  const toast = useToast()
  const [showModal, setShowModal] = useState<boolean>(false)
  const [modalPack, setModalPack] = useState<UserPackWithCover>(null)
  const [selectedPackType, setSelectedPackType] = useState<string>('all')
  const { session, loggedIn } = useSession()

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

  const { payload: packs, isLoading: packsLoading } = query<UserPacks[]>({
    queryKey: ['packs', String(user?.uid)],
    queryFn: () =>
      axios({
        method: GET,
        url: `/api/v3/packs/${user?.uid}`,
      }),
    enabled: !!user?.uid,
  })

  const packsWithCovers = useMemo(() => {
    if (!packs) return []
    return packs.map((pack) => ({ ...pack, cover: getPackCover(pack) }))
  }, [packs])

  const packCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const pack of packsWithCovers) {
      counts[pack.packtype] = (counts[pack.packtype] || 0) + 1
    }
    return counts
  }, [packsWithCovers])

  const totalPacks = useMemo(
    () => Object.values(packCounts).reduce((a, b) => a + b, 0),
    [packCounts]
  )

  const availableTypes = useMemo(
    () => Object.keys(packCounts).filter((t) => packCounts[t] > 0),
    [packCounts]
  )

  const filteredPacks = useMemo(() => {
    if (!packsWithCovers) return []
    if (selectedPackType === 'all') return packsWithCovers
    return packsWithCovers.filter((pack) => pack.packtype === selectedPackType)
  }, [packsWithCovers, selectedPackType])

  const {
    openPack,
    isSuccess: useOpenPackIsSuccess,
    isLoading: useOpenPackIsLoading,
    isError: useOpenPackIsError,
  } = useOpenPack()

  const handleSelectedPack = (pack: UserPackWithCover) => {
    setModalPack(pack)
    setShowModal(true)
  }

  const handleOpenPack = (packID: number) => {
    if (useOpenPackIsLoading) {
      toast({
        title: 'Already opening a pack',
        description: `Bro chill we're still opening that pack`,
        ...warningToastOptions,
      })
      return
    }
    openPack({ packID: packID, packType: modalPack.packtype })
  }

  const handleKeyPress = (
    event: KeyboardEvent<HTMLButtonElement>,
    pack: UserPackWithCover
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleSelectedPack(pack)
    }
  }

  if (useOpenPackIsSuccess) {
    Router.push(`/packs/last-pack?type=${modalPack.packtype}`)
  }

  React.useEffect(() => {
    if (useOpenPackIsError) {
      toast({
        title: 'Pack Opening Error',
        description: 'Unable to open the pack. Please try again.',
        ...errorToastOptions,
      })
    }
  }, [useOpenPackIsError])

  const isLoading = useridLoading || packsLoading

  return (
    <PageWrapper>
      <NextSeo title="Open Packs" />
      <div className="m-2">
        {/* Header banner */}
        <div
          className="w-full max-w-4xl mx-auto mt-8 mb-6 rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 40%, #0f2244 100%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.07)',
            position: 'relative',
          }}
        >
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at 15% 60%, rgba(25,118,210,0.18) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(66,165,245,0.1) 0%, transparent 45%)',
          }} />
          <div className="relative flex flex-col sm:flex-row items-stretch">
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
                Open Packs
              </Heading>
              {!isLoading && availableTypes.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {availableTypes.map((type) => (
                    <span
                      key={type}
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '999px',
                        padding: '2px 10px',
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.65)',
                        fontWeight: 500,
                      }}
                    >
                      {packCounts[type]} {packService.packs[type]?.label ?? type}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div
              className="hidden sm:block"
              style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '20px 0' }}
            />

            <div className="flex flex-col justify-center items-center px-8 py-7 gap-1 sm:min-w-[160px]">
              <Text
                fontSize="10px"
                fontWeight="bold"
                style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.18em' }}
              >
                Total Packs
              </Text>
              {isLoading ? (
                <Skeleton w="60px" h="36px" />
              ) : (
                <Text
                  fontWeight="bold"
                  style={{ color: 'white', fontSize: 'clamp(1.5rem, 3vw, 2rem)', letterSpacing: '-0.02em' }}
                >
                  {totalPacks}
                </Text>
              )}
            </div>
          </div>
        </div>

        <div className="w-full max-w-4xl mx-auto px-4">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} borderRadius="xl" aspectRatio="3/4" h="220px" />
              ))}
            </div>
          ) : packsWithCovers.length === 0 ? (
            <div
              className="rounded-2xl flex flex-col items-center justify-center py-16 px-8 text-center"
              style={{
                border: '1px solid rgba(128,128,128,0.15)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              }}
            >
              <Text fontSize="4xl" mb={3}>📦</Text>
              <Heading as="h2" size="md" className="text-primary mb-2">
                No packs to open
              </Heading>
              <Text fontSize="sm" className="!text-tertiary" mb={5}>
                Head to the shop to pick up some packs.
              </Text>
              <Link href="/shop">
                <Box
                  as="span"
                  px={5}
                  py={2}
                  borderRadius="lg"
                  fontSize="sm"
                  fontWeight="semibold"
                  style={{
                    background: '#1976D2',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Go to Shop
                </Box>
              </Link>
            </div>
          ) : (
            <>
              {/* Filter pills */}
              {availableTypes.length > 1 && (
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  <Text fontSize="sm" fontWeight="semibold" className="!text-secondary" flexShrink={0}>
                    Filter:
                  </Text>
                  {['all', ...availableTypes].map((type) => {
                    const isSelected = selectedPackType === type
                    const label = type === 'all'
                      ? `All (${totalPacks})`
                      : `${packService.packs[type]?.label ?? type} (${packCounts[type]})`
                    return (
                      <button
                        key={type}
                        onClick={() => setSelectedPackType(type)}
                        style={{
                          padding: '4px 14px',
                          borderRadius: '999px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background 0.15s, color 0.15s',
                          background: isSelected ? 'rgba(25,118,210,0.1)' : 'var(--color-background-secondary)',
                          color: isSelected ? '#1976D2' : 'var(--color-text-primary)',
                          border: isSelected ? '2px solid #1976D2' : '2px solid transparent',
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Pack grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredPacks.map((pack, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectedPack(pack)}
                    onKeyDown={(e) => handleKeyPress(e, pack)}
                    className="group focus:outline-none"
                    aria-label={`Open ${getPackLabel(pack.packtype)} pack ${index + 1} of ${filteredPacks.length}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{
                        border: '1px solid rgba(128,128,128,0.15)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'
                        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                    >
                      <Image
                        className="select-none w-full"
                        src={pack.cover}
                        alt={`${getPackLabel(pack.packtype)} trading card pack`}
                        layout="responsive"
                        width={600}
                        height={800}
                        style={{ objectFit: 'contain', display: 'block' }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {showModal && (
          <OpenPackModal
            onAccept={handleOpenPack}
            setShowModal={setShowModal}
            pack={modalPack}
            onError={useOpenPackIsError}
          />
        )}
      </div>
    </PageWrapper>
  )
}

export default OpenPacks
