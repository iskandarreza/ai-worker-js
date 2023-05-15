import { ListItemButton } from '@mui/material'
import { useDispatch } from 'react-redux'
import { REMOVE_AGENT } from '../../store/types'

export const terminateWorker = (worker) => {
  if (worker !== null) {
    worker.terminate()
  }
}

export function RemoveWorkerComponent({ wrapper, eventListener }) {
  const dispatch = useDispatch()
  return (
    <ListItemButton
      onClick={() => {
        !!eventListener &&
          wrapper.worker.removeEventListener('message', eventListener)
        dispatch({ type: REMOVE_AGENT, payload: wrapper.id })
        terminateWorker(wrapper.worker)
      }}
    >
      Terminate
    </ListItemButton>
  )
}
