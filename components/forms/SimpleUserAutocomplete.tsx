import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useDebounce } from 'use-debounce'
import { useSession } from 'contexts/AuthContext'
import {
  Alert,
  AlertIcon,
  Button,
  FormControl,
  FormLabel,
  Input,
  Text,
} from '@chakra-ui/react'
import { query } from '@pages/api/database/query'
import { ApiResponse } from '@pages/api/v3'
import axios from 'axios'
import { GET } from '@constants/http-methods'

export type AutocompleteOption = { label: string; value: string }

type SimpleUserData = {
  uid: number
  username: string
}

export default function SimpleUserAutocomplete({
  label,
  onSelect,
}: {
  label: string
  onSelect: (userId: string, username: string) => void
}) {
  const { session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [inputText, setInputText] = useState<string>('')
  const [debouncedUsername] = useDebounce(inputText, 300)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch all users once from Portal API (cached for 24 hours on server)
  // Note: query<T> returns { payload: T, ... }, so we use SimpleUserData[] not ApiResponse<SimpleUserData[]>
  const { payload: allUsers, isLoading: isLoadingAllUsers, isError } = query<SimpleUserData[]>({
    queryKey: ['all-users-simple'],
    queryFn: () =>
      axios({
        method: GET,
        url: '/api/v3/user/all-users',
        headers: { Authorization: `Bearer ${session?.token}` },
      }),
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours client-side
    cacheTime: 25 * 60 * 60 * 1000, // Keep in memory for 25 hours
    enabled: !!session?.token,
    refetchOnWindowFocus: false,
  })

  // Debug query state
  useEffect(() => {
    console.log('SimpleUserAutocomplete: Query state:', {
      hasSession: !!session,
      hasToken: !!session?.token,
      isLoading: isLoadingAllUsers,
      isError: isError,
      queryEnabled: !!session?.token,
      usersReceived: allUsers?.length || 0,
    })
  }, [session, isLoadingAllUsers, isError, allUsers])

  // Search locally through cached users
  const userOptions: AutocompleteOption[] = useMemo(() => {
    if (!debouncedUsername || debouncedUsername.length < 2) {
      return []
    }

    if (!allUsers || allUsers.length === 0) {
      return []
    }

    const searchTerm = debouncedUsername.toLowerCase()
    const filtered = allUsers.filter((user) =>
      user.username.toLowerCase().includes(searchTerm)
    )

    return filtered
      .map((user) => ({
        label: user.username,
        value: String(user.uid),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 50) // Limit to 50 results for performance
  }, [debouncedUsername, allUsers])

  const isLoading = isLoadingAllUsers && debouncedUsername?.length >= 2

  const handleFocusInput = () => {
    setIsOpen(true)
  }

  const handleChangeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(event.target.value)
    setIsOpen(true)
  }

  const handleClickButton = (option: AutocompleteOption) => {
    if (inputRef.current) {
      inputRef.current.value = option.label
    }
    setInputText(option.label)
    onSelect(option.value, option.label)
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
            ) : userOptions.length === 0 ? (
              <div className="px-6 py-4 text-gray-400 text-base">
                No users found matching "{debouncedUsername}"
              </div>
            ) : (
              <>
                <div className="px-4 py-2 bg-highlighted/20 border-b border-gray-600 text-xs text-gray-400 uppercase tracking-wide">
                  {userOptions.length} user
                  {userOptions.length !== 1 ? 's' : ''} found
                </div>
                {userOptions.map((option) => (
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
