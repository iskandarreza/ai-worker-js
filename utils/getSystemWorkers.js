import { store } from '../store/store'

export async function getSystemWorkers() {
  const state = await store.getState((state) => state)
  const { workerStates } = state
  const { workerRegistry } = workerStates

  return workerRegistry.filter((worker) => worker.type === 'system-worker')
}
