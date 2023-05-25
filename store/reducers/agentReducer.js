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

export default function agentReducer(state = initialState, action) {
  switch (action.type) {
    case ADD_AGENT:
      return {
        ...state,
        workerRegistry: [...state.workerRegistry, action.payload],
      }

    case WAIT_FOR_AGENT_RESPONSE:
    case UPDATE_AGENT_STATE:
    case INCREMENT_AGENT_CYCLE:
      const updatedWorkerRegistry = state.workerRegistry.map((registration) => {
        if (registration.id === action.payload.id) {
          return {
            ...registration,
            waitForResponse: action.type === WAIT_FOR_AGENT_RESPONSE,
            state:
              action.type === UPDATE_AGENT_STATE
                ? action.payload.state
                : registration.state,
            cycle:
              action.type === INCREMENT_AGENT_CYCLE
                ? action.payload.cycle
                : typeof registration.cycle !== 'undefined'
                ? registration.cycle
                : 0,
          }
        }
        return registration
      })

      return {
        ...state,
        workerRegistry: updatedWorkerRegistry,
      }

    case ADD_AGENT_RESPONSE:
      const existingResponse = state.agentResponses.find(
        (response) =>
          response.id === action.payload.id &&
          response.cycle === action.payload.content.cycle
      )

      if (existingResponse) {
        return state
      }

      const updatedAgentResponses = [
        ...state.agentResponses,
        { ...action.payload.content, id: action.payload.id },
      ]

      return {
        ...state,
        agentResponses: updatedAgentResponses,
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
