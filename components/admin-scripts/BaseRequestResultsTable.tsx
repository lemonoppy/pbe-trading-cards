import React, { useMemo } from 'react'
import { BaseRequest } from '@pages/api/v3/cards/base-requests'
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

const columnHelper = createColumnHelper<BaseRequest>()

interface BaseRequestResultsTableProps {
  data: BaseRequest[]
  title: string
  showError?: boolean
}

export default function BaseRequestResultsTable({
  data,
  title,
  showError = false
}: BaseRequestResultsTableProps) {
  const columns = useMemo(() => {
    const baseColumns = [
      columnHelper.accessor('playerName', {
        header: () => <TableHeader title="playerName">Player Name</TableHeader>,
        enableSorting: true,
        enableGlobalFilter: true,
      }),
      columnHelper.accessor('teamID', {
        header: () => <TableHeader title="teamID">Team ID</TableHeader>,
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
      columnHelper.accessor('season', {
        header: () => <TableHeader title="season">Season</TableHeader>,
        enableGlobalFilter: false,
      }),
      columnHelper.accessor('renderName', {
        header: () => <TableHeader title="renderName">Render Name</TableHeader>,
        enableGlobalFilter: true,
      }),
    ]

    if (showError) {
      baseColumns.push(
        columnHelper.accessor('error', {
          header: () => <TableHeader title="error">Error</TableHeader>,
          cell: (props) => (
            <span className="text-red-500">{props.getValue() || '-'}</span>
          ),
          enableGlobalFilter: true,
        })
      )
    }

    return baseColumns
  }, [showError])

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
      sorting: [{ id: 'playerName', desc: false }],
      pagination: {
        pageSize: 20,
      },
    },
  })

  return (
    <div className="my-4">
      <h3 className="text-lg font-bold mb-2">{title} - {data.length}</h3>
      <Table<BaseRequest>
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
