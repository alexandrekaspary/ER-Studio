import assert from 'node:assert/strict'
import test from 'node:test'
import { generatePostgresSql } from '../src/sql.js'

function createSqlFixture() {
  return {
    name: 'Comercial',
    notes: 'Execute depois de habilitar pgcrypto.\nRevisar permissões.',
    tables: [
      {
        id: 'orders',
        name: 'pedidos',
        comment: 'Pedidos feitos pelos clientes.',
        indexes: [
          {
            id: 'orders_customer_created_index',
            name: 'idx_pedidos_cliente_id_id',
            fieldIds: ['orders_customer_id', 'orders_id'],
            unique: false,
          },
          {
            id: 'orders_customer_unique',
            name: 'uq_pedidos_cliente_id_id',
            fieldIds: ['orders_customer_id', 'orders_id'],
            unique: true,
          },
        ],
        fields: [
          {
            id: 'orders_id',
            name: 'id',
            type: 'UUID',
            size: '',
            defaultValue: 'gen_random_uuid()',
            nullable: false,
            primaryKey: true,
            unique: false,
            checkConstraint: '',
            comment: 'Identificador do pedido.',
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
            unique: false,
            checkConstraint: 'cliente_id IS NOT NULL',
            comment: '',
            foreignKey: {
              tableId: 'customers',
              fieldId: 'customers_id',
              onDelete: 'CASCADE',
              onUpdate: 'RESTRICT',
            },
          },
        ],
      },
      {
        id: 'customers',
        name: 'clientes',
        comment: "Cadastro d'os clientes.",
        indexes: [],
        fields: [
          {
            id: 'customers_id',
            name: 'id',
            type: 'UUID',
            size: '',
            defaultValue: '',
            nullable: false,
            primaryKey: true,
            unique: false,
            checkConstraint: '',
            comment: '',
            foreignKey: null,
          },
          {
            id: 'customers_email',
            name: 'email',
            type: 'VARCHAR',
            size: '255',
            defaultValue: '',
            nullable: false,
            primaryKey: false,
            unique: true,
            checkConstraint: '',
            comment: 'E-mail principal.',
            foreignKey: null,
          },
        ],
      },
    ],
  }
}

test('gera SQL PostgreSQL com FKs após todas as tabelas e comentários', () => {
  const sql = generatePostgresSql(createSqlFixture())

  assert.match(sql, /CREATE TABLE "pedidos" \(/)
  assert.match(sql, /"id" UUID DEFAULT gen_random_uuid\(\) NOT NULL/)
  assert.match(sql, /CREATE TABLE "clientes" \(/)
  assert.match(sql, /"email" VARCHAR\(255\) NOT NULL/)
  assert.match(sql, /PRIMARY KEY \("id"\)/)
  assert.match(sql, /UNIQUE \("email"\)/)
  assert.match(sql, /CONSTRAINT "ck_pedidos_cliente_id_.*" CHECK \(cliente_id IS NOT NULL\)/)
  assert.match(sql, /ALTER TABLE "pedidos"\n  ADD CONSTRAINT "fk_pedidos_cliente_id_/)
  assert.match(sql, /FOREIGN KEY \("cliente_id"\)\n  REFERENCES "clientes" \("id"\)\n  ON DELETE CASCADE\n  ON UPDATE RESTRICT;/)
  assert.match(sql, /CREATE INDEX "idx_pedidos_cliente_id_id" ON "pedidos" \("cliente_id", "id"\);/)
  assert.match(sql, /ALTER TABLE "pedidos"\n  ADD CONSTRAINT "uq_pedidos_cliente_id_id"\n  UNIQUE \("cliente_id", "id"\);/)
  assert.match(sql, /COMMENT ON TABLE "clientes" IS 'Cadastro d''os clientes\.';/)
  assert.match(sql, /COMMENT ON COLUMN "pedidos"\."id" IS 'Identificador do pedido\.';/)
  assert.match(sql, /Observações do modelo:/)
  assert.ok(sql.indexOf('CREATE TABLE "clientes"') < sql.indexOf('ALTER TABLE "pedidos"'))
})

test('protege identificadores e normaliza valores inválidos sem quebrar o script', () => {
  const sql = generatePostgresSql({
    tables: [{
      id: 'weird',
      name: 'usuários"arquivo',
      indexes: [],
      fields: [{
        id: 'weird_id',
        name: 'código"externo',
        type: 'VARCHAR; DROP TABLE x',
        size: '255); DROP TABLE x',
        defaultValue: '',
        nullable: true,
        primaryKey: false,
        unique: false,
        checkConstraint: '',
        foreignKey: null,
      }],
    }],
  })

  assert.match(sql, /CREATE TABLE "usuários""arquivo" \(/)
  assert.match(sql, /"código""externo" VARCHAR/)
  assert.doesNotMatch(sql, /DROP TABLE/)
})
