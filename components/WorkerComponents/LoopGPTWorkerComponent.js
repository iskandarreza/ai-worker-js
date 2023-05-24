import { Box, ListItem, ListItemButton } from '@mui/material'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect } from 'react'
import { RemoveWorkerComponent } from '../WorkerManager/RemoveWorkerComponent'
import {
  ADD_AGENT_RESPONSE,
  INCREMENT_AGENT_CYCLE,
  SHOW_AGENT_CONFIG_FORM,
  UPDATE_AGENT_STATE,
  WAIT_FOR_AGENT_RESPONSE,
} from '../../store/types'
import { ConfigureWorkerDialog } from '../WorkerManager/ConfigureWorkerDialog'

export function listenForResponse(dispatch) {
  return (event) => {
    const { type, payload } = event.data

    switch (type) {
      case 'next_cycle':
        waitForAgentResponse(dispatch, payload.fromId)
        break

      case 'response':
        dispatch({
          type: ADD_AGENT_RESPONSE,
          payload: {
            id: payload.fromId,
            content: payload.content,
          },
        })
        break

      case 'cycle':
        dispatch({
          type: INCREMENT_AGENT_CYCLE,
          payload: {
            id: payload.fromId,
            cycle: payload.content,
          },
        })
        break

      case 'state':
        dispatch({
          type: UPDATE_AGENT_STATE,
          payload: {
            id: payload.fromId,
            state: payload.content,
          },
        })
        break

      default:
        break
    }
  }
}

export function LoopGPTWorkerComponent({ wrapper }) {
  const workerState = useSelector((state) =>
    state.workerStates.workerRegistry.find((worker) => worker.id === wrapper.id)
  )
  const workerConfigState = useSelector(
    (state) => state.uiStates.workerConfig
  ).find((config) => config.id === wrapper.id)
  const dialogIsOpen = useSelector(
    (state) => state.uiStates.isConfiguringWorker
  )
  const dispatch = useDispatch()

  useEffect(() => {
    wrapper.worker.addEventListener('message', listenForResponse(dispatch))

    return () => {
      wrapper.worker.removeEventListener('message', listenForResponse)
    }
  }, [dispatch, wrapper.worker])

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <ListItem sx={{ paddingLeft: 0 }}>
          <ListItemButton
            onClick={() => {
              dispatch({ type: SHOW_AGENT_CONFIG_FORM })
            }}
          >
            Configure
          </ListItemButton>

          <RemoveWorkerComponent
            {...{ wrapper, eventListener: listenForResponse }}
          />

          <ListItemButton disabled>Start</ListItemButton>
        </ListItem>

        {workerConfigState?.goals.length !== 0 ? (
          <>
            {!workerState.waitForResponse ? (
              <ListItemButton
                onClick={() => {
                  wrapper.worker.postMessage({
                    type: 'chat',
                    payload: {
                      id: wrapper.id,
                    },
                  })
                  waitForAgentResponse(dispatch, wrapper.id)
                }}
              >
                Start chat
              </ListItemButton>
            ) : (
              <ListItem>
                {`Waiting for response... ${
                  wrapper.cycle ? `cycle ${wrapper.cycle + 1}` : ''
                }`}
              </ListItem>
            )}

            {workerState.state?.state === 'TOOL_STAGED' ? (
              <ListItemButton
                onClick={() => {
                  wrapper.worker.postMessage({
                    type: 'runTool',
                  })
                  waitForAgentResponse(dispatch, wrapper.id)
                }}
                disabled={workerState.waitForResponse}
              >
                {workerState.waitForResponse
                  ? `Running command :`
                  : `Next command: `}{' '}
                {`${JSON.stringify(workerState.state.staging_tool)}`}
              </ListItemButton>
            ) : (
              ''
            )}
          </>
        ) : (
          ''
        )}
      </Box>

      <ConfigureWorkerDialog
        keepMounted
        open={dialogIsOpen}
        workerId={workerState.id}
      />
    </>
  )
}

function waitForAgentResponse(dispatch, id) {
  dispatch({
    type: WAIT_FOR_AGENT_RESPONSE,
    payload: { id },
  })
}
