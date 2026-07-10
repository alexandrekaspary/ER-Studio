import assert from 'node:assert/strict'
import test from 'node:test'
import { createExportPayload, getRelations, normalizeModel } from '../src/model.js'

function createModelFixture() {
  return {
    version: 1,
    name: 'Modelo de vendas',
    notes: 'Usado para validar o fluxo de pedidos.',
    tables: [
      {
        id: 'customers',
        name: 'clientes',
        color: '#1f5f7a',
        collapsed: true,
        comment: 'Cadastro de clientes.',
        notes: 'Dados sincronizados com o CRM.',
        position: { x: 80, y: 120 },
        fields: [
          {
            id: 'customers_id',
            name: 'id',
            type: 'uuid',
            size: '',
            defaultValue: 'gen_random_uuid()',
            nullable: false,
            primaryKey: true,
            unique: false,
            comment: 'Identificador público do cliente.',
            notes: 'Gerado pela extensão pgcrypto.',
            isForeignKey: false,
            foreignKey: null,
          },
        ],
      },
      {
        id: 'orders',
        name: 'pedidos',
        color: '#9a5b13',
        collapsed: false,
        comment: 'Pedidos realizados pelos clientes.',
        notes: '',
        position: { x: 480, y: 200 },
        fields: [
          {
            id: 'orders_id',
            name: 'id',
            type: 'UUID',
            size: '',
            defaultValue: '',
            nullable: false,
            primaryKey: true,
            unique: false,
            comment: '',
            notes: '',
            isForeignKey: false,
            foreignKey: null,
          },
          {
            id: 'orders_customer_id',
            name: 'cliente_id',
            type: 'UUID',
            size: '',
            defaultValue: '',
            nullable: false,
            primaryKey: false,
            unique: true,
            comment: 'Cliente responsável pelo pedido.',
            notes: 'Índice adicional pode ser necessário para consultas frequentes.',
            isForeignKey: true,
            foreignKey: {
              tableId: 'customers',
              fieldId: 'customers_id',
              onDelete: 'CASCADE',
              onUpdate: 'RESTRICT',
            },
          },
        ],
      },
    ],
  }
}

test('exportação e importação preservam o modelo e a FK', () => {
  const normalized = normalizeModel(createModelFixture())
  const payload = createExportPayload(normalized, '2026-07-09T12:00:00.000Z')
  const imported = normalizeModel(JSON.parse(JSON.stringify(payload)))

  assert.equal(payload.version, 1)
  assert.equal(payload.exportedAt, '2026-07-09T12:00:00.000Z')
  assert.equal(payload.notes, 'Usado para validar o fluxo de pedidos.')
  assert.deepEqual(payload.relationships, [{
    id: 'rel_orders_orders_customer_id',
    fromTableId: 'orders',
    fromFieldId: 'orders_customer_id',
    toTableId: 'customers',
    toFieldId: 'customers_id',
    cardinality: 'N:1',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  }])
  assert.deepEqual(imported, normalized)
  assert.deepEqual(getRelations(imported), payload.relationships)
})

test('importa o formato legado com relações separadas', () => {
  const legacy = createModelFixture()
  delete legacy.notes
  delete legacy.tables[0].comment
  delete legacy.tables[0].notes
  delete legacy.tables[0].fields[0].unique
  delete legacy.tables[0].fields[0].comment
  delete legacy.tables[0].fields[0].notes
  legacy.tables[1].fields[1].isForeignKey = false
  legacy.tables[1].fields[1].foreignKey = null
  legacy.relationships = [{
    fromTableId: 'orders',
    fromFieldId: 'orders_customer_id',
    toTableId: 'customers',
    toFieldId: 'customers_id',
  }]

  const imported = normalizeModel(legacy)
  const foreignKeyField = imported.tables[1].fields[1]

  assert.equal(foreignKeyField.isForeignKey, true)
  assert.deepEqual(foreignKeyField.foreignKey, {
    tableId: 'customers',
    fieldId: 'customers_id',
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  assert.equal(imported.tables[0].fields[0].unique, false)
  assert.equal(imported.notes, '')
  assert.equal(imported.tables[0].comment, '')
  assert.equal(imported.tables[0].fields[0].notes, '')
})

test('normaliza e valida as ações de chave estrangeira', () => {
  const fixture = createModelFixture()
  fixture.tables[1].fields[1].foreignKey.onDelete = ' cascade '
  fixture.tables[1].fields[1].foreignKey.onUpdate = 'set   null'

  const imported = normalizeModel(fixture)
  assert.deepEqual(imported.tables[1].fields[1].foreignKey, {
    tableId: 'customers',
    fieldId: 'customers_id',
    onDelete: 'CASCADE',
    onUpdate: 'SET NULL',
  })

  fixture.tables[1].fields[1].foreignKey.onDelete = 'APAGAR TUDO'
  assert.throws(() => normalizeModel(fixture), /ação "onDelete"/)
})

test('normaliza uma FK vazia como campo sem relação', () => {
  const fixture = createModelFixture()
  fixture.tables[1].fields[1].isForeignKey = true
  fixture.tables[1].fields[1].foreignKey = {}

  const imported = normalizeModel(fixture)
  const field = imported.tables[1].fields[1]

  assert.equal(field.isForeignKey, false)
  assert.equal(field.foreignKey, null)
})

test('rejeita versões, relações e FKs inválidas', () => {
  const missingTables = { version: 1, name: 'Inválido' }
  const unsupportedVersion = { ...createModelFixture(), version: 2 }
  const danglingReference = createModelFixture()
  danglingReference.tables[1].fields[1].foreignKey = { tableId: 'customers', fieldId: 'missing' }
  const numericForeignKey = createModelFixture()
  numericForeignKey.tables[1].fields[1].foreignKey = { tableId: 1, fieldId: 2 }
  const invalidUnique = createModelFixture()
  invalidUnique.tables[1].fields[1].unique = 'sim'
  const invalidComment = createModelFixture()
  invalidComment.tables[0].comment = { texto: 'inválido' }

  assert.throws(() => normalizeModel(missingTables), /lista de tabelas/)
  assert.throws(() => normalizeModel(unsupportedVersion), /não é compatível/)
  assert.throws(() => normalizeModel(danglingReference), /campo inexistente/)
  assert.throws(() => normalizeModel(numericForeignKey), /IDs em texto/)
  assert.throws(() => normalizeModel(invalidUnique), /"unique"/)
  assert.throws(() => normalizeModel(invalidComment), /"comment"/)
})
