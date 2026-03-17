import React from 'react'
import { Box, VStack, Flex, Badge, SimpleGrid } from '@chakra-ui/react'

interface TradeSummaryBoxProps {
  title: string
  totalCards: number
  cardsByRarity: Record<string, number>
  cardsBySubType?: Record<string, number>
}

export const TradeSummaryBox: React.FC<TradeSummaryBoxProps> = ({
  title,
  totalCards,
  cardsByRarity,
  cardsBySubType,
}) => (
  <Box mb={3} rounded="lg" shadow="md" overflow="hidden" borderWidth="1px">
    <VStack spacing={2} p={2} align="stretch">
      <Flex align="center" justify="space-between">
        <div className="text-sm font-semibold text-secondary">{title}</div>
        <Badge colorScheme="blue" fontSize="sm" px={2}>
          {totalCards}
        </Badge>
      </Flex>

      {Object.keys(cardsByRarity).length > 0 && (
        <Box>
          <div className="text-xs font-semibold text-secondary mb-1">By Rarity</div>
          <SimpleGrid columns={{ base: 3, sm: 5 }}>
            {Object.entries(cardsByRarity).map(([rarity, count]) => (
              <Flex
                key={rarity}
                justify="space-between"
                px={2}
                py={1}
                border="1px solid"
                borderColor="gray.300"
                borderRadius="md"
              >
                <div className="text-xs">{rarity}</div>
                <div className="text-xs font-medium">{count}</div>
              </Flex>
            ))}
          </SimpleGrid>
        </Box>
      )}

      {cardsBySubType && Object.keys(cardsBySubType).length > 0 && (
        <Box>
          <div className="text-xs font-semibold text-secondary mb-1">By Type</div>
          <SimpleGrid columns={{ base: 3, sm: 5 }}>
            {Object.entries(cardsBySubType).map(([subType, count]) => (
              <Flex
                key={subType}
                justify="space-between"
                px={2}
                py={1}
                border="1px solid"
                borderColor="gray.300"
                borderRadius="md"
              >
                <div className="text-xs">{subType}</div>
                <div className="text-xs font-medium">{count}</div>
              </Flex>
            ))}
          </SimpleGrid>
        </Box>
      )}
    </VStack>
  </Box>
)
export default TradeSummaryBox
