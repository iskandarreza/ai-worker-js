import { Box, Paper, Typography } from '@mui/material'
import { useSelector } from 'react-redux'
import { AgentResponsesList } from './AgentResponsesList'
import dynamic from 'next/dynamic'

export const DynamicReactJson = dynamic(import('react-json-view'), {
  ssr: false,
})

export function AppStateComponent() {
  const state = useSelector((state) => state)
  const { uiStates, workerStates } = state
  const { workerRegistry, agentResponses } = workerStates


  return (
    <Box>
      <Paper sx={{ padding: '16px' }}>
        <h2>State Viewer</h2>

        <h4>Worker Registry</h4>
        <Typography
          variant="caption"
          style={{ overflow: 'auto', wordWrap: 'break-word' }}
        >
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {workerRegistry.length > 0 ?
              workerRegistry.map((wrapper) =>
                <DynamicReactJson
                  key={wrapper.id.toString()}
                  name={`${wrapper.type}-${wrapper.id.toString().slice(-8)}`}
                  src={wrapper}
                  theme={'rjv-default'}
                  collapsed
                />
              ) : ''
            }
          </pre>
        </Typography>
      </Paper>
      <Paper sx={{ padding: '16px' }}>
        <h4>UI State</h4>
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
          <DynamicReactJson
            src={uiStates}
            theme={'rjv-default'}
            collapsed
          />
        </pre>
      </Paper>

      {!!agentResponses.length > 0 ?
        <Paper sx={{ padding: '16px' }}>
          <h4>Agent Responses</h4>

          <AgentResponsesList {...{ agentResponses }} />
        </Paper> : ''
      }
    </Box>
  )
}



