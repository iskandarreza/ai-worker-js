import {
  Box,
  Button,
  Container,
  ListItem,
  ListItemButton,
  Paper,
  Skeleton,
  TextareaAutosize,
} from '@mui/material'
import { useDispatch, useSelector } from 'react-redux'
import {
  ADD_AGENT,
  ADD_AGENT_RESPONSE,
  RECEIVED_AGENT_RESPONSE,
  REMOVE_AGENT,
  SHOW_PYODIDE_COMMAND_BOX,
  WAIT_FOR_AGENT_RESPONSE,
} from '../store/types'
import { v4 as uuidv4 } from 'uuid'
import { useEffect, useState } from 'react'

class WorkerType {
  constructor(type) {
    this.type = type
    this.assetPath = `/workers/${type}.worker.js`
  }
}
const workerTypes = {
  openai: 'openai',
  pyodide: 'pyodide',
}

const createWorker = (type) => {
  const workerId = uuidv4()
  const workerType = new WorkerType(type)
  const newWorker = new Worker(
    new URL(workerType.assetPath, window.location.origin),
    {
      name: type,
      credentials: 'same-origin',
    }
  )

  newWorker.id = workerId
  newWorker.type = type

  return newWorker
}

// Function to terminate the current web worker
const terminateWorker = (worker) => {
  if (worker !== null) {
    worker.terminate()
  }
}

export default function Home() {
  const state = useSelector((state) => state)
  const { uiStates, workerStates } = state
  const { workerRegistry, agentResponses } = workerStates

  return (
    <Container
      sx={{
        display: 'grid',
        justifyContent: 'space-between',
        gridTemplateColumns: '2fr 2fr',
      }}
    >
      <Box>
        <CreateWorkerComponent />

        {!!workerRegistry.length > 0 ? (
          <Box>
            <h2>Agent Registry</h2>
            {workerRegistry?.map((worker, index) => (
              <ListItem key={`${worker.type}-${worker.id}`}>
                <Paper sx={{ display: 'flex' }} elevation={2}>
                  <WorkerTitleIDComponent {...{ worker }} />

                  {worker.type === 'openai' && (
                    <OpenAIWorkerComponent {...{ worker }} />
                  )}

                  {worker.type === 'pyodide' && (
                    <PyodideWorkerComponent {...{ worker }} />
                  )}
                </Paper>
              </ListItem>
            ))}
          </Box>
        ) : (
          ''
        )}

        {!!agentResponses.length > 0 ? (
          <Box>
            <h2>Agent Responses</h2>
            {agentResponses?.map((response, index) => (
              <ListItem key={`${index}`}>
                {JSON.stringify(response, null, 4)}
              </ListItem>
            ))}
          </Box>
        ) : (
          ''
        )}
      </Box>

      <Box>
        <Paper>
          <h2>UI State</h2>
          <pre>{JSON.stringify(uiStates, null, 4)}</pre>
        </Paper>
        <Paper>
          <h2>Worker State</h2>
          <pre>{JSON.stringify(workerStates, null, 4)}</pre>
        </Paper>
      </Box>
    </Container>
  )
}

function WorkerTitleIDComponent({ worker }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <h3>{`${worker.type} worker`}</h3>
      <p>{`[...${worker.id.toString().slice(-8)}]`}</p>
    </Box>
  )
}

function PyodideWorkerComponent({ worker }) {
  const [state, setState] = useState({})

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <ListItemButton
          onClick={() => {
            // dispatch({ type: SHOW_PYODIDE_COMMAND_BOX })
          }}
        >
          Run python command
        </ListItemButton>

        <RemoveWorkerComponent {...{worker}} />
      </Box>
    </>
  )
}

function OpenAIWorkerComponent({ worker }) {
  const dispatch = useDispatch()

  useEffect(() => {
    worker.addEventListener('message', listenForResponse(dispatch))
  })

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <ListItemButton
          onClick={() => {
            worker.postMessage({
              type: 'chat',
              payload: 'What can a cluster of autonomous AI agents do?',
            })
          }}
        >
          Start chat
        </ListItemButton>

        <ListItemButton
          onClick={() => {
            worker.postMessage({ type: 'state' })
          }}
        >
          Agent State
        </ListItemButton>
        <RemoveWorkerComponent {...{worker}} />
      </Box>
    </>
  )
}

function RemoveWorkerComponent({worker}) {
  const dispatch = useDispatch()
  return <ListItemButton
    onClick={() => {
      worker.removeEventListener('message', listenForResponse)
      dispatch({ type: REMOVE_AGENT, payload: worker.id })
      terminateWorker(worker)
    } }
  >
    Terminate
  </ListItemButton>
}

function listenForResponse(dispatch) {
  return (event) => {
    if (event.data.type === 'agentMessage') {
      dispatch({
        type: ADD_AGENT_RESPONSE,
        payload: event.data.payload,
      })
    }
  }
}

function CreateWorkerComponent() {
  const dispatch = useDispatch()
  return (
    <Box>
      {Object.keys(workerTypes).map((type, index) => (
        <ListItem key={`${type}-${index}`}>
          <Button
            onClick={() => {
              const worker = createWorker(type)
              worker.addEventListener('message', (ev) => {
                console.log(ev.data)
              })
              dispatch({ type: ADD_AGENT, payload: worker })
            }}
          >
            Create {`${type.toUpperCase()}`} Worker
          </Button>
        </ListItem>
      ))}
    </Box>
  )
}
