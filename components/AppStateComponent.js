import { Box, Paper, Typography } from '@mui/material'
import { useSelector } from 'react-redux'

export function AppStateComponent() {
  const state = useSelector((state) => state)
  const { uiStates, workerStates } = state

  return (
    <Box>
      <Paper>
        <h2>UI State</h2>
        <Typography variant="caption" style={{ overflow: 'auto', wordWrap: 'break-word' }}>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }} >{JSON.stringify(uiStates, null, 4)}</pre>
        </Typography>
      </Paper>
      <Paper>
        <h2>Worker State</h2>
        <Typography variant="caption" style={{ overflow: 'auto', wordWrap: 'break-word' }}>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(workerStates, null, 4)}</pre>
        </Typography>
      </Paper>
    </Box>
  )
}
