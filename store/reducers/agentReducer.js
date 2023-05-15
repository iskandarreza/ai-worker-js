import { ADD_AGENT, ADD_AGENT_RESPONSE, REMOVE_AGENT } from '../types'

const initialState = {
  workerRegistry: [],
  agentResponses: [],
}

export default function (state = initialState, action) {
  // console.log({state, action})

  switch (action.type) {
    case ADD_AGENT:
      return {
        ...state,
        workerRegistry: [...state.workerRegistry, action.payload],
      }

    case ADD_AGENT_RESPONSE:
      return {
        ...state,
        agentResponses: [...state.agentResponses, action.payload],
      }

    case REMOVE_AGENT:
      const filteredAgents = state.workerRegistry.filter(agent => agent.id !== action.payload)

      return {
        ...state,
        workerRegistry: filteredAgents,
      }
  
    default:
      return state
  }
}
