import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useDebounce } from 'use-debounce'
import { useSession } from 'contexts/AuthContext'
import { UserData } from '@pages/api/v3/user'
import {
  Alert,
  AlertIcon,
  Button,
  FormControl,
  FormLabel,
  Input,
  Text,
} from '@chakra-ui/react'
import { useQueryClient } from 'react-query'
import { query } from '@pages/api/database/query'
import { ListResponse } from '@pages/api/v3'
import axios from 'axios'
import { GET } from '@constants/http-methods'

export type AutocompleteOption = { label: string; value: string }

export default function Autocomplete({
  label,
  onSelect,
}: {
  label: string
  onSelect: (s: string) => void
}) {
  const { session } = useSession()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [inputText, setInputText] = useState<string>('')
  const [debouncedUsername] = useDebounce(inputText, 300)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch all users with cards once and cache for 10 minutes
  // This query runs once and is reused for all searches
  const { payload: allUsersWithCards, isLoading: isLoadingAllUsers } = query<
    ListResponse<UserData>
  >({
    queryKey: ['all-users-with-cards'],
    queryFn: () =>
      axios({
        method: GET,
        url: '/api/v3/user/with-cards',
        headers: { Authorization: `Bearer ${session?.token}` },
        params: {
          limit: 1000, // Fetch a large batch
          // Don't pass username parameter at all to get all users
        },
      }),
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    cacheTime: 15 * 60 * 1000, // Keep in memory for 15 minutes
    enabled: !!session?.token,
    refetchOnWindowFocus: false, // Don't refetch when user comes back to tab
  })

  // Search locally through cached users
  const usersWithCardsOptions: AutocompleteOption[] = useMemo(() => {
    if (!debouncedUsername || debouncedUsername.length < 2) {
      return []
    }

    if (!allUsersWithCards?.rows) {
      return []
    }

    const searchTerm = debouncedUsername.toLowerCase()
    const filtered = allUsersWithCards.rows.filter((user) =>
      user.username.toLowerCase().includes(searchTerm)
    )

    return filtered
      .map((user) => ({
        label: user.username,
        value: String(user.uid),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 50) // Limit to 50 results for performance
  }, [debouncedUsername, allUsersWithCards])

  const isLoading = isLoadingAllUsers && debouncedUsername?.length >= 2

  const handleFocusInput = () => {
    setIsOpen(true)
  }

  const handleChangeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(event.target.value)
    setIsOpen(true)
  }

  const handleClickButton = (newOption: AutocompleteOption) => {
    if (inputRef.current) {
      inputRef.current.value = newOption.label
    }
    setInputText(newOption.label)
    onSelect(newOption.value)
    setIsOpen(false)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="relative mb-6">
      <FormControl className="w-full md:w-1/2 lg:w-1/3">
        <FormLabel className="text-secondaryText font-semibold mb-2">
          {label}
        </FormLabel>
        <Input
          ref={inputRef}
          onFocus={handleFocusInput}
          onChange={handleChangeInput}
          value={inputText}
          placeholder="Search for a user..."
          className="!bg-secondary !text-primary border-2 border-gray-600 focus:border-blue-500 text-lg"
          size="lg"
        />
        {isOpen && debouncedUsername?.length >= 2 && (
          <div
            ref={dropdownRef}
            className="absolute w-full md:w-1/2 lg:w-1/3 bg-secondary border-2 border-gray-600 shadow-2xl z-50 max-h-80 overflow-y-auto mt-1 rounded-md"
          >
            {isLoading ? (
              <div className="px-6 py-4 text-gray-400 text-base flex items-center gap-3">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                Searching...
              </div>
            ) : usersWithCardsOptions.length === 0 ? (
              <div className="px-6 py-4 text-gray-400 text-base">
                No users found matching "{debouncedUsername}"
              </div>
            ) : (
              <>
                <div className="px-4 py-2 bg-highlighted/20 border-b border-gray-600 text-xs text-gray-400 uppercase tracking-wide">
                  {usersWithCardsOptions.length} user
                  {usersWithCardsOptions.length !== 1 ? 's' : ''} found
                </div>
                {usersWithCardsOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant="ghost"
                    color="secondaryText"
                    _hover={{
                      bg: 'highlighted',
                    }}
                    _active={{
                      bg: 'blue.700',
                    }}
                    className="w-full rounded-none text-left px-6 py-4 text-base font-medium hover:bg-highlighted transition-colors duration-150"
                    onClick={() => handleClickButton(option)}
                    justifyContent="flex-start"
                  >
                    {option.label}
                  </Button>
                ))}
              </>
            )}
          </div>
        )}
      </FormControl>
      {inputText?.length > 0 && inputText?.length < 2 && (
        <Alert className="mt-3 w-full md:w-1/2 lg:w-1/3 !bg-secondary" status="info" variant="left-accent">
          <AlertIcon />
          <Text className="text-sm text-secondaryText">Type at least 2 characters to search</Text>
        </Alert>
      )}
    </div>
  )
}
