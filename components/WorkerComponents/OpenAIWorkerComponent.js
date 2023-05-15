import { Box, ListItemButton } from '@mui/material'
import { useDispatch } from 'react-redux'
import { useEffect } from 'react'
import { listenForResponse } from '../WorkerManager/actions/listenForResponse'
import { RemoveWorkerComponent } from '../WorkerManager/RemoveWorkerComponent'

export function OpenAIWorkerComponent({ wrapper }) {
  const dispatch = useDispatch()

  useEffect(() => {
    wrapper.worker.addEventListener('message', listenForResponse(dispatch))
  })

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <ListItemButton
          onClick={() => {
            wrapper.worker.postMessage({
              type: 'hello',
            })
          }}
        >
          Say hello
        </ListItemButton>

        <ListItemButton
          onClick={() => {
            wrapper.worker.postMessage({
              type: 'chat',
              payload: 'What can a cluster of autonomous AI agents do?',
            })
          }}
        >
          Start chat
        </ListItemButton>

        <ListItemButton
          onClick={() => {
            wrapper.worker.postMessage({ type: 'state' })
          }}
        >
          Agent State
        </ListItemButton>
        <RemoveWorkerComponent {...{ wrapper }} />
      </Box>
    </>
  )
}
