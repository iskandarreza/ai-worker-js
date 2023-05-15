import { RECEIVED_AGENT_RESPONSE, WAIT_FOR_AGENT_RESPONSE } from '../types'

const initialState = {
  chatIsLoading: false,
}

export default function (state = initialState, action) {
  switch (action.type) {
    case WAIT_FOR_AGENT_RESPONSE:
      return {
        ...state,
        chatIsLoading: true,
      }

    case RECEIVED_AGENT_RESPONSE:
      return {
        ...state,
        chatIsLoading: false,
      }

    default:
      return state
  }
}
