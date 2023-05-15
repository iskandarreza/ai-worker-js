import {
  ADD_AGENT,
  ADD_AGENT_RESPONSE,
  REMOVE_AGENT,
  UPDATE_AGENT_STATE,
} from '../types'

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
      console.log({ state, action })

      return {
        ...state,
        agentResponses: [...state.agentResponses, action.payload],
      }

    case REMOVE_AGENT:
      const filteredAgents = state.workerRegistry.filter(
        (agent) => agent.id !== action.payload
      )

      return {
        ...state,
        workerRegistry: filteredAgents,
      }

    case UPDATE_AGENT_STATE:
      const updatedRegistry = state.workerRegistry.map((agent) => {
        if (agent.id === action.payload.id) {
          return {
            ...agent,
            state: action.payload.state,
          }
        }
        return agent
      })

      return {
        ...state,
        workerRegistry: updatedRegistry,
      }

    default:
      return state
  }
}
