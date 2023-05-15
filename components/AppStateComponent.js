import { Box, Paper } from '@mui/material'
import { useEffect } from 'react'
import { useSelector } from 'react-redux'

export function AppStateComponent() {
  const state = useSelector((state) => state)
  const { uiStates, workerStates } = state

  // useEffect(() => {
  //   console.log(workerStates.workerRegistry)
  // }, [workerStates])

  return (
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
  )
}
