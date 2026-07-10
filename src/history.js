/**
 * Número máximo de versões anteriores mantidas no histórico.
 *
 * O estado atual não entra nessa contagem: com o limite cheio, ainda há uma
 * versão presente além das versões disponíveis para desfazer.
 */
export const HISTORY_LIMIT = 100

/**
 * Cria o estado inicial do histórico de um modelo.
 *
 * Os snapshots são clonados para que uma alteração externa no objeto entregue
 * ao histórico não altere versões já armazenadas.
 */
export function createModelHistory(present) {
  return {
    past: [],
    present: cloneSnapshot(present),
    future: [],
  }
}

/**
 * Redutor puro para o histórico do modelo.
 *
 * - `commit` registra o presente em `past`, aplica `update` e descarta `future`;
 * - `undo` restaura a versão mais recente de `past`;
 * - `redo` restaura a próxima versão de `future`.
 * - uma transação permite atualizar visualmente o presente diversas vezes e
 *   registrar apenas um ponto no histórico ao final (usada no arraste).
 *
 * `update` pode ser o próximo modelo inteiro ou uma função que recebe uma
 * cópia do modelo atual e retorna o próximo modelo.
 */
export function modelHistoryReducer(state, action) {
  switch (action?.type) {
    case 'commit':
      return commit(state, action.update)
    case 'begin-transaction':
      return beginTransaction(state)
    case 'preview-transaction':
      return previewTransaction(state, action.update)
    case 'finish-transaction':
      return finishTransaction(state)
    case 'cancel-transaction':
      return cancelTransaction(state)
    case 'undo':
      return undo(state)
    case 'redo':
      return redo(state)
    default:
      return state
  }
}

function commit(state, update) {
  const baseState = state.transaction ? finishTransaction(state) : state
  const previous = cloneSnapshot(baseState.present)
  const next = typeof update === 'function'
    ? update(cloneSnapshot(previous))
    : update

  return {
    past: [...baseState.past, previous].slice(-HISTORY_LIMIT),
    present: cloneSnapshot(next),
    future: [],
  }
}

function beginTransaction(state) {
  if (state.transaction) return state
  return { ...state, transaction: cloneSnapshot(state.present) }
}

function previewTransaction(state, update) {
  if (!state.transaction) return state
  const next = typeof update === 'function'
    ? update(cloneSnapshot(state.present))
    : update
  return { ...state, present: cloneSnapshot(next) }
}

function finishTransaction(state) {
  if (!state.transaction) return state
  const { transaction, ...history } = state
  if (snapshotsMatch(transaction, history.present)) return history

  return {
    ...history,
    past: [...history.past, cloneSnapshot(transaction)].slice(-HISTORY_LIMIT),
    future: [],
  }
}

function cancelTransaction(state) {
  if (!state.transaction) return state
  const { transaction, ...history } = state
  return { ...history, present: cloneSnapshot(transaction) }
}

function undo(state) {
  if (state.transaction) return state
  if (state.past.length === 0) {
    return state
  }

  const previousIndex = state.past.length - 1
  const previous = state.past[previousIndex]

  return {
    past: state.past.slice(0, previousIndex),
    present: cloneSnapshot(previous),
    future: [cloneSnapshot(state.present), ...state.future],
  }
}

function redo(state) {
  if (state.transaction) return state
  if (state.future.length === 0) {
    return state
  }

  const [next, ...remainingFuture] = state.future

  return {
    past: [...state.past, cloneSnapshot(state.present)].slice(-HISTORY_LIMIT),
    present: cloneSnapshot(next),
    future: remainingFuture,
  }
}

function cloneSnapshot(value) {
  return structuredClone(value)
}

function snapshotsMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}
