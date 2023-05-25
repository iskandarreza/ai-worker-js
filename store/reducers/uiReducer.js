import {
  CREATE_WORKER_CONFIG,
  HIDE_AGENT_CONFIG_FORM,
  REMOVE_WORKER_CONFIG,
  SHOW_AGENT_CONFIG_FORM,
} from '../types'

const initialState = {
  isConfiguringWorker: false,
  workerConfig: [],
}

export default function (state = initialState, action) {
  switch (action.type) {
    case SHOW_AGENT_CONFIG_FORM:
      return {
        ...state,
        isConfiguringWorker: true,
      }

    case HIDE_AGENT_CONFIG_FORM:
      return {
        ...state,
        isConfiguringWorker: false,
      }

    case CREATE_WORKER_CONFIG:
      const updatedConfig = {
        id: action.payload.id,
        name: action.payload.name || '',
        description: action.payload.description || '',
        goals: action.payload.goals || [],
        constraints: action.payload.constraints || [],
      }

      const existingConfigIndex = state.workerConfig.findIndex(
        (config) => config.id === updatedConfig.id
      )
      if (existingConfigIndex !== -1) {
        // If a config with the same ID already exists, update it
        const updatedWorkerConfig = [...state.workerConfig]
        updatedWorkerConfig[existingConfigIndex] = updatedConfig

        return {
          ...state,
          workerConfig: updatedWorkerConfig,
        }
      } else {
        // If the config doesn't exist, add it to the list
        return {
          ...state,
          workerConfig: [...state.workerConfig, updatedConfig],
        }
      }

    case REMOVE_WORKER_CONFIG:
      const filteredConfigs = state.workerConfig.filter(
        (config) => config.id !== action.payload
      )
      return {
        ...state,
        workerConfig: filteredConfigs,
      }

    default:
      return state
  }
}
