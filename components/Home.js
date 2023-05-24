import { Box, Grid, Paper } from '@mui/material'
import { AgentResponsesList } from './MessageComponent/AgentResponsesList'
import { WorkerManagerComponent } from './WorkerManager/WorkerManagerComponent'

export function Home() {
  return (
    <Grid container height={'95vh'}>
      {/* <Grid item xs={12}>
        <h4>Hello!</h4>
      </Grid> */}
      <Grid container item xs={12} sx={{ height: '80vh' }}>
        <Grid item xs={6}>
          <Box sx={{ padding: '0 16px' }}>
            <h2>Worker Manager</h2>
          </Box>
          <WorkerManagerComponent />
        </Grid>

        <Grid item xs={6}>
          <AgentResponsesList />
        </Grid>
      </Grid>
    </Grid>
  )
}
