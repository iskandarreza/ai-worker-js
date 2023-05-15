import { ListItemButton } from '@mui/material'
import { useDispatch } from 'react-redux'
import { REMOVE_AGENT } from '../../store/types'
import { listenForResponse } from './actions/listenForResponse'

export const terminateWorker = (worker) => {
  if (worker !== null) {
    worker.terminate()
  }
}

export function RemoveWorkerComponent({ wrapper }) {
  const dispatch = useDispatch()
  return (
    <ListItemButton
      onClick={() => {
        wrapper.worker.removeEventListener('message', listenForResponse)
        dispatch({ type: REMOVE_AGENT, payload: wrapper.id })
        terminateWorker(wrapper.worker)
      }}
    >
      Terminate
    </ListItemButton>
  )
}
