import {
  Switch,
  Table,
  TableContainer,
  Tbody,
  Th,
  Thead,
  Tr,
  useToast,
  Input,
} from '@chakra-ui/react'
import Td from '@components/table/Td'
import { PageWrapper } from '@components/common/PageWrapper'
import { useRedirectIfNotAuthenticated } from '@hooks/useRedirectIfNotAuthenticated'
import { useRedirectIfNotAuthorized } from '@hooks/useRedirectIfNotAuthorized'
import { PATCH, GET } from '@constants/http-methods'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { packService } from 'services/packService'
import { useSession } from 'contexts/AuthContext'

type PackConfig = {
  packtype: string
  enabled: boolean
  daily_limit: number
  subscription_enabled: boolean
  price: number
  updated_at: string
}

export default function AdminPacksPage() {
  const [configs, setConfigs] = useState<PackConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const { isCheckingAuthentication } = useRedirectIfNotAuthenticated()
  const { isCheckingAuthorization } = useRedirectIfNotAuthorized({
    roles: ['DOTTS_ADMIN', 'PORTAL_MANAGEMENT'],
  })

  const { session } = useSession()
  const toast = useToast()

  useEffect(() => {
    if (!session?.token) return
    axios({
      method: GET,
      url: '/api/v3/admin/pack-config',
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((res) => setConfigs(res.data))
      .catch(() =>
        toast({
          title: 'Failed to load pack config',
          status: 'error',
          duration: 3000,
        })
      )
      .finally(() => setIsLoading(false))
  }, [session?.token])

  const updateConfig = async (
    packtype: string,
    patch: Partial<Pick<PackConfig, 'enabled' | 'daily_limit' | 'subscription_enabled' | 'price'>>
  ) => {
    // Optimistically update UI
    setConfigs((prev) =>
      prev.map((c) => (c.packtype === packtype ? { ...c, ...patch } : c))
    )

    const authHeader = { Authorization: `Bearer ${session?.token}` }

    try {
      const { data } = await axios({
        method: PATCH,
        url: `/api/v3/admin/pack-config/${packtype}`,
        headers: authHeader,
        data: patch,
      })
      setConfigs((prev) =>
        prev.map((c) => (c.packtype === packtype ? data : c))
      )
      toast({
        title: `${packtype} pack updated`,
        status: 'success',
        duration: 2000,
      })
    } catch {
      // Reload on error to restore actual state
      axios({ method: GET, url: '/api/v3/admin/pack-config', headers: authHeader })
        .then((res) => setConfigs(res.data))
      toast({
        title: `Failed to update ${packtype} pack`,
        status: 'error',
        duration: 3000,
      })
    }
  }

  return (
    <PageWrapper
      loading={isCheckingAuthentication || isCheckingAuthorization}
      className="h-full flex flex-col justify-center items-center w-11/12 md:w-3/4"
    >
      <p>Pack Configuration</p>
      <div className="rounded border border-1 border-inherit mt-4 w-full">
        <TableContainer>
          <Table variant="cardtable" className="mt-4" size="md">
            <Thead>
              <Tr>
                <Th>Pack</Th>
                <Th>Price</Th>
                <Th>Enabled</Th>
                <Th>Subscription Enabled</Th>
                <Th>Daily Limit</Th>
                <Th>Last Updated</Th>
              </Tr>
            </Thead>
            <Tbody>
              {configs.map((config, index) => {
                const packInfo = packService.packs[config.packtype]
                return (
                  <Tr
                    key={config.packtype}
                    className={`transition-colors ${
                      index % 2 === 0
                        ? 'bg-secondary/30 hover:bg-secondary/50'
                        : 'bg-primary hover:bg-highlighted/20'
                    }`}
                  >
                    <Td isLoading={isLoading}>
                      {packInfo?.label ?? config.packtype}
                    </Td>
                    <Td isLoading={isLoading}>
                      <Input
                        type="number"
                        value={config.price}
                        min={0}
                        className="font-mont !bg-primary !text-secondary w-28"
                        onChange={(e) => {
                          const val = parseInt(e.target.value)
                          if (!isNaN(val) && val >= 0) {
                            updateConfig(config.packtype, { price: val })
                          }
                        }}
                      />
                    </Td>
                    <Td isLoading={isLoading}>
                      <Switch
                        isChecked={config.enabled}
                        onChange={(e) =>
                          updateConfig(config.packtype, {
                            enabled: e.target.checked,
                          })
                        }
                      />
                    </Td>
                    <Td isLoading={isLoading}>
                      <Switch
                        isChecked={config.subscription_enabled}
                        onChange={(e) =>
                          updateConfig(config.packtype, {
                            subscription_enabled: e.target.checked,
                          })
                        }
                      />
                    </Td>
                    <Td isLoading={isLoading}>
                      <Input
                        type="number"
                        value={config.daily_limit}
                        min={1}
                        className="font-mont !bg-primary !text-secondary w-20"
                        onChange={(e) => {
                          const val = parseInt(e.target.value)
                          if (!isNaN(val) && val >= 1) {
                            updateConfig(config.packtype, { daily_limit: val })
                          }
                        }}
                      />
                    </Td>
                    <Td isLoading={isLoading}>
                      {new Date(config.updated_at).toLocaleString()}
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </TableContainer>
      </div>
    </PageWrapper>
  )
}
