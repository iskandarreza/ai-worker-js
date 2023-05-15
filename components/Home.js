import { Container } from '@mui/material'
import { AppStateComponent } from './AppStateComponent'
import { WorkerManagerComponent } from './WorkerManager/WorkerManagerComponent'

export function Home() {
  return (
    <Container
      sx={{
        display: 'grid',
        justifyContent: 'space-between',
        gridTemplateColumns: '2fr 2fr',
      }}
    >
      <WorkerManagerComponent />

      <AppStateComponent />
    </Container>
  )
}
