import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@chakra-ui/react'
import { PageWrapper } from '@components/common/PageWrapper'
import MostCards from '@components/tables/MostCards'
import UsersCollection from '@components/tables/UsersCollection'
import UserTables from '@components/tables/UserTable'
import { NextSeo } from 'next-seo'

export default function CommunityPage() {
  return (
    <PageWrapper>
      <NextSeo title="Community" />
      <Tabs isFitted variant="enclosed-colored" isLazy>
        <TabList>
          <Tab
            _selected={{
              borderBottomColor: 'blue.600',
            }}
            className="!bg-primary !text-secondary !border-b-4"
          >
            Search Users
          </Tab>
          <Tab
            _selected={{
              borderBottomColor: 'blue.600',
            }}
            className="!bg-primary !text-secondary !border-b-4"
          >
            Most Cards
          </Tab>
          <Tab
            _selected={{
              borderBottomColor: 'blue.600',
            }}
            className="!bg-primary !text-secondary !border-b-4"
          >
            Users Collections
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <UserTables />
          </TabPanel>
          <TabPanel>
            <MostCards />
          </TabPanel>
          <TabPanel>
            <UsersCollection />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </PageWrapper>
  )
}
