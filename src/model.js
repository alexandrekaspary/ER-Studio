export const TABLE_COLORS = [
  '#1f5f7a',
  '#345995',
  '#6b4c9a',
  '#9a5b13',
  '#7a3f4f',
  '#2f6b52',
  '#64748b',
  '#9b3f3f',
]

export const FOREIGN_KEY_ACTIONS = ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT']

export function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function emptyField() {
  return {
    id: makeId('field'),
    name: 'novo_campo',
    type: 'VARCHAR',
    size: '255',
    defaultValue: '',
    nullable: true,
    primaryKey: false,
    unique: false,
    comment: '',
    notes: '',
    isForeignKey: false,
    foreignKey: null,
  }
}

export function getRelations(model) {
  return model.tables.flatMap((table) =>
    table.fields.flatMap((field) => {
      const target = field.foreignKey
      if (!target?.tableId || !target?.fieldId) return []
      const targetTable = model.tables.find((item) => item.id === target.tableId)
      const targetField = targetTable?.fields.find((item) => item.id === target.fieldId)
      if (!targetTable || !targetField) return []

      return [{
        id: `rel_${table.id}_${field.id}`,
        fromTableId: table.id,
        fromFieldId: field.id,
        toTableId: targetTable.id,
        toFieldId: targetField.id,
        cardinality: 'N:1',
        onDelete: target.onDelete || 'NO ACTION',
        onUpdate: target.onUpdate || 'NO ACTION',
      }]
    }),
  )
}

export function createExportPayload(model, exportedAt = new Date().toISOString()) {
  return {
    version: 1,
    name: model.name,
    notes: model.notes || '',
    exportedAt,
    tables: model.tables,
    relationships: getRelations(model),
  }
}

function readBoolean(value, fallback, label) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'boolean') {
    throw new Error(`O atributo "${label}" precisa ser verdadeiro ou falso.`)
  }
  return value
}

function readOptionalText(value, label) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') {
    throw new Error(`O atributo "${label}" precisa ser um texto.`)
  }
  return value.trim()
}

function readId(value, fallbackPrefix, label) {
  if (value === undefined || value === null || value === '') return makeId(fallbackPrefix)
  if (typeof value !== 'string') {
    throw new Error(`O identificador de ${label} precisa ser um texto.`)
  }
  const id = value.trim()
  return id || makeId(fallbackPrefix)
}

function readReferenceId(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`A relação precisa informar ${label}.`)
  }
  return value.trim()
}

function normalizeForeignKey(rawForeignKey, tableName, fieldName) {
  if (rawForeignKey == null) return null
  if (typeof rawForeignKey !== 'object' || Array.isArray(rawForeignKey)) {
    throw new Error(`A chave estrangeira "${tableName}.${fieldName}" é inválida.`)
  }

  const tableId = rawForeignKey.tableId
  const fieldId = rawForeignKey.fieldId
  const tableIsBlank = tableId === undefined || tableId === null || tableId === ''
  const fieldIsBlank = fieldId === undefined || fieldId === null || fieldId === ''

  if (tableIsBlank && fieldIsBlank) return null
  if (typeof tableId !== 'string' || typeof fieldId !== 'string') {
    throw new Error(`A chave estrangeira "${tableName}.${fieldName}" precisa usar IDs em texto.`)
  }
  if (!tableId.trim() || !fieldId.trim()) {
    throw new Error(`A chave estrangeira "${tableName}.${fieldName}" está incompleta.`)
  }

  return {
    tableId: tableId.trim(),
    fieldId: fieldId.trim(),
    onDelete: normalizeForeignKeyAction(rawForeignKey.onDelete, 'onDelete'),
    onUpdate: normalizeForeignKeyAction(rawForeignKey.onUpdate, 'onUpdate'),
  }
}

function normalizeForeignKeyAction(value, label) {
  if (value === undefined || value === null || value === '') return 'NO ACTION'
  const action = typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').toUpperCase()
    : ''
  if (!FOREIGN_KEY_ACTIONS.includes(action)) {
    throw new Error(`A ação "${label}" da chave estrangeira é inválida.`)
  }
  return action
}

export function normalizeModel(rawModel) {
  if (!rawModel || typeof rawModel !== 'object' || Array.isArray(rawModel)) {
    throw new Error('O arquivo não contém um modelo válido.')
  }
  if (rawModel.version !== undefined && rawModel.version !== 1) {
    throw new Error(`A versão "${rawModel.version}" não é compatível com este editor.`)
  }
  if (!Array.isArray(rawModel.tables)) {
    throw new Error('O JSON precisa conter uma lista de tabelas.')
  }

  const tableIds = new Set()
  const tables = rawModel.tables.map((rawTable, tableIndex) => {
    if (!rawTable || typeof rawTable !== 'object' || Array.isArray(rawTable)) {
      throw new Error(`A tabela na posição ${tableIndex + 1} é inválida.`)
    }
    if (typeof rawTable.name !== 'string' || !rawTable.name.trim()) {
      throw new Error(`A tabela na posição ${tableIndex + 1} não tem nome.`)
    }
    if (!Array.isArray(rawTable.fields)) {
      throw new Error(`A tabela "${rawTable.name}" não possui uma lista de campos.`)
    }

    const id = readId(rawTable.id, 'table', `tabela "${rawTable.name}"`)
    if (tableIds.has(id)) {
      throw new Error(`O identificador da tabela "${id}" está duplicado.`)
    }
    tableIds.add(id)

    const fieldIds = new Set()
    const fields = rawTable.fields.map((rawField, fieldIndex) => {
      if (!rawField || typeof rawField !== 'object' || Array.isArray(rawField)) {
        throw new Error(`Um campo de "${rawTable.name}" é inválido.`)
      }
      if (typeof rawField.name !== 'string' || !rawField.name.trim()) {
        throw new Error(`Um campo de "${rawTable.name}" não tem nome.`)
      }

      const fieldId = readId(rawField.id, 'field', `campo "${rawField.name}"`)
      if (fieldIds.has(fieldId)) {
        throw new Error(`O campo "${rawField.name || fieldIndex + 1}" está duplicado em "${rawTable.name}".`)
      }
      fieldIds.add(fieldId)

      const foreignKey = normalizeForeignKey(rawField.foreignKey, rawTable.name, rawField.name)
      readBoolean(rawField.isForeignKey, false, 'isForeignKey')

      return {
        id: fieldId,
        name: rawField.name.trim(),
        type: typeof rawField.type === 'string' && rawField.type.trim() ? rawField.type.trim().toUpperCase() : 'VARCHAR',
        size: rawField.size == null ? '' : String(rawField.size),
        defaultValue: rawField.defaultValue == null ? '' : String(rawField.defaultValue),
        nullable: readBoolean(rawField.nullable, true, 'nullable'),
        primaryKey: readBoolean(rawField.primaryKey, false, 'primaryKey'),
        unique: readBoolean(rawField.unique, false, 'unique'),
        comment: readOptionalText(rawField.comment, 'comment'),
        notes: readOptionalText(rawField.notes, 'notes'),
        isForeignKey: Boolean(foreignKey),
        foreignKey,
      }
    })

    return {
      id,
      name: rawTable.name.trim(),
      color: typeof rawTable.color === 'string' && rawTable.color.trim() ? rawTable.color : TABLE_COLORS[tableIndex % TABLE_COLORS.length],
      collapsed: readBoolean(rawTable.collapsed, false, 'collapsed'),
      comment: readOptionalText(rawTable.comment, 'comment'),
      notes: readOptionalText(rawTable.notes, 'notes'),
      position: {
        x: Number.isFinite(rawTable.position?.x) ? rawTable.position.x : 76 + tableIndex * 44,
        y: Number.isFinite(rawTable.position?.y) ? rawTable.position.y : 82 + tableIndex * 38,
      },
      fields,
    }
  })

  if (rawModel.relationships !== undefined && !Array.isArray(rawModel.relationships)) {
    throw new Error('A lista de relações precisa ser um array.')
  }

  rawModel.relationships?.forEach((relationship, index) => {
    if (!relationship || typeof relationship !== 'object' || Array.isArray(relationship)) {
      throw new Error(`A relação na posição ${index + 1} é inválida.`)
    }

    const fromTableId = readReferenceId(relationship.fromTableId, 'a tabela de origem')
    const fromFieldId = readReferenceId(relationship.fromFieldId, 'o campo de origem')
    const toTableId = readReferenceId(relationship.toTableId, 'a tabela referenciada')
    const toFieldId = readReferenceId(relationship.toFieldId, 'o campo referenciado')
    const fromTable = tables.find((table) => table.id === fromTableId)
    const fromField = fromTable?.fields.find((field) => field.id === fromFieldId)

    if (!fromTable || !fromField) {
      throw new Error(`A relação ${index + 1} aponta para uma origem inexistente.`)
    }

    const onDelete = relationship.onDelete === undefined
      ? fromField.foreignKey?.onDelete || 'NO ACTION'
      : normalizeForeignKeyAction(relationship.onDelete, 'onDelete')
    const onUpdate = relationship.onUpdate === undefined
      ? fromField.foreignKey?.onUpdate || 'NO ACTION'
      : normalizeForeignKeyAction(relationship.onUpdate, 'onUpdate')

    if (fromField.foreignKey && (
      fromField.foreignKey.tableId !== toTableId
      || fromField.foreignKey.fieldId !== toFieldId
      || fromField.foreignKey.onDelete !== onDelete
      || fromField.foreignKey.onUpdate !== onUpdate
    )) {
      throw new Error(`A relação ${index + 1} diverge da FK em "${fromTable.name}.${fromField.name}".`)
    }

    fromField.foreignKey = { tableId: toTableId, fieldId: toFieldId, onDelete, onUpdate }
    fromField.isForeignKey = true
  })

  tables.forEach((table) => {
    table.fields.forEach((field) => {
      if (!field.foreignKey) {
        field.isForeignKey = false
        return
      }

      const targetTable = tables.find((item) => item.id === field.foreignKey.tableId)
      const targetField = targetTable?.fields.find((item) => item.id === field.foreignKey.fieldId)
      if (!targetTable || !targetField) {
        throw new Error(`A chave estrangeira "${table.name}.${field.name}" aponta para um campo inexistente.`)
      }
      field.isForeignKey = true
    })
  })

  return {
    version: 1,
    name: typeof rawModel.name === 'string' && rawModel.name.trim() ? rawModel.name.trim() : 'Modelo sem nome',
    notes: readOptionalText(rawModel.notes, 'notes'),
    tables,
  }
}
