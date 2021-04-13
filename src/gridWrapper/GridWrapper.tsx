import React, { CSSProperties, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  CellMeasurerCache,
  Grid as VirtualizedGrid,
  SectionRenderedParams,
} from 'react-virtualized'
import CellMeasurer from '../cellMeasurer/CellMeasureWrapper'
import { NavigationCoords } from '../keyboard'
import clsx from 'clsx'
import { GridCellProps } from 'react-virtualized/dist/es/Grid'
import { MeasurerRendererProps } from '../cellMeasurer'
import { GridWrapperProps } from './gridWrapperProps'
import { makeStyles } from '@material-ui/core/styles'
import { StretchMode } from '../types'
import { useLogger } from '../logger'
import KeyboardArrowRightIcon from '@material-ui/icons/KeyboardArrowRight'
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown'
import { createCellQueryProperties } from '../keyboard/querySelector.helper'

const useStyles = makeStyles(() => ({
  bodyContainer: {
    outline: 'none',
  },
  cellDefaultStyle: {
    display: 'flex',
    boxSizing: 'border-box',
    '&:focus': {
      outline: 0,
      border: 0,
    },
  },
  disabledCell: {
    cursor: 'default', //no clickable action for this cell
    pointerEvents: 'none', //no events for this cell
  },
  suppressHorizontalOverflow: {
    overflowX: 'hidden',
  },
}))

const GridWrapper = React.memo(
  ({
    rows,
    data,
    getColumnWidth,
    isMerged,
    apiRef,
    columns,
    nestedRowsProps,
    coords,
    ...props
  }: GridWrapperProps) => {
    const logger = useLogger('GridWrapper')
    const cache = useRef(
      new CellMeasurerCache({
        defaultWidth: props.defaultColumnWidth,
        defaultHeight: props.minRowHeight,
        fixedWidth: props.fixedRowWidth ?? true,
        fixedHeight: props.fixedRowHeight,
        minHeight: props.minRowHeight,
        minWidth: props.defaultColumnWidth,
      }),
    ).current

    const classes = useStyles()
    const gridRef = useRef<VirtualizedGrid | null>(null)
    const recomputingTimeout = useRef<NodeJS.Timeout | undefined>(undefined)

    const recomputeSizes = useCallback(() => {
      logger.debug('Recomputing sizes.')
      cache.clearAll()
      gridRef.current?.recomputeGridSize()

      //Ensure we do have a valid index range
      if (coords.rowIndex !== -1 && coords.colIndex !== -1) {
        //When the re-computation happens the scroll position is affected and gets reset
        gridRef.current?.scrollToCell({
          columnIndex: coords.colIndex,
          rowIndex: coords.rowIndex,
        })
      }
    }, [logger, cache, coords])

    function recomputingCleanup() {
      if (recomputingTimeout.current) {
        clearTimeout(recomputingTimeout.current)
      }
    }

    // clear cache and recompute when data changes
    useEffect(() => {
      if (recomputingTimeout.current) {
        clearTimeout(recomputingTimeout.current)
      }
      recomputingTimeout.current = setTimeout(recomputeSizes, 100)
      return recomputingCleanup
    }, [data, props.width, props.height, recomputeSizes])

    const activeRowPathCoordinates = useMemo(() => {
      const coordinates: NavigationCoords[] = []
      const { rowIndex } = coords
      //Create the cell coordinates position with all columns on the active rowIndex
      const temporaryRowCoordinates = columns.map((_, colIndex) => {
        return { rowIndex, colIndex } as NavigationCoords
      })

      //Check each temporary row coordinate
      temporaryRowCoordinates.forEach(e => {
        if (isMerged && isMerged(e)) {
          const parent = apiRef.current.getMergeParentCoords(e)
          if (!parent) {
            logger.warn(`Parent not found for coordinates: ${e}`)
          } else {
            coordinates.push(parent)
          }
        } else {
          coordinates.push(e)
        }
      })
      return coordinates
    }, [apiRef, columns, coords, isMerged, logger])

    /**
     * Checks if the given coordinates can use the currentClassName
     * @param rowIndex
     * @param colIndex
     */
    const isCellRowActive = useCallback(
      ({ rowIndex, colIndex }: NavigationCoords) => {
        return activeRowPathCoordinates.some(
          e => e.rowIndex === rowIndex && e.colIndex === colIndex,
        )
      },
      [activeRowPathCoordinates],
    )

    const renderCell = useCallback(
      ({ style, cell, ref, rowIndex, columnIndex }) => {
        const isSelected = rowIndex === coords.rowIndex && columnIndex === coords.colIndex
        const navigationDisabled = columns[0][columnIndex]?.disableNavigation
        const column = columns[columnIndex]
        const row = rows[rowIndex]
        //Dummy zIndex is 0 and a spanned cell has 5 but a normal cell has 1
        const defaultZIndex = cell.dummy ? 0 : 1
        const zIndex = (cell.rowSpan || cell.colSpan) && !cell.dummy ? 5 : defaultZIndex
        const isRowActive = isCellRowActive({ rowIndex, colIndex: columnIndex })
        const { theme } = apiRef.current
        const cellStyle: CSSProperties = { ...style }

        if (isSelected) {
          //Ensure there are no other borders
          cellStyle.borderLeft = '0px'
          cellStyle.borderRight = '0px'
          cellStyle.borderTop = '0px'
          cellStyle.borderBottom = '0px'
          cellStyle.border = props.highlightBorderColor
            ? `1px solid ${props.highlightBorderColor}`
            : '1px solid blue'
        } else if (!theme || (!theme.cellClass && !cell.dummy)) {
          //Bind default border and clear other borders
          cellStyle.borderLeft = '0px'
          cellStyle.borderRight = '0px'
          cellStyle.borderTop = '0px'
          cellStyle.borderBottom = '0px'
          cellStyle.border = '1px solid rgb(204, 204, 204)'
        }

        /**
         * @todo We need to check if the row is a dummy but its parent dummy is not anymore visible (we need to pass the content to the last visible child)
         * e.:g
         * dummy 1 has a rowspan of total 3 but none of its parent are visible, so dummy 3 assume the children value and highlight
         * of the parent because there is none visible
         * */
        let cellClassName = clsx(
          classes.cellDefaultStyle,
          theme?.cellClass,
          typeof column.cellClassName === 'function'
            ? column.cellClassName({ row, column })
            : column.cellClassName,
        )
        if (isRowActive && !cell.dummy && theme?.currentRowClass) {
          cellClassName = clsx(cellClassName, theme?.currentRowClass)
        }

        if (navigationDisabled && !cell.dummy && theme?.disabledCellClass) {
          cellClassName = clsx(cellClassName, classes.disabledCell, theme?.disabledCellClass)
        }

        if (props.selection && props.selection.cellClassName) {
          const isRowSelected = apiRef.current.isRowSelected(row?.[props.selection.key])
          if (isRowSelected) {
            cellClassName = clsx(cellClassName, props.selection.cellClassName)
          }
        }

        const wrapper = child => {
          //Add navigationProps in case its a normal cell navigable
          const navigationProps = cell.dummy
            ? {}
            : createCellQueryProperties({
                colIndex: columnIndex,
                rowIndex,
                role: 'cell',
                accessor: column.accessor,
              })

          const style: CSSProperties = {
            ...cellStyle,
            justifyContent: cell?.dummy ? 'top' : 'center',
            zIndex,
          }

          return (
            <div {...navigationProps} className={cellClassName} style={style} ref={ref}>
              {child}
            </div>
          )
        }

        //If nestedRows are enabled we need to render our utility
        if (nestedRowsProps.nestedRows) {
          const id = String(row[apiRef.current.selectionKey])
          const depth = apiRef.current.getRowDepth(id)
          const nestedMargin = (nestedRowsProps.nestedRowMargin ?? 10) * depth
          //Parent collapse renders an additional layer with collapse controls
          if (row.__children !== undefined && columnIndex === 0) {
            const iconStyle: React.CSSProperties = {
              cursor: 'pointer',
              right: 0,
              position: 'absolute',
            }
            const isRowExpanded = apiRef.current.isRowExpanded(id)
            const handleCollapseClick = () => {
              if (!id) {
                return logger.error(
                  `Row index ${rowIndex} does not have a key in order to toggle collapse!`,
                )
              }

              //Select the target row if not selected
              if (coords.rowIndex !== rowIndex) {
                apiRef.current.selectCell({ ...coords, rowIndex })
              }

              apiRef.current.toggleRowExpand(id)
            }

            const renderExpandOrCollapseIcon = () => {
              if (nestedRowsProps.iconRenderer) {
                return nestedRowsProps.iconRenderer(handleCollapseClick, isRowExpanded)
              }

              return isRowExpanded ? (
                <KeyboardArrowDownIcon
                  onClick={handleCollapseClick}
                  fontSize={'small'}
                  style={iconStyle}
                />
              ) : (
                <KeyboardArrowRightIcon
                  onClick={handleCollapseClick}
                  fontSize={'small'}
                  style={iconStyle}
                />
              )
            }

            const component = (
              <div style={depth > 1 ? { marginLeft: nestedMargin } : {}}>
                {cell.value}
                {renderExpandOrCollapseIcon()}
              </div>
            )
            return wrapper(component)
          }

          //Nested rows need to be wrapped on the first cell with a marginLeft
          if (depth > 1 && columnIndex === 0) {
            const component = <div style={{ marginLeft: nestedMargin }}>{cell.value}</div>
            return wrapper(component)
          }
        }

        return wrapper(cell.value)
      },
      [
        coords,
        columns,
        rows,
        isCellRowActive,
        apiRef,
        classes.cellDefaultStyle,
        classes.disabledCell,
        props.selection,
        props.highlightBorderColor,
        nestedRowsProps,
        logger,
      ],
    )

    const cellRenderer = useCallback(
      ({ rowIndex, columnIndex, key, parent, style, ...otherArgs }: GridCellProps) => {
        const cell = data[rowIndex]?.[columnIndex]

        const rendererProps: MeasurerRendererProps = {
          ...otherArgs,
          style,
          rowIndex,
          columnIndex,
          cell,
          getColumnWidth,
        }

        return cell ? (
          <CellMeasurer
            cache={cache}
            columnIndex={columnIndex}
            key={key}
            parent={parent}
            rowIndex={rowIndex}
            rowSpan={cell.rowSpan}
            colSpan={cell.colSpan}
            cellRenderer={renderCell}
            style={{
              ...style,
              ...cell.style,
              width: getColumnWidth({
                index: columnIndex,
              }),
              userSelect: 'none',
            }}
            rendererProps={rendererProps}
          />
        ) : null
      },
      [data, getColumnWidth, cache, renderCell],
    )

    const onRefMount = useCallback(instance => {
      gridRef.current = instance
    }, [])

    const onSectionRendered = useCallback(
      (params: SectionRenderedParams) => {
        const editorState = apiRef.current.getEditorState()
        /** @todo Store in a ref the visible rows/columns **/
        // Check if the editing coords are within the visible range
        if (editorState) {
          if (
            editorState.rowIndex < params.rowStartIndex ||
            editorState.rowIndex > params.rowStopIndex
          ) {
            apiRef.current.stopEditing({ save: false })
          } else if (
            editorState.colIndex < params.columnStartIndex ||
            editorState.colIndex > params.columnStopIndex
          ) {
            apiRef.current.stopEditing({ save: false })
          }
        }
      },
      [apiRef],
    )

    return (
      <VirtualizedGrid
        {...props}
        className={
          props.stretchMode !== StretchMode.None
            ? clsx(classes.bodyContainer, classes.suppressHorizontalOverflow)
            : classes.bodyContainer
        }
        ref={onRefMount}
        cellRenderer={cellRenderer}
        deferredMeasurementCache={cache}
        rowHeight={cache.rowHeight}
        rowCount={rows.length}
        columnCount={props.columnCount}
        columnWidth={getColumnWidth}
        overscanRowCount={props.overscanRowCount ?? 2}
        overscanColumnCount={props.overscanColumnCount ?? 2}
        onSectionRendered={onSectionRendered}
        scrollToRow={coords.rowIndex}
        scrollToColumn={coords.colIndex}
        scrollToAlignment={props.scrollToAlignment}
        onScroll={props.onScroll}
        scrollLeft={props.scrollLeft}
      />
    )
  },
)

export default GridWrapper
