import React, { useCallback, useEffect, useRef, useState } from 'react'
import { GetColumnAt } from '../columnGrid/useHeaders'
import { ROW_SELECTION_HEADER_ID } from '../rowSelection/useRowSelection'
import { NavigationCoords } from '../navigation/types/navigation-coords.type'
import { ColumnCellType, Header } from '../columnGrid/types/header.type'
import TextEditor from './components/TextEditor'
import NumericEditor from './components/NumericEditor'
import { EditorProps } from './editorProps'
import { CalendarEditor } from './components/CalendarEditor'
import { isFunctionType } from '../helpers/isFunction'
import { NavigationKey } from './enums/navigation-key.enum'

export interface StopEditingParams {
	/** @default true **/
	save?: boolean
	/**
	 * If provided it will perform this key action afterwards
	 */
	keyPress?: NavigationKey
}

export interface IEditorState {
	node: JSX.Element
	rowIndex: number
	colIndex: number
	initialValue: React.ReactText
	targetElement: HTMLElement
	validatorHook?: (value: unknown) => boolean
	/**
	 * Useful to prevent navigation interception on second arms
	 */
	isPopup: boolean
}

export interface CellChangeParams<ValueType = unknown> {
	coords: NavigationCoords
	previousValue: ValueType
	newValue: ValueType
}

export interface EditorManagerProps<TRow = unknown> {
	rows: TRow[]
	getColumnAt: GetColumnAt
	onCellChange?: (params: CellChangeParams) => void
}

export interface BeginEditingParams {
	coords: NavigationCoords
	targetElement: HTMLElement
	defaultKey?: string
}

export interface EditorRef<T = unknown> {
	getValue: () => T
}

/**
 * Provides a way to manage the editors and also returns the active editor node
 * This hook controls the editing states, interacts with useNavigation hook and also manages the commit/cancel cycle of
 * an editor
 */
export function useEditorManager<TRow>({ getColumnAt, rows, onCellChange }: EditorManagerProps) {
	const editorRef = useRef<EditorRef | null>()
	const state = useRef<IEditorState | null>(null)
	const [editorNode, setEditorNode] = useState<JSX.Element | null>(null)
	const [scheduleMove, setScheduleMove] = useState<string | null>(null)


	//Effect used to perform the move (keyPress) after editor closes
	useEffect(() => {
		if (!scheduleMove) {
			return
		}
		const timer = setTimeout(() => {
			document.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: scheduleMove,
				}) as any,
			)
			setScheduleMove(null)
		}, 10) //need to encapsulate with a little delay otherwise it won't batch process it

		//Ensure we cleanup the timer
		return () => clearTimeout(timer)
	}, [scheduleMove])

	//Detect if row/column has changed or has been deleted (compares with the active editing info)
	useEffect(() => {
		if (editorNode && state.current) {
			const target = rows[state.current.rowIndex] as TRow
			const column = getColumnAt(state.current.colIndex)
			if (target && column) {
				const value = target[column.accessor]
				//If value does not exist, simply stopEditing
				//This condition might happen if the accessor changes or the row doesn't contain anymore the accessor value
				if (value === undefined) {
					return stopEditing({ save: false })
				}
				/** @todo Review this carefully **/
				//Close the editor to prevent any conflict with the editing value
				// if (value != editorState.editor.initialValue) {
				// 	console.warn("CLOSING EDITOR TO PREVENT CONFLICT")
				// 	stopEditing()
				// }
			} else {
				stopEditing({ save: false })
			}
		}
	}, [rows, getColumnAt, editorNode])

	/**
	 * Closes the existing editor without saving anything
	 */
	const stopEditing = useCallback(
		(params?: StopEditingParams) => {
			const editorState = state.current
			if (!editorState) {
				return
			}
			if ((params === undefined || params.save) && editorState) {
				const newValue = editorRef.current?.getValue() ?? undefined
				if (newValue === undefined) {
					state.current = null
					editorRef.current = null
					return setEditorNode(null)
				}
				const isValid = editorState.validatorHook?.(newValue) ?? true
				if (!isValid) {
					editorRef.current = null
					state.current = null
					return setEditorNode(null)
				}

				if (newValue != editorState.initialValue) {
					onCellChange?.({
						coords: {
							rowIndex: editorState.rowIndex,
							colIndex: editorState.colIndex,
						},
						previousValue: editorState.initialValue,
						newValue,
					})
				}
			}

			editorRef.current = null
			state.current = null
			setEditorNode(null)
			if (params?.keyPress) {
				console.warn('Key pressed to navigate to')
				console.log(params?.keyPress)
				setScheduleMove(params?.keyPress)
			}
		},
		[editorNode],
	)

	//Invoked when the editor mounts on DOM
	const onRefMount = (ref: EditorRef) => {
		if (!ref) {
			return
		}
		validateEditorRef(ref)
		editorRef.current = ref
	}

	const getEditor = (row: TRow, column: Header, props: any) => {
		let EditorComponent: any = TextEditor
		if (column.editor) {
			EditorComponent = column.editor({ row, column, onRefMount })
		} else {
			if (column.type === ColumnCellType.Calendar) {
				EditorComponent = CalendarEditor
			} else if (column.type === ColumnCellType.Numeric) {
				EditorComponent = NumericEditor
			}
		}

		return column.editor
			? EditorComponent
			: React.createElement(EditorComponent, { ...props, ref: onRefMount })
	}

	const validateEditorRef = (editorRef: EditorRef) => {
		if (!editorRef) {
			console.warn(`
				useImperativeHandle is missing on the editor component OR has some misconfiguration. Editor reference is not defined therefore
				its not possible to start editing at the current cell. Please review your setup
			`)
			return false
		}
		if (!editorRef['getValue'] || !isFunctionType(editorRef['getValue'])) {
			console.warn(
				`Editor reference "getValue()" method is invalid, not a function or undefined, please review your setup`,
			)
			return false
		}

		return true
	}

	/**
	 * Starts editing in a given cell considering multiple configurations
	 * @param   coords  NavigationCoords
	 * @param   targetElement Element
	 * @param   refresh Flag indicating whether we bypass or not the check for current editing. Use this carefully and only when you
	 * want to reload the editor
	 */
	const beginEditing = useCallback(
		({ coords, targetElement, defaultKey }: BeginEditingParams) => {
			//Validate if is editing but in the same coords
			if (
				state.current?.rowIndex === coords.rowIndex &&
				state.current?.colIndex === coords.colIndex
			) {
				return
			}
			const column = getColumnAt(coords.colIndex)
			if (!column) {
				return console.warn(
					`Column not found at ${coords.colIndex}, therefore we can't start editing.`,
				)
			}

			if (column.id === ROW_SELECTION_HEADER_ID) {
				return
			}
			const isReadOnly = column.readOnly
				? typeof column.readOnly === 'function'
					? column.readOnly(coords)
					: column.readOnly
				: false

			if (isReadOnly) {
				return
			}

			const row = rows[coords.rowIndex]
			if (!row) {
				return console.warn(
					`Row not found at ${coords.rowIndex}, therefore we can't start editing at column: ${column.id}`,
				)
			}

			const value = (row as any)[column.accessor]
				? defaultKey
					? (row as any)[column.accessor] + defaultKey
					: (row as any)[column.accessor]
				: defaultKey
				? defaultKey
				: ''

			const editorProps: EditorProps = {
				anchorRef: targetElement,
				value,
				maxLength: column.maxLength ?? 500,
				stopEditing,
				validatorHook: column.validatorHook,
			}

			const editor = getEditor(row as TRow, column, editorProps)
			state.current = {
				node: editor,
				rowIndex: coords.rowIndex,
				colIndex: coords.colIndex,
				initialValue: value,
				targetElement,
				validatorHook: column.validatorHook,
				isPopup: column.editor !== undefined || column.type === ColumnCellType.Calendar,
			}
			setEditorNode(editor)
		},
		[getColumnAt, editorNode, rows, stopEditing],
	)

	return { editorNode, editorState: state.current, beginEditing, stopEditing }
}
