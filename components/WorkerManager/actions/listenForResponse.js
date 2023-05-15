import { ADD_AGENT_RESPONSE } from '../../../store/types'

export function listenForResponse(dispatch) {
  return (event) => {
    if (event.data.type === 'agentMessage') {
      dispatch({
        type: ADD_AGENT_RESPONSE,
        payload: event.data.payload,
      })
    }
  }
}
