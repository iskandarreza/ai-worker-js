import { Box, ListItemButton } from '@mui/material'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect } from 'react'
import { RemoveWorkerComponent } from '../WorkerManager/RemoveWorkerComponent'
import {
  ADD_AGENT_RESPONSE,
  SHOW_AGENT_CONFIG_FORM,
  UPDATE_AGENT_STATE,
} from '../../store/types'
import { ConfigureWorkerDialog } from '../WorkerManager/ConfigureWorkerDialog'

export function listenForResponse(dispatch) {
  return (event) => {
    const { type, payload } = event.data

    switch (type) {
      case 'response':
        dispatch({
          type: ADD_AGENT_RESPONSE,
          payload: payload.content,
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

        if (payload.content.state === 'TOOL_STAGED') {
          console.log('TOOL_STAGED')
        }

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
        <ListItemButton
          onClick={() => {
            dispatch({ type: SHOW_AGENT_CONFIG_FORM })
          }}
        >
          Configure
        </ListItemButton>

        {workerConfigState?.goals.length !== 0 ? (
          <>
            <ListItemButton
              onClick={() => {
                wrapper.worker.postMessage({
                  type: 'chat',
                  payload: null,
                })
              }}
            >
              Start chat
            </ListItemButton>

            {workerState.state?.state === 'TOOL_STAGED' ? (
              <ListItemButton
                onClick={() => {
                  wrapper.worker.postMessage({
                    type: 'runTool',
                  })
                }}
              >
                Run tool: {`${JSON.stringify(workerState.state.staging_tool)}`}
              </ListItemButton>
            ) : (
              ''
            )}
          </>
        ) : (
          ''
        )}

        <ListItemButton
          onClick={() => {
            wrapper.worker.postMessage({ type: 'state' })
          }}
        >
          Agent State:{' '}
          {`${
            workerState.state?.goals.length === 0
              ? 'CONFIG'
              : workerState.state?.state
          }`}
        </ListItemButton>
        <RemoveWorkerComponent
          {...{ wrapper, eventListener: listenForResponse }}
        />
      </Box>

      <ConfigureWorkerDialog
        keepMounted
        open={dialogIsOpen}
        workerId={workerState.id}
      />
    </>
  )
}
