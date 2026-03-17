import React, { useMemo } from 'react'
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Table } from '@components/tables/Table'
import { TableHeader } from '@components/tables/TableHeader'
import { simpleGlobalFilterFn } from '@components/tables/shared'

type DraftClassCardResult = {
  playerID: number | null
  playerName: string
  team: string
  rarity: string
  subType: string | null
  season: number
  success: boolean
  error?: string
}

const columnHelper = createColumnHelper<DraftClassCardResult>()

interface UploadDraftClassResultsTableProps {
  data: DraftClassCardResult[]
  title: string
}

export default function UploadDraftClassResultsTable({
  data,
  title,
}: UploadDraftClassResultsTableProps) {
  const columns = useMemo(() => [
    columnHelper.accessor('success', {
      header: () => <TableHeader title="status">Status</TableHeader>,
      cell: (props) => (
        <span className={props.getValue() ? 'text-green-500' : 'text-red-500'}>
          {props.getValue() ? '✓ Success' : '✗ Failed'}
        </span>
      ),
      enableGlobalFilter: false,
    }),
    columnHelper.accessor('playerName', {
      header: () => <TableHeader title="playerName">Player Name</TableHeader>,
      enableSorting: true,
      enableGlobalFilter: true,
    }),
    columnHelper.accessor('team', {
      header: () => <TableHeader title="team">Team</TableHeader>,
      enableGlobalFilter: true,
    }),
    columnHelper.accessor('playerID', {
      header: () => <TableHeader title="playerID">Player ID</TableHeader>,
      enableGlobalFilter: true,
    }),
    columnHelper.accessor('rarity', {
      header: () => <TableHeader title="rarity">Rarity</TableHeader>,
      enableGlobalFilter: true,
    }),
    columnHelper.accessor('subType', {
      header: () => <TableHeader title="subType">Sub Type</TableHeader>,
      cell: (props) => props.getValue() || '-',
      enableGlobalFilter: true,
    }),
    columnHelper.accessor('season', {
      header: () => <TableHeader title="season">Season</TableHeader>,
      enableGlobalFilter: false,
    }),
    columnHelper.accessor('error', {
      header: () => <TableHeader title="error">Error</TableHeader>,
      cell: (props) => (
        <span className="text-red-500">{props.getValue() || '-'}</span>
      ),
      enableGlobalFilter: true,
    }),
  ], [])

  const table = useReactTable({
    columns,
    data: data ?? [],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableGlobalFilter: true,
    globalFilterFn: simpleGlobalFilterFn,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      sorting: [{ id: 'success', desc: false }], // Show failures first
      pagination: {
        pageSize: 20,
      },
    },
  })

  return (
    <div className="my-4">
      <h3 className="text-lg font-bold mb-2">{title} - {data.length}</h3>
      <Table<DraftClassCardResult>
        table={table}
        tableBehavioralFlags={{
          stickyFirstColumn: false,
          showTableFooter: false,
          enablePagination: true,
          enableFiltering: true,
          showTableFilterOptions: false,
        }}
      />
    </div>
  )
}
