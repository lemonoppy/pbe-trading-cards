import { useMutation, useQueryClient } from 'react-query'
import axios, { AxiosResponse } from 'axios'
import { POST } from '@constants/http-methods'
import { useSession } from 'contexts/AuthContext'
import { useToast } from '@chakra-ui/react'
import { errorToastOptions, successToastOptions } from '@utils/toast'

type UseUpdateSubscriptionRequest = {
  uid: number
  subscriptionAmount: number
  isRuby?: boolean
  label?: string
}

type UseUpdateSubscription = {
  updateSubscription: (UseUpdateSubscriptionRequest) => void
  response: AxiosResponse
  isSuccess: boolean
  isLoading: boolean
  isError: any
}

const useUpdateSubscription = (): UseUpdateSubscription => {
  const { session } = useSession()
  const queryClient = useQueryClient()
  const toast = useToast()

  const { mutate, data, error, isLoading, isSuccess } = useMutation(
    async ({ uid, subscriptionAmount, isRuby = false }: UseUpdateSubscriptionRequest) => {
      const dataKey = isRuby ? 'rubySubscription' : 'subscription'
      return await axios({
        method: POST,
        url: `/api/v3/settings/daily/${uid}`,
        data: { [dataKey]: subscriptionAmount },
        headers: { Authorization: `Bearer ${session?.token}` },
        withCredentials: true,
      })
    },
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries(['daily-subscription', String(variables.uid)])
        toast({
          title: variables.label ?? 'Subscription updated',
          ...successToastOptions,
        })
      },
      onError: (error: any) => {
        const message = error?.response?.data || 'Failed to update subscription'
        toast({
          title: 'Error updating subscription',
          description: typeof message === 'string' ? message : undefined,
          ...errorToastOptions,
        })
      },
    }
  )

  return {
    updateSubscription: mutate,
    response: data,
    isSuccess,
    isLoading,
    isError: error,
  }
}

export default useUpdateSubscription
