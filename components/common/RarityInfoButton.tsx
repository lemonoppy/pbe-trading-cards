import React from 'react'
import {
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Icon,
  Box,
  useColorModeValue,
  Portal,
} from '@chakra-ui/react'
import { InfoIcon } from '@chakra-ui/icons'
import { rarityMap, rarityMapRuby } from '@constants/rarity-map'

const RarityInfoButton = ({ packID }: { packID: string }) => {
  // Check if packID is "base" and use rarityMap accordingly
  const rarityData = packID === 'base' ? rarityMap : rarityMapRuby

  const rarityPercentages = Object.entries(rarityData)
    .map(([key, value]) => ({
      label: value.label,
      percentage: ((value.rarity / 10000) * 100).toFixed(2),
    }))
    .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage))

  const bgColor = useColorModeValue('#F8F9FA', '#212529')
  const textColor = useColorModeValue('#343A40', '#E9ECEF')

  return (
    <div className="inline-block">
      <Popover>
        <PopoverTrigger>
          <IconButton
            aria-label="Rarity information"
            icon={<Icon as={InfoIcon} />}
            size="sm"
            variant="ghost"
            colorScheme="blue"
          />
        </PopoverTrigger>
        <Portal>
          <PopoverContent
            border="none"
            _focus={{ boxShadow: 'none' }}
            zIndex={1500}
            bg={bgColor}
            borderRadius="lg"
            boxShadow="xl"
          >
            <PopoverBody p={0}>
              <Box
                p={4}
                color={textColor}
              >
              <div className="font-bold mb-2">Card Rarity Rates</div>
              {rarityPercentages.map(
                ({ label, percentage }) =>
                  percentage !== '0.00' && (
                    <div
                      key={label}
                      className="flex justify-between items-center"
                    >
                      <span className="text-sm">{label}</span>
                      <span className="text-sm">{percentage}%</span>
                    </div>
                  )
              )}
            </Box>
          </PopoverBody>
        </PopoverContent>
        </Portal>
      </Popover>
    </div>
  )
}

export default RarityInfoButton
