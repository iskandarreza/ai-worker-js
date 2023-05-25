import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect, useState } from 'react'
import { RemoveWorkerComponent } from '../WorkerManager/RemoveWorkerComponent'
import {
  ADD_AGENT_RESPONSE,
  INCREMENT_AGENT_CYCLE,
  SHOW_AGENT_CONFIG_FORM,
  UPDATE_AGENT_STATE,
  WAIT_FOR_AGENT_RESPONSE,
} from '../../store/types'
import { ConfigureWorkerDialog } from '../WorkerManager/ConfigureWorkerDialog'
import { downloadJsonData } from '../../utils/downloadJsonData'

export function listenForResponse(dispatch) {
  return (event) => {
    const { type, payload } = event.data

    console.debug(`main received dispatch`, { type, payload })

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
        dispatch({
          type: INCREMENT_AGENT_CYCLE,
          payload: {
            id: payload.fromId,
            cycle: payload.content.cycle,
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
  const [userInput, setUserInput] = useState()
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
        {/* Menu button pairs 'configure', 'ready/waiting' */}
        <ListItem disableGutters>
          <ListItemButton
            sx={{
              flex: 1,
            }}
            onClick={() => {
              dispatch({ type: SHOW_AGENT_CONFIG_FORM })
            }}
          >
            Configure
          </ListItemButton>

          <ListItemText
            sx={{
              flex: 1,
            }}
            primary={
              !workerState.waitForResponse
                ? 'Ready'
                : `Waiting for response... ${typeof wrapper.cycle !== 'undefined' ? `cycle ${wrapper.cycle + 1}` : ''
                }`
            }
            primaryTypographyProps={{
              fontSize: '1em',
              fontStyle: 'italic',
            }}
          />
        </ListItem>

        {/* Menu button pairs 'terminate', 'download config' */}
        <ListItem disableGutters>
          <RemoveWorkerComponent
            {...{ wrapper, eventListener: listenForResponse }}
          />

          <ListItemButton
            sx={{
              flex: 1,
            }}
            onClick={() => {
              console.log({ workerState, workerConfigState })
              downloadJsonData(workerState.state)
            }}
          >
            Download Config
          </ListItemButton>
        </ListItem>

        {/* Menu button pairs 'user input', 'loop' */}
        <ListItem disableGutters>
          <ListItemButton
            sx={{
              flex: 1,
            }}
            disabled={
              workerConfigState?.goals.length === 0 ||
              workerState.waitForResponse
            }
            onClick={() => {
              console.log({ workerState, workerConfigState })
              wrapper.worker.postMessage({
                type: 'chat',
                payload: {
                  id: wrapper.id,
                  message: 'What is your current status?',
                },
              })
              waitForAgentResponse(dispatch, wrapper.id)
            }}
          >
            User Input
          </ListItemButton>

          <ListItemButton
            sx={{
              flex: 1,
            }}
            onClick={() => {
              wrapper.worker.postMessage({
                type: 'loop',
                payload: {
                  id: wrapper.id,
                },
              })
              waitForAgentResponse(dispatch, wrapper.id)
            }}
            disabled={workerState.waitForResponse}
          >
            {workerState.state?.staging_tool?.name !== 'task_complete'
              ? 'Loop Continuously'
              : 'Continue Loop'}
          </ListItemButton>
        </ListItem>

        {/* Running tool report */}
        <ListItem disableGutters>
          {workerConfigState?.goals.length !== 0 ? (
            <>
              {workerState.state?.state === 'TOOL_STAGED' ? (
                <ListItemButton
                  onClick={() => {
                    wrapper.worker.postMessage({
                      type: 'runTool',
                    })
                    waitForAgentResponse(dispatch, wrapper.id)
                  }}
                  disabled={
                    workerState.state.staging_tool?.name === 'task_complete' ||
                    workerState.waitForResponse
                  }
                >
                  {workerState.waitForResponse
                    ? `Running command: ${JSON.stringify(
                      workerState.state.staging_tool
                    )}`
                    : workerState.state?.staging_tool?.name !== 'task_complete'
                      ? `Run next command: ${JSON.stringify(
                        workerState.state.staging_tool
                      )}`
                      : 'No command to run next'}
                </ListItemButton>
              ) : (
                ''
              )}
            </>
          ) : (
            ''
          )}
        </ListItem>
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
