import { Alert, AlertIcon } from '@chakra-ui/react'
import AddCardsToUsersForm from '@components/admin-scripts/AddCardsToUsersForms'
import AddPacksToUsersForm from '@components/admin-scripts/AddPacksToUsersForm'
import RequestBaseCardsForm from '@components/admin-scripts/RequestBaseCardsForm'
import { PageWrapper } from '@components/common/PageWrapper'
import { useRedirectIfNotAuthenticated } from '@hooks/useRedirectIfNotAuthenticated'
import { useRedirectIfNotAuthorized } from '@hooks/useRedirectIfNotAuthorized'
import { Select } from '@components/common/Select'
import { useState } from 'react'
import RequestCustomCardsForm from '@components/admin-scripts/RequestCustomCardsForm'
import UploadDraftClassForm from '@components/admin-scripts/UploadDraftClassForm'

type ScriptId =
  | 'add-cards-to-users'
  | 'add-packs-to-users'
  | 'request-draft-class'
  | 'upload-draft-class'
  | 'request-custom-cards'
// | 'request-charity-card'
// | 'delete-duplicates'

type ScriptData = {
  id: ScriptId
  name: string
}

const scripts: ScriptData[] = [
  { id: 'add-cards-to-users', name: 'Add Cards to Users' },
  { id: 'add-packs-to-users', name: 'Add Packs to Users' },
  { id: 'request-draft-class', name: 'Request Draft Class' },
  { id: 'upload-draft-class', name: 'Upload Card Set' },
  { id: 'request-custom-cards', name: 'Request Custom Cards' },
  // { id: 'request-charity-card', name: 'Request Charity Card' },
  // { id: 'delete-duplicates', name: 'Delete Duplicate Cards' },
] as const

export default function AdminScriptsPage() {
  const [selectedScript, setSelectedScript] = useState<ScriptId>(scripts[0].id)
  const [formError, setFormError] = useState<string>('')

  const { isCheckingAuthentication } = useRedirectIfNotAuthenticated()
  const { isCheckingAuthorization } = useRedirectIfNotAuthorized({
    roles: ['DOTTS_ADMIN', 'PORTAL_MANAGEMENT'],
  })

  const optionsMap = new Map<ScriptId, string>(
    scripts.map((script) => [script.id, script.name])
  )

  return (
    <PageWrapper
      loading={isCheckingAuthentication || isCheckingAuthorization}
      className="h-full flex flex-col justify-center items-center w-11/12 md:w-3/4"
    >
      <div className="border-grey100 !text-grey100">
        <Select
          options={scripts.map((script) => script.id)}
          selectedOption={selectedScript}
          onSelection={(option) => setSelectedScript(option)}
          optionsMap={optionsMap}
          optionClassName="hover:bg-highlighted/40"
          dark={false}
        />
      </div>

      {formError && (
        <Alert className="text-white" status="error">
          <AlertIcon />
          {formError}
        </Alert>
      )}

      <div className="mt-6">
        {selectedScript === 'add-cards-to-users' && (
          <AddCardsToUsersForm onError={setFormError} />
        )}
        {selectedScript === 'add-packs-to-users' && (
          <AddPacksToUsersForm onError={setFormError} />
        )}
        {/* {selectedScript === 'delete-duplicates' && (
          <DeleteDuplicateCardsForm onError={setFormError} />
        )} */}
        {selectedScript === 'request-draft-class' && (
          <RequestBaseCardsForm onError={setFormError} />
        )}
        {selectedScript === 'upload-draft-class' && (
          <UploadDraftClassForm onError={setFormError} />
        )}
        {selectedScript === 'request-custom-cards' && (
          <RequestCustomCardsForm onError={setFormError} />
        )}
      </div>
    </PageWrapper>
  )
}
