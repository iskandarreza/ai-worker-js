import { Box, Button, ListItem } from '@mui/material'
import { useDispatch } from 'react-redux'
import { ADD_AGENT } from '../../store/types'
import { v4 as uuidv4 } from 'uuid'

export class WorkerWrapper {
  constructor(type) {
    this.type = type
    this.id = uuidv4()
    this.assetPath = `/workers/${type}.worker.js`
    this.worker = new Worker(new URL(this.assetPath, window.location.origin), {
      name: type,
      credentials: 'same-origin',
    })
  }
}

function createWorker(type) {
  const wrapper = new WorkerWrapper(type)
  wrapper.worker.addEventListener('message', (ev) => {
    console.log(ev.data)
  })
  wrapper.worker.postMessage({
    type: 'init',
    payload: { id: wrapper.id },
  })
  return wrapper
}

export function CreateWorkerComponent() {
  const dispatch = useDispatch()
  const workerTypes = ['openai', 'pyodide']
  return (
    <Box>
      {workerTypes.map((type, index) => (
        <ListItem key={`${type}-${index}`}>
          <Button
            onClick={() => {
              dispatch({ type: ADD_AGENT, payload: createWorker(type) })
            }}
          >
            Create {`${type.toUpperCase()}`} Worker
          </Button>
        </ListItem>
      ))}
    </Box>
  )
}
