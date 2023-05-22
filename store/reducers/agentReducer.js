import {
  ADD_AGENT,
  ADD_AGENT_RESPONSE,
  INCREMENT_AGENT_CYCLE,
  REMOVE_AGENT,
  UPDATE_AGENT_STATE,
  WAIT_FOR_AGENT_RESPONSE,
} from '../types'

const initialState = {
  workerRegistry: [],
  agentResponses: [],
}

export default function (state = initialState, action) {
  switch (action.type) {
    case ADD_AGENT:
      return {
        ...state,
        workerRegistry: [...state.workerRegistry, action.payload],
      }

    case WAIT_FOR_AGENT_RESPONSE:
      const updatedRegistrationResponseState = state.workerRegistry.map(
        (registration) => {
          if (registration.id === action.payload.id) {
            return {
              ...registration,
              waitForResponse: true,
            }
          }
          return registration
        }
      )

      return {
        ...state,
        workerRegistry: updatedRegistrationResponseState,
      }

    case ADD_AGENT_RESPONSE:
      console.log({ state, action })
      const resetRegistrationResponseState = state.workerRegistry.map(
        (registration) => {
          if (registration.id === action.payload.id) {
            return {
              ...registration,
              waitForResponse: false,
            }
          }
          return registration
        }
      )

      return {
        ...state,
        agentResponses: [...state.agentResponses, action.payload.content],
        workerRegistry: resetRegistrationResponseState,
      }

    case UPDATE_AGENT_STATE:
      const updatedRegistrationState = state.workerRegistry.map(
        (registration) => {
          if (registration.id === action.payload.id) {
            return {
              ...registration,
              state: action.payload.state,
            }
          }
          return registration
        }
      )

      return {
        ...state,
        workerRegistry: updatedRegistrationState,
      }

    case INCREMENT_AGENT_CYCLE:
      const updatedRegistrationCycle = state.workerRegistry.map(
        (registration) => {
          if (registration.id === action.payload.id) {
            return {
              ...registration,
              cycle: action.payload.cycle,
            }
          }
          return registration
        }
      )

      return {
        ...state,
        workerRegistry: updatedRegistrationCycle,
      }

    case REMOVE_AGENT:
      const filteredAgents = state.workerRegistry.filter(
        (agent) => agent.id !== action.payload
      )

      return {
        ...state,
        workerRegistry: filteredAgents,
      }

    default:
      return state
  }
}
