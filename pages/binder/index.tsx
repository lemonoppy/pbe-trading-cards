import React from 'react'
import { PageWrapper } from '@components/common/PageWrapper'
import BinderTables from '@components/tables/BinderTable'
import { BINDER_CONSTANTS } from '../../lib/constants'
import { NextSeo } from 'next-seo'

const BinderPage = () => {
  return (
    <PageWrapper>
      <NextSeo title="Binder" />
      <div className="border-b-8 border-b-blue700 bg-secondary p-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-bold text-secondaryText sm:text-xl">
            Welcome to the Dotts Binders
          </h1>
          <span className="text-sm text-secondary">
            {`You can create up to  ${BINDER_CONSTANTS.MAX_BINDERS} binders with a maximum of ${BINDER_CONSTANTS.TOTAL_POSITIONS} cards per binder.`}
          </span>
        </div>
      </div>
      <BinderTables />
    </PageWrapper>
  )
}

export default BinderPage