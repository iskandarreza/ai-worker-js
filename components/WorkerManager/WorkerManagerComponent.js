import { Box, ListItem, Paper } from '@mui/material'
import { useSelector } from 'react-redux'
import { WorkerTitleIDComponent } from './WorkerTitleIDComponent'
import { CreateWorkerComponent } from './CreateWorkerComponent'
import { PyodideWorkerComponent } from '../WorkerComponents/PyodideWorkerComponent'
import { OpenAIWorkerComponent } from '../WorkerComponents/OpenAIWorkerComponent'

export function WorkerManagerComponent() {
  const state = useSelector((state) => state)
  const { workerStates } = state
  const { workerRegistry, agentResponses } = workerStates

  return (
    <Box>
      <CreateWorkerComponent />

      {!!workerRegistry.length > 0 ? (
        <WorkerRegistryList {...{workerRegistry}} />
      ) : (
        ''
      )}

      {!!agentResponses.length > 0 ? (
        <AgentResponsesList {...{agentResponses}} />
      ) : (
        ''
      )}
    </Box>
  )
}

function AgentResponsesList({agentResponses}) {
  return <Box>
    <h2>Agent Responses</h2>
    {agentResponses?.map((response, index) => (
      <ListItem key={`${index}`}>
        {JSON.stringify(response, null, 4)}
      </ListItem>
    ))}
  </Box>
}

function WorkerRegistryList({workerRegistry}) {
  return <Box>
    <h2>Agent Registry</h2>
    {workerRegistry?.map((wrapper, _index) => (
      <ListItem key={`${wrapper.type}-${wrapper.id}`}>
        <Paper sx={{ display: 'flex' }} elevation={2}>
          <WorkerTitleIDComponent {...{ wrapper }} />

          {wrapper.type === 'openai' && (
            <OpenAIWorkerComponent {...{ wrapper }} />
          )}

          {wrapper.type === 'pyodide' && (
            <PyodideWorkerComponent {...{ wrapper }} />
          )}
        </Paper>
      </ListItem>
    ))}
  </Box>
}

