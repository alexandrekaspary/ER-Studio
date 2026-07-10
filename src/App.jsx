import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  FOREIGN_KEY_ACTIONS,
  TABLE_COLORS,
  clone,
  createExportPayload,
  emptyField,
  getRelations,
  makeId,
  normalizeModel,
} from './model'

const STORAGE_KEY = 'er-studio:model:v1'
const STORAGE_NOTICE_KEY = 'er-studio:storage-notice:v1'
const TABLE_WIDTH = 260
const TABLE_BORDER = 1
const TABLE_HEADER_HEIGHT = 36
const FIELD_ROW_HEIGHT = 32
const CANVAS_MIN_WIDTH = 1180
const CANVAS_MIN_HEIGHT = 760
const CANVAS_PADDING = 140
const ZOOM_MIN = 0.5
const ZOOM_MAX = 1.5
const ZOOM_STEP = 0.1

const POSTGRES_FIELD_TYPES = [
  {
    label: 'Numéricos',
    types: ['SMALLINT', 'INTEGER', 'BIGINT', 'NUMERIC', 'DECIMAL', 'REAL', 'DOUBLE PRECISION', 'MONEY'],
  },
  {
    label: 'Texto',
    types: ['CHAR', 'VARCHAR', 'TEXT'],
  },
  {
    label: 'Data e hora',
    types: ['DATE', 'TIME', 'TIME WITH TIME ZONE', 'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE', 'INTERVAL'],
  },
  {
    label: 'Identificadores e binários',
    types: ['UUID', 'BYTEA'],
  },
  {
    label: 'Lógicos e documentos',
    types: ['BOOLEAN', 'JSON', 'JSONB', 'XML'],
  },
  {
    label: 'Rede e busca textual',
    types: ['INET', 'CIDR', 'MACADDR', 'MACADDR8', 'TSVECTOR', 'TSQUERY'],
  },
  {
    label: 'Bits e intervalos',
    types: ['BIT', 'BIT VARYING', 'INT4RANGE', 'INT8RANGE', 'NUMRANGE', 'TSRANGE', 'TSTZRANGE', 'DATERANGE'],
  },
  {
    label: 'Geométricos',
    types: ['POINT', 'LINE', 'LSEG', 'BOX', 'PATH', 'POLYGON', 'CIRCLE'],
  },
]

const POSTGRES_TYPE_VALUES = new Set(POSTGRES_FIELD_TYPES.flatMap((group) => group.types))

const INITIAL_MODEL = {
  version: 1,
  name: 'Modelo comercial',
  tables: [
    {
      id: 'table_clients',
      name: 'clientes',
      color: '#1f5f7a',
      collapsed: false,
      position: { x: 84, y: 106 },
      fields: [
        {
          id: 'field_clients_id',
          name: 'id',
          type: 'UUID',
          size: '',
          defaultValue: 'gen_random_uuid()',
          nullable: false,
          primaryKey: true,
          unique: false,
          isForeignKey: false,
          foreignKey: null,
        },
        {
          id: 'field_clients_name',
          name: 'nome',
          type: 'VARCHAR',
          size: '160',
          defaultValue: '',
          nullable: false,
          primaryKey: false,
          unique: false,
          isForeignKey: false,
          foreignKey: null,
        },
        {
          id: 'field_clients_email',
          name: 'email',
          type: 'VARCHAR',
          size: '255',
          defaultValue: '',
          nullable: false,
          primaryKey: false,
          unique: false,
          isForeignKey: false,
          foreignKey: null,
        },
      ],
    },
    {
      id: 'table_orders',
      name: 'pedidos',
      color: '#9a5b13',
      collapsed: false,
      position: { x: 478, y: 220 },
      fields: [
        {
          id: 'field_orders_id',
          name: 'id',
          type: 'UUID',
          size: '',
          defaultValue: 'gen_random_uuid()',
          nullable: false,
          primaryKey: true,
          unique: false,
          isForeignKey: false,
          foreignKey: null,
        },
        {
          id: 'field_orders_client_id',
          name: 'cliente_id',
          type: 'UUID',
          size: '',
          defaultValue: '',
          nullable: false,
          primaryKey: false,
          unique: false,
          isForeignKey: true,
          foreignKey: {
            tableId: 'table_clients',
            fieldId: 'field_clients_id',
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
          },
        },
        {
          id: 'field_orders_created_at',
          name: 'criado_em',
          type: 'TIMESTAMP WITH TIME ZONE',
          size: '',
          defaultValue: 'now()',
          nullable: false,
          primaryKey: false,
          unique: false,
          isForeignKey: false,
          foreignKey: null,
        },
      ],
    },
  ],
}

function loadInitialModel() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? normalizeModel(JSON.parse(saved)) : clone(INITIAL_MODEL)
  } catch {
    return clone(INITIAL_MODEL)
  }
}

function shouldShowStorageNotice() {
  try {
    return localStorage.getItem(STORAGE_NOTICE_KEY) !== 'acknowledged'
  } catch {
    return true
  }
}

function fieldDescription(field) {
  return field.size ? `${field.type}(${field.size})` : field.type
}

function findFieldIndex(table, fieldId) {
  return table.fields.findIndex((field) => field.id === fieldId)
}

function getAnchor(table, fieldId, side) {
  const direction = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    top: { x: 0, y: -1 },
    bottom: { x: 0, y: 1 },
  }[side]
  const fieldIndex = Math.max(0, findFieldIndex(table, fieldId))
  const fieldCount = Math.max(1, table.fields.length)

  if (side === 'top' || side === 'bottom') {
    return {
      x: table.collapsed
        ? table.position.x + TABLE_WIDTH / 2
        : table.position.x + 24 + ((fieldIndex + 1) / (fieldCount + 1)) * (TABLE_WIDTH - 48),
      y: table.position.y + (side === 'bottom' ? getTableHeight(table) : 0),
      direction,
    }
  }

  if (table.collapsed) {
    return {
      x: table.position.x + (side === 'right' ? TABLE_WIDTH : 0),
      y: table.position.y + TABLE_BORDER + TABLE_HEADER_HEIGHT / 2,
      direction,
    }
  }

  const precedingHeight = table.fields
    .slice(0, fieldIndex)
    .reduce((height) => height + FIELD_ROW_HEIGHT, 0)
  return {
    x: table.position.x + (side === 'right' ? TABLE_WIDTH : 0),
    y: table.position.y + TABLE_BORDER + TABLE_HEADER_HEIGHT + precedingHeight + FIELD_ROW_HEIGHT / 2,
    direction,
  }
}

function getTableHeight(table) {
  if (table.collapsed) return TABLE_BORDER * 2 + TABLE_HEADER_HEIGHT
  const fieldsHeight = table.fields.length === 0
    ? FIELD_ROW_HEIGHT
    : table.fields.length * FIELD_ROW_HEIGHT
  return TABLE_BORDER * 2 + TABLE_HEADER_HEIGHT + fieldsHeight
}

function getCanvasSize(tables) {
  const width = tables.reduce(
    (size, table) => Math.max(size, table.position.x + TABLE_WIDTH + CANVAS_PADDING),
    CANVAS_MIN_WIDTH,
  )
  const height = tables.reduce(
    (size, table) => Math.max(size, table.position.y + getTableHeight(table) + CANVAS_PADDING),
    CANVAS_MIN_HEIGHT,
  )

  return {
    width: Math.ceil(width / 100) * 100,
    height: Math.ceil(height / 100) * 100,
  }
}

function clampZoom(value) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100))
}

function relationPath(source, target) {
  const isHorizontal = source.direction.x !== 0
  const axisDistance = isHorizontal
    ? Math.abs(target.x - source.x)
    : Math.abs(target.y - source.y)
  const bend = Math.max(48, Math.min(160, axisDistance * 0.38))

  return `M ${source.x} ${source.y} C ${source.x + source.direction.x * bend} ${source.y + source.direction.y * bend}, ${target.x + target.direction.x * bend} ${target.y + target.direction.y * bend}, ${target.x} ${target.y}`
}

function getRelationRoute(sourceTable, targetTable) {
  const sourceBounds = {
    left: sourceTable.position.x,
    right: sourceTable.position.x + TABLE_WIDTH,
    top: sourceTable.position.y,
    bottom: sourceTable.position.y + getTableHeight(sourceTable),
  }
  const targetBounds = {
    left: targetTable.position.x,
    right: targetTable.position.x + TABLE_WIDTH,
    top: targetTable.position.y,
    bottom: targetTable.position.y + getTableHeight(targetTable),
  }
  const sourceCenterX = (sourceBounds.left + sourceBounds.right) / 2
  const sourceCenterY = (sourceBounds.top + sourceBounds.bottom) / 2
  const targetCenterX = (targetBounds.left + targetBounds.right) / 2
  const targetCenterY = (targetBounds.top + targetBounds.bottom) / 2
  const horizontalOverlap = Math.min(sourceBounds.right, targetBounds.right) - Math.max(sourceBounds.left, targetBounds.left)
  const verticalOverlap = Math.min(sourceBounds.bottom, targetBounds.bottom) - Math.max(sourceBounds.top, targetBounds.top)

  let useVerticalRoute
  if (horizontalOverlap > 0 && verticalOverlap <= 0) {
    useVerticalRoute = true
  } else if (verticalOverlap > 0 && horizontalOverlap <= 0) {
    useVerticalRoute = false
  } else {
    useVerticalRoute = Math.abs(sourceCenterY - targetCenterY) > Math.abs(sourceCenterX - targetCenterX)
  }

  if (useVerticalRoute) {
    const sourceIsAbove = sourceCenterY <= targetCenterY
    return {
      sourceSide: sourceIsAbove ? 'bottom' : 'top',
      targetSide: sourceIsAbove ? 'top' : 'bottom',
    }
  }

  const sourceIsLeft = sourceCenterX <= targetCenterX
  return {
    sourceSide: sourceIsLeft ? 'right' : 'left',
    targetSide: sourceIsLeft ? 'left' : 'right',
  }
}

function getRelationAnchors(sourceTable, sourceFieldId, targetTable, targetFieldId) {
  const route = getRelationRoute(sourceTable, targetTable)
  return {
    source: getAnchor(sourceTable, sourceFieldId, route.sourceSide),
    target: getAnchor(targetTable, targetFieldId, route.targetSide),
  }
}

function PanelIcon({ side, expand = false }) {
  const isLeft = side === 'left'
  const dividerX = isLeft ? 7.5 : 12.5
  const arrow = isLeft
    ? (expand ? 'M9 7.5 11.5 10 9 12.5' : 'M11 7.5 8.5 10 11 12.5')
    : (expand ? 'M11 7.5 8.5 10 11 12.5' : 'M9 7.5 11.5 10 9 12.5')

  return (
    <svg className="panel-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="2.5" y="3" width="15" height="14" rx="2" />
      <path d={`M${dividerX} 3v14`} />
      <path d={arrow} />
    </svg>
  )
}

function ColorSwatches({ value, onChange }) {
  return (
    <div className="color-swatches" aria-label="Cores disponíveis">
      {TABLE_COLORS.map((color) => (
        <button
          type="button"
          className={`swatch ${value === color ? 'is-active' : ''}`}
          style={{ '--swatch-color': color }}
          onClick={() => onChange(color)}
          aria-label={`Usar a cor ${color}`}
          title={color}
          key={color}
        />
      ))}
    </div>
  )
}

function AddTableDialog({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(TABLE_COLORS[0])

  function submit(event) {
    event.preventDefault()
    if (!name.trim()) return
    onCreate({ name: name.trim(), color })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal-card" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">NOVA ENTIDADE</p>
            <h2>Adicionar tabela</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <label className="form-label">
          Nome da tabela
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="ex.: produtos"
          />
        </label>

        <span className="form-label">Cor de identificação</span>
        <ColorSwatches value={color} onChange={setColor} />

        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="button primary" disabled={!name.trim()}>Criar tabela</button>
        </div>
      </form>
    </div>
  )
}

function ImportDialog({ preview, onClose, onConfirm }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card import-card" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">IMPORTAR MODELO</p>
            <h2 id="import-title">Substituir diagrama atual?</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <p className="dialog-copy">
          O arquivo contém <strong>{preview.tables.length}</strong> tabela{preview.tables.length === 1 ? '' : 's'} e{' '}
          <strong>{getRelations(preview).length}</strong> relação{getRelations(preview).length === 1 ? '' : 'ões'}.
          O modelo aberto será substituído.
        </p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="button primary" onClick={onConfirm}>Importar modelo</button>
        </div>
      </div>
    </div>
  )
}

function StorageNoticeDialog({ onConfirm }) {
  return (
    <div className="modal-backdrop storage-notice-backdrop">
      <div className="modal-card storage-notice-card" role="dialog" aria-modal="true" aria-labelledby="storage-notice-title">
        <span className="storage-notice-icon" aria-hidden="true">▣</span>
        <p className="eyebrow">ANTES DE COMEÇAR</p>
        <h2 id="storage-notice-title">Seu projeto fica neste navegador</h2>
        <p className="dialog-copy">
          Enquanto você trabalha, o ER Studio guarda um rascunho para ajudar você a continuar depois.
        </p>
        <p className="storage-notice-copy">
          Para garantir uma cópia do seu projeto, exporte o arquivo JSON com frequência. Assim você pode guardá-lo, enviá-lo ou abri-lo em outro computador.
        </p>
        <button type="button" className="button primary storage-notice-action" onClick={onConfirm}>
          Entendi, vou exportar meu projeto
        </button>
      </div>
    </div>
  )
}

function ConfirmDialog({ action, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop confirmation-backdrop" role="presentation" onMouseDown={onCancel}>
      <div className="modal-card confirmation-card" role="dialog" aria-modal="true" aria-labelledby="confirmation-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">CONFIRMAÇÃO</p>
            <h2 id="confirmation-title">{action.title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Fechar">×</button>
        </div>
        <p className="dialog-copy">{action.message}</p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className={`button ${action.variant === 'danger' ? 'danger' : 'primary'}`} onClick={onConfirm}>{action.confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function TableCard({ table, selected, selectedFieldId, onSelect, onSelectField, onToggleCollapse, onDragStart, onDragMove, onDragEnd }) {
  return (
    <article
      className={`table-card ${table.collapsed ? 'is-collapsed' : ''} ${selected ? 'is-selected' : ''}`}
      style={{ left: table.position.x, top: table.position.y, '--table-color': table.color }}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(table.id)
      }}
    >
      <div
        className="table-card-header"
        onPointerDown={(event) => onDragStart(event, table)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <span className="drag-grip" aria-hidden="true">⠿</span>
        <span className="table-card-title">{table.name}</span>
        <span className="table-card-count">{table.fields.length}</span>
        <button
          type="button"
          className="collapse-table-button"
          aria-label={table.collapsed ? `Expandir tabela ${table.name}` : `Recolher tabela ${table.name}`}
          aria-expanded={!table.collapsed}
          aria-controls={`table-fields-${table.id}`}
          title={table.collapsed ? 'Expandir tabela' : 'Recolher tabela'}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onToggleCollapse(table.id)
          }}
        >
          <span aria-hidden="true">{table.collapsed ? '▸' : '▾'}</span>
        </button>
      </div>
      <div id={`table-fields-${table.id}`} className="field-list" hidden={table.collapsed}>
        {table.fields.length === 0 ? (
          <p className="empty-fields">Sem campos</p>
        ) : table.fields.map((field) => (
          <button
            type="button"
            className={`field-row ${selectedFieldId === field.id ? 'is-selected' : ''}`}
            key={field.id}
            onClick={(event) => {
              event.stopPropagation()
              onSelectField(table.id, field.id)
            }}
          >
            <span className="field-keymarks">
              {field.primaryKey && <span className="keymark pk" title="Chave primária">PK</span>}
              {field.unique && !field.primaryKey && <span className="keymark uq" title="Valor único">UQ</span>}
              {(field.isForeignKey || field.foreignKey) && <span className="keymark fk" title="Chave estrangeira">FK</span>}
            </span>
            <span className="field-name">{field.name}</span>
            <span className="field-type">{fieldDescription(field)}</span>
          </button>
        ))}
      </div>
    </article>
  )
}

function App() {
  const [model, setModel] = useState(loadInitialModel)
  const [selectedTableId, setSelectedTableId] = useState(null)
  const [selectedFieldId, setSelectedFieldId] = useState(null)
  const [isAddTableOpen, setIsAddTableOpen] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [notice, setNotice] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [isStorageNoticeOpen, setIsStorageNoticeOpen] = useState(shouldShowStorageNotice)
  const [isSchemaSidebarVisible, setIsSchemaSidebarVisible] = useState(true)
  const [isInspectorVisible, setIsInspectorVisible] = useState(true)
  const importInputRef = useRef(null)
  const draggingRef = useRef(null)
  const diagramScrollRef = useRef(null)
  const zoomAnchorRef = useRef(null)

  const selectedTable = useMemo(
    () => model.tables.find((table) => table.id === selectedTableId) || null,
    [model.tables, selectedTableId],
  )

  const selectedField = useMemo(
    () => selectedTable?.fields.find((field) => field.id === selectedFieldId) || null,
    [selectedTable, selectedFieldId],
  )

  const relations = useMemo(() => getRelations(model), [model])
  const canvasSize = useMemo(() => getCanvasSize(model.tables), [model.tables])

  useLayoutEffect(() => {
    const scrollContainer = diagramScrollRef.current
    const anchor = zoomAnchorRef.current
    if (!scrollContainer || !anchor) return

    scrollContainer.scrollLeft = Math.max(0, anchor.x * zoom - scrollContainer.clientWidth / 2)
    scrollContainer.scrollTop = Math.max(0, anchor.y * zoom - scrollContainer.clientHeight / 2)
    zoomAnchorRef.current = null
  }, [zoom])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(model))
    } catch {
      // A aplicação continua funcional se o armazenamento local estiver indisponível.
    }
  }, [model])

  useEffect(() => {
    function keyboardShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        exportModel()
      }
    }
    window.addEventListener('keydown', keyboardShortcut)
    return () => window.removeEventListener('keydown', keyboardShortcut)
  })

  function showNotice(type, message) {
    setNotice({ type, message })
  }

  function requestConfirmation(action) {
    setPendingAction(action)
  }

  function confirmPendingAction() {
    const action = pendingAction
    if (!action) return
    setPendingAction(null)

    if (action.kind === 'delete-field') {
      setModel((current) => ({
        ...current,
        tables: current.tables.map((table) => ({
          ...table,
          fields: table.id === action.tableId
            ? table.fields.filter((field) => field.id !== action.fieldId)
            : table.fields.map((field) => field.foreignKey?.tableId === action.tableId && field.foreignKey?.fieldId === action.fieldId
              ? { ...field, isForeignKey: false, foreignKey: null }
              : field),
        })),
      }))
      setSelectedFieldId(null)
      showNotice('success', 'Campo excluído.')
      return
    }

    if (action.kind === 'delete-table') {
      setModel((current) => ({
        ...current,
        tables: current.tables
          .filter((table) => table.id !== action.tableId)
          .map((table) => ({
            ...table,
            fields: table.fields.map((field) => field.foreignKey?.tableId === action.tableId
              ? { ...field, isForeignKey: false, foreignKey: null }
              : field),
          })),
      }))
      setSelectedTableId(null)
      setSelectedFieldId(null)
      showNotice('success', 'Tabela excluída e relações dependentes removidas.')
      return
    }

    if (action.kind === 'new-model') {
      setModel({ version: 1, name: 'Modelo sem nome', tables: [] })
      setSelectedTableId(null)
      setSelectedFieldId(null)
      showNotice('success', 'Novo modelo iniciado.')
    }
  }

  function dismissStorageNotice() {
    try {
      localStorage.setItem(STORAGE_NOTICE_KEY, 'acknowledged')
    } catch {
      // O aviso será exibido novamente se o navegador não permitir persistir a confirmação.
    }
    setIsStorageNoticeOpen(false)
  }

  function changeZoom(nextZoom) {
    const next = clampZoom(nextZoom)
    if (next === zoom) return

    const scrollContainer = diagramScrollRef.current
    if (scrollContainer) {
      zoomAnchorRef.current = {
        x: Math.min(canvasSize.width, (scrollContainer.scrollLeft + scrollContainer.clientWidth / 2) / zoom),
        y: Math.min(canvasSize.height, (scrollContainer.scrollTop + scrollContainer.clientHeight / 2) / zoom),
      }
    }
    setZoom(next)
  }

  function handleDiagramWheel(event) {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    if (event.deltaY === 0) return
    changeZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))
  }

  function patchTable(tableId, changes) {
    setModel((current) => ({
      ...current,
      tables: current.tables.map((table) => table.id === tableId ? { ...table, ...changes } : table),
    }))
  }

  function patchField(tableId, fieldId, changes) {
    setModel((current) => ({
      ...current,
      tables: current.tables.map((table) => table.id === tableId ? {
        ...table,
        fields: table.fields.map((field) => field.id === fieldId ? { ...field, ...changes } : field),
      } : table),
    }))
  }

  function selectTable(tableId) {
    setSelectedTableId(tableId)
    setSelectedFieldId(null)
    setIsInspectorVisible(true)
  }

  function selectField(tableId, fieldId) {
    setSelectedTableId(tableId)
    setSelectedFieldId(fieldId)
    setIsInspectorVisible(true)
  }

  function createTable({ name, color }) {
    const tableId = makeId('table')
    const offset = model.tables.length * 34
    const table = {
      id: tableId,
      name,
      color,
      collapsed: false,
      position: { x: 72 + (offset % 360), y: 72 + (offset % 260) },
      fields: [
        {
          ...emptyField(),
          name: 'id',
          type: 'UUID',
          size: '',
          nullable: false,
          primaryKey: true,
        },
      ],
    }
    setModel((current) => ({ ...current, tables: [...current.tables, table] }))
    setSelectedTableId(tableId)
    setSelectedFieldId(null)
    setIsAddTableOpen(false)
    showNotice('success', `Tabela "${name}" criada.`)
  }

  function addField() {
    if (!selectedTable) return
    const field = emptyField()
    setModel((current) => ({
      ...current,
      tables: current.tables.map((table) => table.id === selectedTable.id
        ? { ...table, fields: [...table.fields, field] }
        : table),
    }))
    setSelectedFieldId(field.id)
  }

  function toggleTableCollapse(tableId) {
    setModel((current) => ({
      ...current,
      tables: current.tables.map((table) => table.id === tableId
        ? { ...table, collapsed: !table.collapsed }
        : table),
    }))
    if (selectedTableId === tableId) {
      setSelectedFieldId(null)
    }
  }

  function deleteField() {
    if (!selectedTable || !selectedField) return
    requestConfirmation({
      kind: 'delete-field',
      tableId: selectedTable.id,
      fieldId: selectedField.id,
      title: 'Excluir campo?',
      message: `O campo "${selectedField.name}" será removido. Relações que apontam para ele também serão desfeitas.`,
      confirmLabel: 'Excluir campo',
      variant: 'danger',
    })
  }

  function deleteTable() {
    if (!selectedTable) return
    requestConfirmation({
      kind: 'delete-table',
      tableId: selectedTable.id,
      title: 'Excluir tabela?',
      message: `A tabela "${selectedTable.name}" e todas as relações ligadas a ela serão removidas.`,
      confirmLabel: 'Excluir tabela',
      variant: 'danger',
    })
  }

  function beginDrag(event, table) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = {
      tableId: table.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      tableX: table.position.x,
      tableY: table.position.y,
      zoom,
    }
    selectTable(table.id)
  }

  function moveDrag(event) {
    const drag = draggingRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const x = Math.max(16, Math.round(drag.tableX + (event.clientX - drag.startX) / drag.zoom))
    const y = Math.max(16, Math.round(drag.tableY + (event.clientY - drag.startY) / drag.zoom))
    patchTable(drag.tableId, { position: { x, y } })
  }

  function endDrag(event) {
    if (draggingRef.current?.pointerId === event.pointerId) {
      draggingRef.current = null
    }
  }

  function toggleForeignKey(checked) {
    if (!selectedTable || !selectedField) return
    if (!checked) {
      patchField(selectedTable.id, selectedField.id, { isForeignKey: false, foreignKey: null })
      return
    }

    const targetTable = model.tables.find((table) => table.id !== selectedTable.id && table.fields.length > 0)
    patchField(selectedTable.id, selectedField.id, {
      isForeignKey: true,
      foreignKey: targetTable ? {
        tableId: targetTable.id,
        fieldId: targetTable.fields[0].id,
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      } : null,
    })
  }

  function updateForeignTable(tableId) {
    if (!selectedTable || !selectedField) return
    const targetTable = model.tables.find((table) => table.id === tableId)
    const currentForeignKey = selectedField.foreignKey
    patchField(selectedTable.id, selectedField.id, {
      isForeignKey: true,
      foreignKey: targetTable ? {
        tableId,
        fieldId: targetTable.fields[0]?.id || '',
        onDelete: currentForeignKey?.onDelete || 'NO ACTION',
        onUpdate: currentForeignKey?.onUpdate || 'NO ACTION',
      } : null,
    })
  }

  function updateForeignField(fieldId) {
    if (!selectedTable || !selectedField || !selectedField.foreignKey?.tableId) return
    patchField(selectedTable.id, selectedField.id, {
      isForeignKey: true,
      foreignKey: {
        ...selectedField.foreignKey,
        fieldId,
        onDelete: selectedField.foreignKey.onDelete || 'NO ACTION',
        onUpdate: selectedField.foreignKey.onUpdate || 'NO ACTION',
      },
    })
  }

  function updateForeignAction(action, value) {
    if (!selectedTable || !selectedField?.foreignKey) return
    patchField(selectedTable.id, selectedField.id, {
      isForeignKey: true,
      foreignKey: { ...selectedField.foreignKey, [action]: value },
    })
  }

  function exportModel() {
    const payload = createExportPayload(model)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const filename = model.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'modelo-er'
    link.href = url
    link.download = `${filename}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    showNotice('success', 'JSON exportado com o diagrama e as relações.')
  }

  function readImportFile(event) {
    const [file] = event.target.files || []
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = normalizeModel(JSON.parse(String(reader.result)))
        setImportPreview(imported)
      } catch (error) {
        showNotice('error', error instanceof Error ? error.message : 'Não foi possível ler este JSON.')
      }
    }
    reader.onerror = () => showNotice('error', 'Não foi possível abrir o arquivo selecionado.')
    reader.readAsText(file)
  }

  function confirmImport() {
    if (!importPreview) return
    setModel(importPreview)
    setSelectedTableId(null)
    setSelectedFieldId(null)
    setImportPreview(null)
    showNotice('success', 'Modelo importado com sucesso.')
  }

  function createNewModel() {
    requestConfirmation({
      kind: 'new-model',
      title: 'Iniciar novo modelo?',
      message: 'O diagrama atual será substituído. Exporte o JSON antes de continuar se quiser manter uma cópia.',
      confirmLabel: 'Criar novo modelo',
      variant: 'primary',
    })
  }

  const foreignTargetTable = selectedField?.foreignKey?.tableId
    ? model.tables.find((table) => table.id === selectedField.foreignKey.tableId)
    : null

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="ER Studio">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>ER <strong>Studio</strong></span>
        </div>

        <div className="model-name-wrap">
          <span className="eyebrow">MODELO</span>
          <input
            className="model-name"
            value={model.name}
            onChange={(event) => setModel((current) => ({ ...current, name: event.target.value }))}
            aria-label="Nome do modelo"
          />
        </div>

        <div className="topbar-actions">
          <button type="button" className="button secondary" onClick={createNewModel}>Novo</button>
          <button type="button" className="button secondary" onClick={() => importInputRef.current?.click()}>Importar JSON</button>
          <button type="button" className="button primary" onClick={exportModel}>Exportar JSON</button>
          <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={readImportFile} />
        </div>
      </header>

      <div className={`editor-layout${isSchemaSidebarVisible ? '' : ' is-schema-sidebar-collapsed'}${isInspectorVisible ? '' : ' is-inspector-collapsed'}`}>
        <aside id="schema-sidebar" className={`schema-sidebar${isSchemaSidebarVisible ? '' : ' is-collapsed'}`} aria-label="Tabelas do modelo">
          {isSchemaSidebarVisible ? (
            <>
              <div className="sidebar-heading">
                <div>
                  <p className="eyebrow">ESTRUTURA</p>
                  <h2>Tabelas</h2>
                </div>
                <div className="sidebar-heading-actions">
                  <span className="count-badge">{model.tables.length}</span>
                  <button
                    type="button"
                    className="sidebar-collapse-button"
                    onClick={() => setIsSchemaSidebarVisible(false)}
                    aria-controls="schema-sidebar"
                    aria-expanded="true"
                    aria-label="Ocultar barra de tabelas"
                  title="Ocultar barra de tabelas"
                >
                    <PanelIcon side="left" />
                  </button>
                </div>
              </div>
              <button type="button" className="button primary add-table-button" onClick={() => setIsAddTableOpen(true)}>+ Nova tabela</button>

              <nav className="table-navigation">
                {model.tables.length === 0 ? (
                  <p className="empty-state">Nenhuma tabela criada.</p>
                ) : model.tables.map((table) => (
                  <button
                    type="button"
                    className={`table-navigation-item ${selectedTableId === table.id ? 'is-selected' : ''}`}
                    key={table.id}
                    onClick={() => selectTable(table.id)}
                  >
                    <span className="table-color-dot" style={{ background: table.color }} />
                    <span className="nav-table-name">{table.name}</span>
                    <span className="nav-table-fields">{table.fields.length}</span>
                  </button>
                ))}
              </nav>

              <div className="sidebar-note">
                <span className="note-icon">↔</span>
                Arraste pelo cabeçalho de uma tabela para organizar o diagrama.
              </div>
            </>
          ) : (
            <button
              type="button"
              className="collapsed-sidebar-button"
              onClick={() => setIsSchemaSidebarVisible(true)}
              aria-controls="schema-sidebar"
              aria-expanded="false"
              aria-label="Mostrar barra de tabelas"
              title="Mostrar barra de tabelas"
            >
              <PanelIcon side="left" expand />
            </button>
          )}
        </aside>

        <section className="canvas-pane" aria-label="Diagrama entidade relacionamento">
          <div className="canvas-toolbar">
            <div className="canvas-toolbar-leading">
              <div className="canvas-summary">
                <p className="eyebrow">DIAGRAMA ER</p>
                <span>{model.tables.length} tabelas · {relations.length} relações</span>
              </div>
            </div>
            <div className="canvas-toolbar-actions">
              <span className="canvas-hint">Selecione um campo para editar seus atributos</span>
              <div className="zoom-controls" role="group" aria-label="Controles de zoom do diagrama">
                <button
                  type="button"
                  className="zoom-button"
                  onClick={() => changeZoom(zoom - ZOOM_STEP)}
                  disabled={zoom <= ZOOM_MIN}
                  aria-label="Diminuir zoom"
                  title="Diminuir zoom"
                >
                  −
                </button>
                <button
                  type="button"
                  className="zoom-readout"
                  onClick={() => changeZoom(1)}
                  aria-label="Restaurar zoom para 100%"
                  title="Restaurar zoom para 100%"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  className="zoom-button"
                  onClick={() => changeZoom(zoom + ZOOM_STEP)}
                  disabled={zoom >= ZOOM_MAX}
                  aria-label="Aumentar zoom"
                  title="Aumentar zoom"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="diagram-scroll" ref={diagramScrollRef} onWheel={handleDiagramWheel}>
            <div
              className="diagram-viewport"
              style={{
                width: `${canvasSize.width * zoom}px`,
                height: `${canvasSize.height * zoom}px`,
                '--grid-size': `${18 * zoom}px`,
              }}
              onClick={() => {
                setSelectedTableId(null)
                setSelectedFieldId(null)
              }}
            >
              <div
                className="diagram-canvas"
                style={{
                  width: `${canvasSize.width}px`,
                  height: `${canvasSize.height}px`,
                  transform: `scale(${zoom})`,
                }}
              >
              <svg className="relation-layer" aria-hidden="true">
                <defs>
                  <marker id="relation-arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 z" fill="#69809a" />
                  </marker>
                </defs>
                {relations.map((relation) => {
                  const sourceTable = model.tables.find((table) => table.id === relation.fromTableId)
                  const targetTable = model.tables.find((table) => table.id === relation.toTableId)
                  if (!sourceTable || !targetTable) return null
                  const { source, target } = getRelationAnchors(
                    sourceTable,
                    relation.fromFieldId,
                    targetTable,
                    relation.toFieldId,
                  )
                  const labelX = Math.round((source.x + target.x) / 2)
                  const labelY = Math.round((source.y + target.y) / 2) - 8
                  return (
                    <g key={relation.id}>
                      <path className="relation-shadow" d={relationPath(source, target)} />
                      <path className="relation-path" d={relationPath(source, target)} markerEnd="url(#relation-arrow)" />
                      <rect className="relation-label-bg" x={labelX - 14} y={labelY - 9} width="28" height="18" rx="4" />
                      <text className="relation-label" x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle">N:1</text>
                    </g>
                  )
                })}
              </svg>

              {model.tables.map((table) => (
                <TableCard
                  table={table}
                  selected={selectedTableId === table.id}
                  selectedFieldId={selectedTableId === table.id ? selectedFieldId : null}
                  onSelect={selectTable}
                  onSelectField={selectField}
                  onToggleCollapse={toggleTableCollapse}
                  onDragStart={beginDrag}
                  onDragMove={moveDrag}
                  onDragEnd={endDrag}
                  key={table.id}
                />
              ))}

              {model.tables.length === 0 && (
                <div className="canvas-empty">
                  <span className="canvas-empty-icon">▦</span>
                  <h2>Comece pela primeira tabela</h2>
                  <p>Crie entidades, configure os campos e conecte as chaves estrangeiras.</p>
                  <button type="button" className="button primary" onClick={(event) => {
                    event.stopPropagation()
                    setIsAddTableOpen(true)
                  }}>Adicionar tabela</button>
                </div>
              )}
              </div>
            </div>
          </div>
        </section>

        <aside id="inspector-sidebar" className={`inspector${isInspectorVisible ? '' : ' is-collapsed'}`} aria-label="Propriedades">
          {isInspectorVisible ? (
            <>
              <button
                type="button"
                className="sidebar-collapse-button inspector-collapse-button"
                onClick={() => setIsInspectorVisible(false)}
                aria-controls="inspector-sidebar"
                aria-expanded="true"
                aria-label="Ocultar painel de propriedades"
                title="Ocultar painel de propriedades"
              >
                <PanelIcon side="right" />
              </button>
              {!selectedTable ? (
            <div className="inspector-empty">
              <span className="inspector-empty-icon">⌘</span>
              <p className="eyebrow">PROPRIEDADES</p>
              <h2>Selecione uma tabela</h2>
              <p>Edite o nome e a cor da entidade. Selecione um campo para definir tipo, tamanho, padrão e chaves.</p>
            </div>
          ) : (
            <>
              <div className="inspector-heading">
                <div>
                  <p className="eyebrow">PROPRIEDADES</p>
                  <h2>{selectedField ? 'Campo' : 'Tabela'}</h2>
                </div>
                {selectedField && <button type="button" className="text-button" onClick={() => setSelectedFieldId(null)}>Voltar</button>}
              </div>

              {!selectedField ? (
                <div className="inspector-content">
                  <section className="form-section">
                    <label className="form-label">
                      Nome da tabela
                      <input value={selectedTable.name} onChange={(event) => patchTable(selectedTable.id, { name: event.target.value })} />
                    </label>
                    <label className="form-label">
                      Cor
                      <span className="color-input-row">
                        <input className="native-color" type="color" value={selectedTable.color} onChange={(event) => patchTable(selectedTable.id, { color: event.target.value })} />
                        <input value={selectedTable.color} onChange={(event) => patchTable(selectedTable.id, { color: event.target.value })} aria-label="Código hexadecimal da cor" />
                      </span>
                    </label>
                    <ColorSwatches value={selectedTable.color} onChange={(color) => patchTable(selectedTable.id, { color })} />
                  </section>

                  <section className="form-section fields-section">
                    <div className="section-heading">
                      <div>
                        <span className="section-title">Campos</span>
                        <span className="section-description">{selectedTable.fields.length} definido{selectedTable.fields.length === 1 ? '' : 's'}</span>
                      </div>
                      <button type="button" className="small-button" onClick={addField}>+ Campo</button>
                    </div>
                    <div className="inspector-field-list">
                      {selectedTable.fields.length === 0 ? (
                        <p className="small-empty">Adicione o primeiro campo desta tabela.</p>
                      ) : selectedTable.fields.map((field) => (
                        <button type="button" className="inspector-field-item" onClick={() => selectField(selectedTable.id, field.id)} key={field.id}>
                          <span>
                            <strong>{field.name}</strong>
                            <small>{fieldDescription(field)}</small>
                          </span>
                          <span className="field-flags">
                            {field.primaryKey && <em>PK</em>}
                            {field.unique && !field.primaryKey && <em>UQ</em>}
                            {(field.isForeignKey || field.foreignKey) && <em>FK</em>}
                            <span aria-hidden="true">›</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="form-section danger-section">
                    <button type="button" className="danger-button" onClick={deleteTable}>Excluir tabela</button>
                    <p>As chaves estrangeiras que apontam para esta tabela serão removidas.</p>
                  </section>
                </div>
              ) : (
                <div className="inspector-content">
                  <section className="form-section field-editor">
                    <label className="form-label">
                      Nome do campo
                      <input value={selectedField.name} onChange={(event) => patchField(selectedTable.id, selectedField.id, { name: event.target.value })} />
                    </label>
                    <div className="form-grid">
                      <label className="form-label">
                        Tipo
                        <select value={selectedField.type} onChange={(event) => patchField(selectedTable.id, selectedField.id, { type: event.target.value })}>
                          {!POSTGRES_TYPE_VALUES.has(selectedField.type) && <option value={selectedField.type}>{selectedField.type} (importado)</option>}
                          {POSTGRES_FIELD_TYPES.map((group) => (
                            <optgroup label={group.label} key={group.label}>
                              {group.types.map((type) => <option key={type} value={type}>{type}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                      <label className="form-label">
                        Tamanho
                        <input value={selectedField.size} onChange={(event) => patchField(selectedTable.id, selectedField.id, { size: event.target.value })} placeholder="255" />
                      </label>
                    </div>
                    <label className="form-label default-value-label">
                      Valor padrão
                      <input value={selectedField.defaultValue} onChange={(event) => patchField(selectedTable.id, selectedField.id, { defaultValue: event.target.value })} placeholder="ex.: now()" />
                    </label>
                  </section>

                  <section className="form-section toggle-section">
                    <label className="toggle-row">
                      <span>
                        <strong>Permite nulo</strong>
                        <small>O campo pode ficar sem valor.</small>
                      </span>
                      <input type="checkbox" checked={selectedField.nullable} onChange={(event) => patchField(selectedTable.id, selectedField.id, { nullable: event.target.checked })} />
                    </label>
                    <label className="toggle-row">
                      <span>
                        <strong>Chave primária</strong>
                        <small>Identifica cada registro da tabela.</small>
                      </span>
                      <input type="checkbox" checked={selectedField.primaryKey} onChange={(event) => patchField(selectedTable.id, selectedField.id, { primaryKey: event.target.checked })} />
                    </label>
                    <label className="toggle-row">
                      <span>
                        <strong>Valor único</strong>
                        <small>Evita valores repetidos nesta coluna.</small>
                      </span>
                      <input type="checkbox" checked={Boolean(selectedField.unique)} onChange={(event) => patchField(selectedTable.id, selectedField.id, { unique: event.target.checked })} />
                    </label>
                    <label className="toggle-row">
                      <span>
                        <strong>Chave estrangeira</strong>
                        <small>Cria uma referência visual para outra tabela.</small>
                      </span>
                      <input type="checkbox" checked={selectedField.isForeignKey || Boolean(selectedField.foreignKey)} onChange={(event) => toggleForeignKey(event.target.checked)} />
                    </label>
                  </section>

                  {(selectedField.isForeignKey || selectedField.foreignKey) && (
                    <section className="form-section relationship-section">
                      <div className="section-heading">
                        <div>
                          <span className="section-title">Referência</span>
                          <span className="section-description">Este campo é o lado N da relação.</span>
                        </div>
                        <span className="relation-chip">N:1</span>
                      </div>
                      {model.tables.filter((table) => table.id !== selectedTable.id && table.fields.length > 0).length === 0 ? (
                        <p className="small-empty">Crie outra tabela com ao menos um campo para concluir a referência.</p>
                      ) : (
                        <>
                          <label className="form-label">
                            Tabela referenciada
                            <select value={selectedField.foreignKey?.tableId || ''} onChange={(event) => updateForeignTable(event.target.value)}>
                              <option value="">Selecione uma tabela</option>
                              {model.tables.filter((table) => table.id !== selectedTable.id && table.fields.length > 0).map((table) => <option value={table.id} key={table.id}>{table.name}</option>)}
                            </select>
                          </label>
                          <label className="form-label">
                            Campo referenciado
                            <select value={selectedField.foreignKey?.fieldId || ''} disabled={!foreignTargetTable} onChange={(event) => updateForeignField(event.target.value)}>
                              <option value="">Selecione um campo</option>
                              {foreignTargetTable?.fields.map((field) => <option value={field.id} key={field.id}>{field.name} · {fieldDescription(field)}</option>)}
                            </select>
                          </label>
                          <div className="form-grid relationship-action-grid">
                            <label className="form-label">
                              ON DELETE
                              <select value={selectedField.foreignKey?.onDelete || 'NO ACTION'} onChange={(event) => updateForeignAction('onDelete', event.target.value)}>
                                {FOREIGN_KEY_ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
                              </select>
                            </label>
                            <label className="form-label">
                              ON UPDATE
                              <select value={selectedField.foreignKey?.onUpdate || 'NO ACTION'} onChange={(event) => updateForeignAction('onUpdate', event.target.value)}>
                                {FOREIGN_KEY_ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
                              </select>
                            </label>
                          </div>
                        </>
                      )}
                    </section>
                  )}

                  <section className="form-section danger-section">
                    <button type="button" className="danger-button" onClick={deleteField}>Excluir campo</button>
                  </section>
                </div>
              )}
            </>
              )}
            </>
          ) : (
            <button
              type="button"
              className="collapsed-sidebar-button inspector-reopen-button"
              onClick={() => setIsInspectorVisible(true)}
              aria-controls="inspector-sidebar"
              aria-expanded="false"
              aria-label="Mostrar painel de propriedades"
              title="Mostrar painel de propriedades"
            >
              <PanelIcon side="right" expand />
            </button>
          )}
        </aside>
      </div>

      <footer className="statusbar">
        <span><i className="status-dot" /> Rascunho salvo localmente</span>
        <span>Ctrl / ⌘ + S para exportar JSON</span>
      </footer>

      {notice && (
        <div className={`notice ${notice.type}`} role="status">
          <span>{notice.type === 'error' ? '!' : '✓'}</span>
          <p>{notice.message}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso">×</button>
        </div>
      )}

      {isAddTableOpen && <AddTableDialog onClose={() => setIsAddTableOpen(false)} onCreate={createTable} />}
      {importPreview && <ImportDialog preview={importPreview} onClose={() => setImportPreview(null)} onConfirm={confirmImport} />}
      {pendingAction && <ConfirmDialog action={pendingAction} onCancel={() => setPendingAction(null)} onConfirm={confirmPendingAction} />}
      {isStorageNoticeOpen && <StorageNoticeDialog onConfirm={dismissStorageNotice} />}
    </main>
  )
}

export default App
