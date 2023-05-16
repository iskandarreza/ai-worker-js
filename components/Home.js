import { Grid } from '@mui/material'
import { AppStateComponent } from './AppStateComponent'
import { WorkerManagerComponent } from './WorkerManager/WorkerManagerComponent'

export function Home() {
  return (
    <Grid container height={'95vh'}>
      <Grid item xs={12}>
        <h4>Hello!</h4>
      </Grid>
      <Grid container item xs={12} sx={{ height: '80vh', overflowY: 'scroll' }}>
        <Grid item xs={6}>
          <WorkerManagerComponent />
        </Grid>

        <Grid item xs={6}>
          <AppStateComponent />
        </Grid>
      </Grid>
    </Grid>
  )
}
