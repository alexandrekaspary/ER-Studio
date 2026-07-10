import { typeSupportsSize } from './model.js'

const FOREIGN_KEY_ACTIONS = new Set(['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'])

function quoteIdentifier(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function quoteLiteral(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`
}

function normalizeType(type) {
  const value = String(type || 'VARCHAR').trim().replace(/\s+/g, ' ')
  const isSafeType = /^[A-Za-z][A-Za-z0-9_.]*(?:\s+[A-Za-z][A-Za-z0-9_.]*)*(?:\[\])?$/.test(value)
  return isSafeType ? value.toUpperCase() : 'VARCHAR'
}

function formatDataType(field) {
  const type = normalizeType(field.type)
  const size = String(field.size ?? '').trim()
  const isSafeSize = /^\d+(?:\s*,\s*\d+)?$/.test(size)

  if (!size || !isSafeSize || !typeSupportsSize(type) || type.includes('(')) return type
  return `${type}(${size})`
}

function normalizeAction(value) {
  const action = String(value || 'NO ACTION').trim().replace(/\s+/g, ' ').toUpperCase()
  return FOREIGN_KEY_ACTIONS.has(action) ? action : 'NO ACTION'
}

function commentText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function constraintToken(value) {
  return String(value || 'item')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'item'
}

function shortHash(value) {
  let hash = 2166136261
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function foreignKeyConstraintName(table, field) {
  const suffix = shortHash(`${table.id || table.name}:${field.id || field.name}`)
  const base = `fk_${constraintToken(table.name)}_${constraintToken(field.name)}`
  return `${base.slice(0, 54)}_${suffix}`.slice(0, 63)
}

function checkConstraintName(table, field) {
  const suffix = shortHash(`${table.id || table.name}:${field.id || field.name}`)
  const base = `ck_${constraintToken(table.name)}_${constraintToken(field.name)}`
  return `${base.slice(0, 54)}_${suffix}`.slice(0, 63)
}

function checkExpression(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function createTableSql(table) {
  const fields = Array.isArray(table.fields) ? table.fields : []
  const columns = fields.map((field) => {
    const parts = [quoteIdentifier(field.name), formatDataType(field)]
    const defaultValue = String(field.defaultValue ?? '').trim()
    if (defaultValue) parts.push(`DEFAULT ${defaultValue}`)
    if (!field.nullable) parts.push('NOT NULL')
    return parts.join(' ')
  })

  const primaryKeyFields = fields.filter((field) => field.primaryKey)
  if (primaryKeyFields.length > 0) {
    columns.push(`PRIMARY KEY (${primaryKeyFields.map((field) => quoteIdentifier(field.name)).join(', ')})`)
  }

  fields
    .filter((field) => field.unique && !field.primaryKey)
    .forEach((field) => columns.push(`UNIQUE (${quoteIdentifier(field.name)})`))

  fields.forEach((field) => {
    const expression = checkExpression(field.checkConstraint)
    if (expression) {
      columns.push(`CONSTRAINT ${quoteIdentifier(checkConstraintName(table, field))} CHECK (${expression})`)
    }
  })

  const definition = columns.length > 0
    ? `\n  ${columns.join(',\n  ')}\n`
    : ''

  return `CREATE TABLE ${quoteIdentifier(table.name)} (${definition});`
}

function foreignKeyStatements(tables) {
  const tableById = new Map(tables.map((table) => [table.id, table]))

  return tables.flatMap((table) => (table.fields || []).flatMap((field) => {
    const foreignKey = field.foreignKey
    if (!foreignKey?.tableId || !foreignKey?.fieldId) return []

    const targetTable = tableById.get(foreignKey.tableId)
    const targetField = targetTable?.fields?.find((candidate) => candidate.id === foreignKey.fieldId)
    if (!targetTable || !targetField) return []

    const name = foreignKeyConstraintName(table, field)
    return [`ALTER TABLE ${quoteIdentifier(table.name)}\n  ADD CONSTRAINT ${quoteIdentifier(name)}\n  FOREIGN KEY (${quoteIdentifier(field.name)})\n  REFERENCES ${quoteIdentifier(targetTable.name)} (${quoteIdentifier(targetField.name)})\n  ON DELETE ${normalizeAction(foreignKey.onDelete)}\n  ON UPDATE ${normalizeAction(foreignKey.onUpdate)};`]
  }))
}

function indexStatements(tables) {
  return tables.flatMap((table) => {
    const fieldsById = new Map((table.fields || []).map((field) => [field.id, field]))

    return (table.indexes || []).flatMap((index) => {
      const fields = (index.fieldIds || []).map((fieldId) => fieldsById.get(fieldId))
      if (fields.length === 0 || fields.some((field) => !field)) return []

      const columns = fields.map((field) => quoteIdentifier(field.name)).join(', ')
      if (index.unique) {
        return [`ALTER TABLE ${quoteIdentifier(table.name)}\n  ADD CONSTRAINT ${quoteIdentifier(index.name)}\n  UNIQUE (${columns});`]
      }
      return [`CREATE INDEX ${quoteIdentifier(index.name)} ON ${quoteIdentifier(table.name)} (${columns});`]
    })
  })
}

function commentStatements(tables) {
  return tables.flatMap((table) => {
    const statements = []
    const tableComment = commentText(table.comment)
    if (tableComment) {
      statements.push(`COMMENT ON TABLE ${quoteIdentifier(table.name)} IS ${quoteLiteral(tableComment)};`)
    }

    ;(table.fields || []).forEach((field) => {
      const fieldComment = commentText(field.comment)
      if (fieldComment) {
        statements.push(`COMMENT ON COLUMN ${quoteIdentifier(table.name)}.${quoteIdentifier(field.name)} IS ${quoteLiteral(fieldComment)};`)
      }
    })

    return statements
  })
}

function modelNotesHeader(notes) {
  const text = commentText(notes)
  if (!text) return ''
  const escaped = text.replace(/\*\//g, '* /')
  const lines = escaped.split(/\r?\n/).map((line) => ` * ${line}`)
  return ['/*', ' * Observações do modelo:', ...lines, ' */'].join('\n')
}

export function generatePostgresSql(model) {
  const tables = Array.isArray(model?.tables) ? model.tables : []
  const blocks = ['-- Script PostgreSQL gerado pelo ER Studio.']
  const notesHeader = modelNotesHeader(model?.notes)
  if (notesHeader) blocks.push(notesHeader)

  const tableStatements = tables.map(createTableSql)
  if (tableStatements.length > 0) blocks.push(tableStatements.join('\n\n'))

  const foreignKeys = foreignKeyStatements(tables)
  if (foreignKeys.length > 0) blocks.push(foreignKeys.join('\n\n'))

  const indexes = indexStatements(tables)
  if (indexes.length > 0) blocks.push(indexes.join('\n\n'))

  const comments = commentStatements(tables)
  if (comments.length > 0) blocks.push(comments.join('\n'))

  return `${blocks.join('\n\n')}\n`
}
