import React, { useEffect, useState } from 'react'
import { Raleway, Montserrat } from 'next/font/google'
import { DefaultSeo } from 'next-seo'
import SEO from '../next-seo.config'
import { AppProps } from 'next/app'
import { QueryCache, QueryClient, QueryClientProvider } from 'react-query'
import { Hydrate } from 'react-query/hydration'
import { SessionProvider, useSession } from 'contexts/AuthContext'
import { CustomChakraProvider } from 'styles/CustomChakraProvider'
import { DottsLogo } from '@components/common/DottsLogo'
import { ThemeProvider } from 'next-themes'
import { Footer } from '@components/common/Footer'
import { Spinner, ToastProvider } from '@chakra-ui/react'
import '../styles/globals.css'
import '../styles/style.css'
import '../styles/slick.css'
import '../styles/slick-theme.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: 'variable',
  style: ['normal'],
  variable: '--font-montserrat',
})

const raleway = Raleway({
  subsets: ['latin'],
  weight: 'variable',
  style: ['normal'],
  variable: '--font-raleway',
})

const AppWrappers = ({ Component, pageProps }: AppProps): JSX.Element => {
  const { isLoading } = useSession()

  useEffect(() => {
    if (
      localStorage.theme === 'dark' ||
      (!('theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      document.body.classList.add('dark')
      document.documentElement.classList.add('dark')
    } else {
      document.body.classList.add('light')
      document.documentElement.classList.add('light')
    }
  }, [])

  return (
    <Hydrate state={pageProps.dehydratedState}>
      <main
        className={`${montserrat.variable} ${raleway.variable} relative min-h-screen font-raleway`}
      >
        <DefaultSeo {...SEO} />
        <ThemeProvider
          attribute="class"
          storageKey="index-theme"
          themes={['light', 'dark']}
          value={{
            light: 'index-theme-light',
            dark: 'index-theme-dark',
          }}
          enableColorScheme={false}
        >
          <CustomChakraProvider>
            {isLoading ? (
              <>
                <div className="m-auto w-full pb-8 2xl:w-4/5">
                  <div className="m-auto flex h-[calc(100vh-10rem)] w-full items-center justify-center">
                    <Spinner size="xl" thickness="4px" />
                  </div>
                </div>
                <Footer />
              </>
            ) : (
              <Component {...pageProps} />
            )}
          </CustomChakraProvider>
        </ThemeProvider>
      </main>
    </Hydrate>
  )
}

export default function App(props: AppProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
            cacheTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
            refetchOnWindowFocus: false, // Don't refetch when switching tabs
            refetchOnMount: true, // Refetch on mount if data is stale
            retry: 1, // Only retry failed requests once
          },
        },
        queryCache: new QueryCache({
          onError: async (error: object) => {
            if ('status' in error && error.status === 401) {
              // Token refresh will be handled by SessionProvider
            }
          },
        }),
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AppWrappers {...props} />
      </SessionProvider>
    </QueryClientProvider>
  )
}
