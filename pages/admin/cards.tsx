import { ChevronDownIcon } from '@chakra-ui/icons'
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  Switch,
  Table,
  TableContainer,
  Tbody,
  Th,
  Thead,
  Tr,
  useDisclosure,
  Image,
  ModalOverlay,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
} from '@chakra-ui/react'
import DeleteCardDialog from '@components/admin-cards/DeleteCardDialog'
import RemoveCardAuthorDialog from '@components/admin-cards/RemoveCardAuthorDialog'
import RemoveCardImageDialog from '@components/admin-cards/RemoveCardImageDialog'
import UpdateCardModal from '@components/admin-cards/UpdateCardModal'
import { PermissionGuard } from '@components/auth/PermissionGuard'
import { RoleGuard } from '@components/auth/RoleGuard'
import { PageWrapper } from '@components/common/PageWrapper'
import SortIcon from '@components/table/SortIcon'
import Td from '@components/table/Td'
import TablePagination from '@components/table/TablePagination'
import { GET } from '@constants/http-methods'
import { useRedirectIfNotAuthenticated } from '@hooks/useRedirectIfNotAuthenticated'
import { useRedirectIfNotAuthorized } from '@hooks/useRedirectIfNotAuthorized'
import { query, indexAxios } from '@pages/api/database/query'
import { ListResponse, SortDirection } from '@pages/api/v3'
import axios from 'axios'
import { useState } from 'react'
import { cardService } from 'services/cardService'
import { useCookie } from '@hooks/useCookie'
import config from 'lib/config'
import SubmitImageModal from '@components/admin-cards/SubmitImageModal'
import ClaimCardDialog from '@components/admin-cards/ClaimCardDialog'
import ProcessImageDialog from '@components/admin-cards/ProcessImageDialog'
import { toggleOnfilters } from '@utils/toggle-on-filters'
import MisprintDialog from '@components/admin-cards/MisprintDialog'
import { usePermissions } from '@hooks/usePermissions'
import { Team, Rarities } from '@pages/api/v3'
import FilterDropdown from '@components/common/FilterDropdown'
import RadioGroupSelector from '@components/common/RadioGroupSelector'
import { LEAGUE_OPTIONS } from 'lib/constants'
import { getImageUrl } from '@utils/get-image-url'
import { subTypeOrder } from '@constants/rarity-map'

type ColumnName = keyof Readonly<Card>

const ROWS_PER_PAGE: number = 10 as const

const LOADING_TABLE_DATA: { rows: Card[] } = {
  rows: Array.from({ length: ROWS_PER_PAGE }, (_, index) => ({
    cardid: index,
    teamid: 0,
    playerid: 0,
    author_userid: 0,
    card_rarity: 'card_rarity',
    sub_type: 'sub_type',
    player_name: 'player_name',
    render_name: 'render_name',
    pullable: true,
    event_pullable: false,
    approved: true,
    image_url: 'image_url',
    position: 'position',
    season: 0,
    author_paid: true,
    date_approved: null,
    author_username: 'author_username',
    leagueid: 0,
  })),
} as const

export default function AdminCardsPage() {
  const [viewSkaters, setViewSkaters] = useState<boolean>(true)
  const [viewMyCards, setViewMyCards] = useState<boolean>(false)
  const [viewNeedsAuthor, setViewNeedsAuthor] = useState<boolean>(true)
  const [viewNeedsImage, setviewNeedsImage] = useState<boolean>(true)
  const [viewNeedsApproval, setviewNeedsApproval] = useState<boolean>(true)
  const [viewNeedsAuthorPaid, setviewNeedsAuthorPaid] = useState<boolean>(true)
  const [viewDone, setViewDone] = useState<boolean>(false)

  // Computed array for MenuOptionGroup
  const statusFilters = [
    viewNeedsAuthor && 'NeedsAuthor',
    viewNeedsImage && 'NeedsImage',
    viewNeedsApproval && 'NeedsApproval',
    viewNeedsAuthorPaid && 'NeedsAuthorPaid',
    viewDone && 'Done',
  ].filter(Boolean) as string[]

  const [playerName, setPlayerName] = useState<string>(null)
  const [teams, setTeams] = useState<string[]>([])
  const [teamLeagueID, setTeamLeagueID] = useState<{ [key: string]: string }>(
    {}
  )
  const [rarities, setRarities] = useState<string[]>([])
  const [subTypes, setSubTypes] = useState<string[]>([])
  const [leagueID, setLeagueID] = useState<string[]>(['0', '1', '2'])
  const [sortColumn, setSortColumn] = useState<ColumnName>('player_name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('ASC')
  const [tablePage, setTablePage] = useState<number>(1)
  const [selectedCard, setSelectedCard] = useState<Card>(null)
  const [imageUrl, setImageUrl] = useState<string>(null)
  const [cardID, setCardID] = useState<string>(null)

  const claimCardDialog = useDisclosure()
  const updateModal = useDisclosure()
  const removeAuthorDialog = useDisclosure()
  const removeImageDialog = useDisclosure()
  const submitImageModal = useDisclosure()
  const processImageDialog = useDisclosure()
  const deleteDialog = useDisclosure()
  const misprintDialog = useDisclosure()

  const [uid] = useCookie(config.userIDCookieName)

  const { permissions } = usePermissions()
  const { isCheckingAuthentication } = useRedirectIfNotAuthenticated()
  const { isCheckingAuthorization } = useRedirectIfNotAuthorized({
    roles: ['DOTTS_ADMIN', 'DOTTS_TEAM', 'PORTAL_MANAGEMENT'],
  })

  const clearAllFilters = () => {
    setTeams([])
    setRarities([])
    setSubTypes([])
  }

  const { payload: teamData, isLoading: teamDataIsLoading } = query<Team[]>({
    queryKey: ['teamData', leagueID.join(',')],
    queryFn: () =>
      axios({
        method: GET,
        url: `/api/v3/teams?league=${leagueID.join(',')}`,
      }),
  })

  const { payload: rarityData, isLoading: rarityDataisLoading } = query<
    Rarities[]
  >({
    queryKey: ['rarityData', leagueID.join(',')],
    queryFn: () =>
      axios({
        method: GET,
        url: `/api/v3/cards/rarity-map?leagueid=${leagueID}`,
      }),
  })

  const showImage = (image_url: string) => () => {
    if (image_url) {
      setImageUrl(image_url)
    }
  }
  const { payload, isLoading } = query<ListResponse<Card>>({
    queryKey: [
      'cards',
      uid,
      playerName,
      JSON.stringify(teams),
      JSON.stringify(rarities),
      JSON.stringify(subTypes),
      String(viewSkaters),
      String(viewMyCards),
      String(viewNeedsAuthor),
      String(viewNeedsImage),
      String(viewNeedsApproval),
      String(viewNeedsAuthorPaid),
      String(viewDone),
      sortColumn,
      sortDirection,
      String(tablePage),
      cardID,
      JSON.stringify(leagueID),
      JSON.stringify(teamLeagueID),
    ],
    queryFn: () =>
      axios({
        method: GET,
        url: '/api/v3/cards',
        params: {
          limit: ROWS_PER_PAGE,
          offset: Math.max((tablePage - 1) * ROWS_PER_PAGE, 0),
          userID: uid,
          playerName,
          teams: JSON.stringify(teams),
          rarities: JSON.stringify(rarities),
          subTypes: JSON.stringify(subTypes),
          viewSkaters,
          viewMyCards,
          viewNeedsAuthor,
          viewNeedsImage,
          viewNeedsApproval,
          viewNeedsAuthorPaid,
          viewDone,
          sortColumn,
          sortDirection,
          cardid: cardID,
          leagueid: JSON.stringify(leagueID),
          teamLeagueID: JSON.stringify(teamLeagueID),
        },
      }),
  })

  const handleSortChange = (columnName: ColumnName) => {
    if (columnName === sortColumn) {
      setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setSortColumn(columnName)
      setSortDirection('ASC')
    }
  }

  const toggleTeam = (team: string) => {
    setTeams((currentValue) => toggleOnfilters(currentValue, team))
  }

  const toggleRarity = (rarity: string) => {
    setRarities((currentValue) => toggleOnfilters(currentValue, rarity))
  }

  const toggleSubType = (subType: string) => {
    setSubTypes((currentValue) => toggleOnfilters(currentValue, subType))
  }

  const getLeagueID = (league: number): string => {
    return league === 0 ? 'PBE' : league === 1 ? 'MiLPBE' : String(league)
  }

  const setPlayerOrCardID = (value: string) => {
    if (/^\d+$/.test(value)) {
      // if the value is only a number
      setCardID(value)
      setPlayerName(null)
    } else {
      if (value.length > 0) {
        setPlayerName(value)
        setCardID(null)
      } else {
        setPlayerName(null)
        setCardID(null)
      }
    }
  }

  return (
    <>
      <PageWrapper
        loading={isCheckingAuthentication || isCheckingAuthorization}
        className="h-full flex flex-col justify-center items-center w-11/12 md:w-3/4"
      >
        <p>Card Management</p>
        <div className="rounded border border-1 border-inherit mt-4">
          <FormControl>
            <Input
              className="w-full bg-secondary border-grey100"
              placeholder="Search By Player Name or Card ID"
              size="lg"
              onChange={(event) => setPlayerOrCardID(event.target.value)}
            />
          </FormControl>
          <div className="m-2 flex flex-col gap-4 md:flex-row md:justify-between">
            <RadioGroupSelector
              value={leagueID}
              options={LEAGUE_OPTIONS}
              allValues={['0', '1', '2']}
              onChange={(value) => {
                setLeagueID(Array.isArray(value) ? value : [value])
                clearAllFilters()
              }}
            />
          </div>

          <div className="m-2 flex flex-col gap-4 md:flex-row md:justify-between">
            <div className="flex flex-col gap-4 md:flex-row md:space-x-2 w-full md:w-auto">
              <div className="flex flex-col gap-4 md:flex-row md:space-x-2 w-full md:w-auto">
                <FilterDropdown
                  label="Teams"
                  selectedValues={teams}
                  options={teamData || []}
                  isLoading={teamDataIsLoading}
                  onToggle={toggleTeam}
                  onDeselectAll={() => {
                    setTeams([])
                    setTeamLeagueID({})
                  }}
                  getOptionId={(team) => `${getLeagueID(team.league)}-${team.id}`}
                  getOptionValue={(team) => `${getLeagueID(team.league)}-${team.id}`}
                  getOptionLabel={(team) => `${team.location} ${team.name}`}
                />

                <FilterDropdown<Rarities>
                  label="Rarities"
                  selectedValues={rarities}
                  options={rarityData || []}
                  isLoading={rarityDataisLoading}
                  onToggle={toggleRarity}
                  onDeselectAll={() => setRarities([])}
                  getOptionId={(rarity) => rarity.card_rarity}
                  getOptionValue={(rarity) => rarity.card_rarity}
                  getOptionLabel={(rarity) => rarity.card_rarity}
                />

                <FilterDropdown<string>
                  label="Sub Types"
                  selectedValues={subTypes}
                  options={[...subTypeOrder]}
                  isLoading={false}
                  onToggle={toggleSubType}
                  onDeselectAll={() => setSubTypes([])}
                  getOptionId={(subType) => subType}
                  getOptionValue={(subType) => subType}
                  getOptionLabel={(subType) => subType}
                />
              </div>

              <FormControl>
                <Menu closeOnSelect={false}>
                  <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                    <span className="pr-2">Statuses</span>
                  </MenuButton>
                  <MenuList>
                    <MenuOptionGroup type="checkbox" value={statusFilters}>
                      <MenuItemOption
                        value="NeedsAuthor"
                        className="!bg-[transparent] hover:!bg-highlighted/40"
                        onClick={() => setViewNeedsAuthor(!viewNeedsAuthor)}
                      >
                        Author Needed
                      </MenuItemOption>
                      <MenuItemOption
                        value="NeedsImage"
                        className="!bg-[transparent] hover:!bg-highlighted/40 active:!bg-blue700"
                        onClick={() => setviewNeedsImage(!viewNeedsImage)}
                      >
                        Needs Image
                      </MenuItemOption>
                      <MenuItemOption
                        value="NeedsApproval"
                        className="!bg-[transparent] hover:!bg-highlighted/40 active:!bg-blue700"
                        onClick={() => setviewNeedsApproval(!viewNeedsApproval)}
                      >
                        Needs Approval
                      </MenuItemOption>
                      <MenuItemOption
                        value="NeedsAuthorPaid"
                        className="!bg-[transparent] hover:!bg-highlighted/40 active:!bg-blue700"
                        onClick={() =>
                          setviewNeedsAuthorPaid(!viewNeedsAuthorPaid)
                        }
                      >
                        Needs Author Paid
                      </MenuItemOption>
                      <MenuItemOption
                        value="Done"
                        className="!bg-[transparent] hover:!bg-highlighted/40 active:!bg-blue700"
                        onClick={() => setViewDone(!viewDone)}
                      >
                        Done
                      </MenuItemOption>
                    </MenuOptionGroup>
                  </MenuList>
                </Menu>
              </FormControl>
            </div>
            <div className="flex justify-end">
              <FormControl className="flex items-center m-2">
                <FormLabel className="mb-0">My Cards</FormLabel>
                <Switch onChange={() => setViewMyCards(!viewMyCards)} />
              </FormControl>
            </div>
          </div>
          <TableContainer>
            <Table variant="cardtable" className="mt-4" size="md">
              <Thead>
                <Tr>
                  <Th
                    // position="sticky"
                    left="0"
                  ></Th>
                  <Th>Status</Th>
                  <Th
                    className="cursor-pointer"
                    onClick={() => handleSortChange('player_name')}
                  >
                    <span className="flex items-center">
                      Name&nbsp;
                      {sortColumn === 'player_name' && (
                        <SortIcon sortDirection={sortDirection} />
                      )}
                    </span>
                  </Th>
                  <Th
                    className="cursor-pointer"
                    onClick={() => handleSortChange('render_name')}
                  >
                    <span className="flex items-center">
                      Render&nbsp;
                      {sortColumn === 'render_name' && (
                        <SortIcon sortDirection={sortDirection} />
                      )}
                    </span>
                  </Th>
                  <Th
                    className="cursor-pointer"
                    onClick={() => handleSortChange('cardid')}
                  >
                    <span className="flex items-center">
                      Card ID&nbsp;
                      {sortColumn === 'cardid' && (
                        <SortIcon sortDirection={sortDirection} />
                      )}
                    </span>
                  </Th>
                  <Th
                    className="cursor-pointer"
                    onClick={() => handleSortChange('playerid')}
                  >
                    <span className="flex items-center">
                      Player ID&nbsp;
                      {sortColumn === 'playerid' && (
                        <SortIcon sortDirection={sortDirection} />
                      )}
                    </span>
                  </Th>
                  <Th
                    className="cursor-pointer"
                    onClick={() => handleSortChange('teamid')}
                  >
                    <span className="flex items-center">
                      Team ID&nbsp;
                      {sortColumn === 'teamid' && (
                        <SortIcon sortDirection={sortDirection} />
                      )}
                    </span>
                  </Th>
                  <Th
                    className="cursor-pointer"
                    onClick={() => handleSortChange('author_userid')}
                  >
                    <span className="flex items-center">
                      Author&nbsp;
                      {sortColumn === 'author_username' && (
                        <SortIcon sortDirection={sortDirection} />
                      )}
                    </span>
                  </Th>
                  <Th
                    className="cursor-pointer"
                    onClick={() => handleSortChange('pullable')}
                  >
                    <span className="flex items-center">
                      Pullable&nbsp;
                      {sortColumn === 'pullable' && (
                        <SortIcon sortDirection={sortDirection} />
                      )}
                    </span>
                  </Th>
                  <Th
                    className="cursor-pointer"
                    onClick={() => handleSortChange('approved')}
                  >
                    <span className="flex items-center">
                      Approved&nbsp;
                      {sortColumn === 'approved' && (
                        <SortIcon sortDirection={sortDirection} />
                      )}
                    </span>
                  </Th>
                  <Th
                    className="cursor-pointer"
                    onClick={() => handleSortChange('author_paid')}
                  >
                    <span className="flex items-center">
                      Paid&nbsp;
                      {sortColumn === 'author_paid' && (
                        <SortIcon sortDirection={sortDirection} />
                      )}
                    </span>
                  </Th>
                  <Th>Image URL</Th>
                  <Th
                    className="cursor-pointer"
                    onClick={() => handleSortChange('card_rarity')}
                  >
                    <span className="flex items-center">
                      Rarity&nbsp;
                      {sortColumn === 'card_rarity' && (
                        <SortIcon sortDirection={sortDirection} />
                      )}
                    </span>
                  </Th>

                  <Th>Sub Type</Th>
                  <Th
                    className="cursor-pointer"
                    onClick={() => handleSortChange('season')}
                  >
                    <span className="flex items-center">
                      Season&nbsp;
                      {sortColumn === 'season' && (
                        <SortIcon sortDirection={sortDirection} />
                      )}
                    </span>
                  </Th>
                  <Th>Position</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(isLoading ? LOADING_TABLE_DATA : payload)?.rows.map(
                  (card: Card, index: number) => {
                    const disableActions = shouldDisableActions(
                      permissions.canEditCards,
                      card,
                      uid
                    )

                    return (
                      <Tr
                        key={card.cardid}
                        className={`transition-colors ${
                          index % 2 === 0
                            ? 'bg-secondary/30 hover:bg-secondary/50'
                            : 'bg-primary hover:bg-highlighted/20'
                        }`}
                      >
                        <Td
                          isLoading={isLoading}
                          // position="sticky"
                          left="0"
                        >
                          <Menu>
                            <MenuButton
                              isDisabled={disableActions}
                              className="!disabled:hover:!bg-highlighted/40"
                              as={Button}
                              rightIcon={<ChevronDownIcon />}
                            >
                              Actions
                            </MenuButton>
                            <MenuList>
                              {!card.author_userid && (
                                <RoleGuard
                                  userRoles={[
                                    'DOTTS_ADMIN',
                                    'DOTTS_TEAM',
                                    'PORTAL_MANAGEMENT',
                                  ]}
                                >
                                  <MenuItem
                                    className="hover:!bg-highlighted/40"
                                    onClick={() => {
                                      setSelectedCard(card)
                                      claimCardDialog.onOpen()
                                    }}
                                  >
                                    Claim Card
                                  </MenuItem>
                                </RoleGuard>
                              )}
                              {!card.image_url &&
                                String(card.author_userid) == uid && (
                                  <RoleGuard
                                    userRoles={[
                                      'DOTTS_ADMIN',
                                      'DOTTS_TEAM',
                                      'PORTAL_MANAGEMENT',
                                    ]}
                                  >
                                    <MenuItem
                                      className="hover:!bg-highlighted/40"
                                      onClick={() => {
                                        setSelectedCard(card)
                                        submitImageModal.onOpen()
                                      }}
                                    >
                                      Submit Image
                                    </MenuItem>
                                  </RoleGuard>
                                )}
                              {card.image_url && !card.approved && (
                                <PermissionGuard
                                  userPermissions={['canEditCards']}
                                >
                                  <MenuItem
                                    className="hover:!bg-highlighted/40"
                                    onClick={() => {
                                      setSelectedCard(card)
                                      processImageDialog.onOpen()
                                    }}
                                  >
                                    Process Image
                                  </MenuItem>
                                </PermissionGuard>
                              )}
                              <PermissionGuard
                                userPermissions={['canEditCards']}
                              >
                                <MenuItem
                                  className="hover:!bg-highlighted/40"
                                  onClick={() => {
                                    setSelectedCard(card)
                                    updateModal.onOpen()
                                  }}
                                >
                                  Update
                                </MenuItem>
                              </PermissionGuard>
                              {card.author_userid && (
                                <PermissionGuard
                                  userPermissions={['canEditCards']}
                                >
                                  <MenuItem
                                    className="hover:!bg-highlighted/40"
                                    onClick={() => {
                                      setSelectedCard(card)
                                      removeAuthorDialog.onOpen()
                                    }}
                                  >
                                    Remove Author
                                  </MenuItem>
                                </PermissionGuard>
                              )}
                              {card.image_url && (
                                <PermissionGuard
                                  userPermissions={['canEditCards']}
                                >
                                  <MenuItem
                                    className="hover:!bg-highlighted/40"
                                    onClick={() => {
                                      setSelectedCard(card)
                                      removeImageDialog.onOpen()
                                    }}
                                  >
                                    Remove Image
                                  </MenuItem>
                                </PermissionGuard>
                              )}
                              <RoleGuard userRoles={['DOTTS_ADMIN', 'PORTAL_MANAGEMENT']}>
                                <MenuItem
                                  className="hover:!bg-red200"
                                  onClick={() => {
                                    setSelectedCard(card)
                                    deleteDialog.onOpen()
                                  }}
                                >
                                  Delete
                                </MenuItem>
                              </RoleGuard>
                              <RoleGuard userRoles={['DOTTS_ADMIN', 'PORTAL_MANAGEMENT']}>
                                <MenuItem
                                  className="hover:!bg-red200"
                                  onClick={() => {
                                    setSelectedCard(card)
                                    misprintDialog.onOpen()
                                  }}
                                >
                                  Set Misprint
                                </MenuItem>
                              </RoleGuard>
                            </MenuList>
                          </Menu>
                        </Td>
                        <Td isLoading={isLoading}>
                          {cardService.calculateStatus(card)}
                        </Td>
                        <Td isLoading={isLoading}>{card.player_name}</Td>
                        <Td isLoading={isLoading}>{card.render_name}</Td>
                        <Td isLoading={isLoading}>{card.cardid}</Td>
                        <Td isLoading={isLoading}>
                          <a
                            href={`https://portal.pbe.simflow.io/player/${card.playerid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 underline hover:text-blue-600 cursor-pointer"
                          >
                            {card.playerid}
                          </a>
                        </Td>
                        <Td isLoading={isLoading}>{card.teamid}</Td>
                        <Td isLoading={isLoading}>{card.author_username || 'None'}</Td>
                        <Td isLoading={isLoading}>{card.pullable ? 'Yes' : 'No'}</Td>
                        <Td isLoading={isLoading}>{card.approved ? 'Yes' : 'No'}</Td>
                        <Td isLoading={isLoading}>{card.author_paid ? 'Yes' : 'No'}</Td>
                        <Td
                          onClick={showImage(card.image_url)}
                          isLoading={isLoading}
                        >
                          {card.image_url}
                        </Td>
                        <Td isLoading={isLoading}>{card.card_rarity}</Td>
                        <Td isLoading={isLoading}>{card.sub_type}</Td>
                        <Td isLoading={isLoading}>{card.season}</Td>
                        <Td isLoading={isLoading}>{card.position}</Td>
                      </Tr>
                    )
                  }
                )}
              </Tbody>
            </Table>
          </TableContainer>
          <TablePagination
            totalRows={payload?.total}
            rowsPerPage={ROWS_PER_PAGE}
            onPageChange={(newPage) => setTablePage(newPage)}
          />
        </div>
      </PageWrapper>
      {selectedCard && (
        <>
          <ClaimCardDialog
            card={selectedCard}
            onClose={() => {
              claimCardDialog.onClose()
              setSelectedCard(null)
            }}
            isOpen={claimCardDialog.isOpen}
          />
          <SubmitImageModal
            card={selectedCard}
            onClose={() => {
              submitImageModal.onClose()
              setSelectedCard(null)
            }}
            isOpen={submitImageModal.isOpen}
          />
          <ProcessImageDialog
            card={selectedCard}
            onClose={() => {
              processImageDialog.onClose()
              setSelectedCard(null)
            }}
            isOpen={processImageDialog.isOpen}
          />
          <UpdateCardModal
            card={selectedCard}
            onClose={() => {
              updateModal.onClose()
              setSelectedCard(null)
            }}
            isOpen={updateModal.isOpen}
          />
          <RemoveCardAuthorDialog
            card={selectedCard}
            onClose={() => {
              removeAuthorDialog.onClose()
              setSelectedCard(null)
            }}
            isOpen={removeAuthorDialog.isOpen}
          />
          <RemoveCardImageDialog
            card={selectedCard}
            onClose={() => {
              removeImageDialog.onClose()
              setSelectedCard(null)
            }}
            isOpen={removeImageDialog.isOpen}
          />
          <DeleteCardDialog
            card={selectedCard}
            onClose={() => {
              deleteDialog.onClose()
              setSelectedCard(null)
            }}
            isOpen={deleteDialog.isOpen}
          />
          <MisprintDialog
            card={selectedCard}
            onClose={() => {
              misprintDialog.onClose()
              setSelectedCard(null)
            }}
            isOpen={misprintDialog.isOpen}
          />
        </>
      )}
      {imageUrl && (
        <Modal isOpen={true} onClose={() => setImageUrl(null)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader className="bg-primary text-secondary">
              Card Image
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody className="bg-primary text-secondary">
              <Image
                src={getImageUrl(imageUrl)}
              />
            </ModalBody>
          </ModalContent>
        </Modal>
      )}
    </>
  )
}

const shouldDisableActions = (
  isAdmin: boolean,
  card: Card,
  uid: string
): boolean => {
  // admins can always edit cards
  if (isAdmin) {
    return false
  }

  // if the card needs an owner anyone should be able to claim it
  const cardNeedsOwner = !Boolean(card.author_userid)
  if (cardNeedsOwner) {
    return false
  }

  const isCardOwner = String(card.author_userid) === uid
  const isCardComplete = Boolean(card.author_paid) && Boolean(card.approved)

  if (isCardOwner) {
    //if the card still needs an image
    if (!card.image_url) {
      return false
    }
    // if the card is complete then no actions are necessary
    return isCardComplete
  } else {
    // if you are not the card owner you should not be able to do anything to it
    return true
  }
}
