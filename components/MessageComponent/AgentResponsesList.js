import { Box, Paper } from '@mui/material'
import { useSelector } from 'react-redux'
import { WorkerMessageComponent } from './WorkerMessageComponent'

export function AgentResponsesList() {
  const state = useSelector((state) => state)
  const { workerStates } = state
  const { agentResponses } = workerStates

  if (agentResponses.length) {
    return (
      <Box
        sx={{
          padding: '16px',
          overflowY: 'scroll',
        }}
        maxHeight={'85vh'}
      >
        <h4>Agent Responses</h4>

        {agentResponses?.map((response) => {
          const key = `${response.id}--${response.cycle}`
          return (
            <Paper
              elevation={2}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                margin: '16px 0',
              }}
              key={key}
            >
              <WorkerMessageComponent {...{ response }} />
            </Paper>
          )
        })}
      </Box>
    )
  } else {
    return ''
  }
}
