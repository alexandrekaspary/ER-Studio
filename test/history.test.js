import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createModelHistory,
  HISTORY_LIMIT,
  modelHistoryReducer,
} from '../src/history.js'

function reduce(state, action) {
  return modelHistoryReducer(state, action)
}

test('registra commits sem alterar o modelo anterior', () => {
  const initialModel = { name: 'Inicial', tables: [] }
  const history = createModelHistory(initialModel)
  const next = reduce(history, {
    type: 'commit',
    update: (model) => ({ ...model, name: 'Com tabelas', tables: [{ id: 'users' }] }),
  })

  assert.deepEqual(history, {
    past: [],
    present: { name: 'Inicial', tables: [] },
    future: [],
  })
  assert.deepEqual(next, {
    past: [{ name: 'Inicial', tables: [] }],
    present: { name: 'Com tabelas', tables: [{ id: 'users' }] },
    future: [],
  })
  assert.notStrictEqual(next.past[0], history.present)
})

test('isola o snapshot anterior quando a função de atualização o modifica', () => {
  const history = createModelHistory({ table: { name: 'clientes' } })
  const next = reduce(history, {
    type: 'commit',
    update: (model) => {
      model.table.name = 'fornecedores'
      return model
    },
  })

  assert.equal(history.present.table.name, 'clientes')
  assert.equal(next.past[0].table.name, 'clientes')
  assert.equal(next.present.table.name, 'fornecedores')
})

test('desfaz e refaz commits na ordem correta', () => {
  let history = createModelHistory({ revision: 0 })
  history = reduce(history, { type: 'commit', update: { revision: 1 } })
  history = reduce(history, { type: 'commit', update: { revision: 2 } })

  history = reduce(history, { type: 'undo' })
  assert.equal(history.present.revision, 1)
  assert.deepEqual(history.past.map((model) => model.revision), [0])
  assert.deepEqual(history.future.map((model) => model.revision), [2])

  history = reduce(history, { type: 'undo' })
  assert.equal(history.present.revision, 0)
  assert.deepEqual(history.future.map((model) => model.revision), [1, 2])

  history = reduce(history, { type: 'redo' })
  assert.equal(history.present.revision, 1)
  assert.deepEqual(history.future.map((model) => model.revision), [2])

  history = reduce(history, { type: 'redo' })
  assert.equal(history.present.revision, 2)
  assert.deepEqual(history.future, [])
})

test('um novo commit após desfazer remove versões de refazer', () => {
  let history = createModelHistory({ revision: 0 })
  history = reduce(history, { type: 'commit', update: { revision: 1 } })
  history = reduce(history, { type: 'commit', update: { revision: 2 } })
  history = reduce(history, { type: 'undo' })

  const next = reduce(history, { type: 'commit', update: { revision: 'alternativa' } })

  assert.equal(next.present.revision, 'alternativa')
  assert.deepEqual(next.past.map((model) => model.revision), [0, 1])
  assert.deepEqual(next.future, [])
})

test('mantém somente o número máximo de versões anteriores', () => {
  let history = createModelHistory({ revision: 0 })

  for (let revision = 1; revision <= HISTORY_LIMIT + 5; revision += 1) {
    history = reduce(history, { type: 'commit', update: { revision } })
  }

  assert.equal(history.past.length, HISTORY_LIMIT)
  assert.equal(history.past[0].revision, 5)
  assert.equal(history.past.at(-1).revision, HISTORY_LIMIT + 4)
  assert.equal(history.present.revision, HISTORY_LIMIT + 5)
})

test('agrupa prévias de uma transação em uma única alteração do histórico', () => {
  let history = createModelHistory({ position: { x: 10, y: 10 } })
  history = reduce(history, { type: 'begin-transaction' })
  history = reduce(history, { type: 'preview-transaction', update: { position: { x: 30, y: 35 } } })
  history = reduce(history, { type: 'preview-transaction', update: { position: { x: 80, y: 90 } } })

  assert.deepEqual(history.past, [])
  assert.deepEqual(history.present, { position: { x: 80, y: 90 } })

  history = reduce(history, { type: 'finish-transaction' })
  assert.deepEqual(history.past, [{ position: { x: 10, y: 10 } }])
  assert.deepEqual(history.present, { position: { x: 80, y: 90 } })

  history = reduce(history, { type: 'undo' })
  assert.deepEqual(history.present, { position: { x: 10, y: 10 } })
})

test('descarta uma transação sem movimento e permite cancelar uma prévia', () => {
  let history = createModelHistory({ position: { x: 10, y: 10 } })
  history = reduce(history, { type: 'begin-transaction' })
  history = reduce(history, { type: 'finish-transaction' })
  assert.deepEqual(history.past, [])

  history = reduce(history, { type: 'begin-transaction' })
  history = reduce(history, { type: 'preview-transaction', update: { position: { x: 50, y: 50 } } })
  history = reduce(history, { type: 'cancel-transaction' })
  assert.deepEqual(history.present, { position: { x: 10, y: 10 } })
  assert.deepEqual(history.past, [])
})
