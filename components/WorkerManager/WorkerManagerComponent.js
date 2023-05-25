import { Box, Divider, ListItem, Paper, Typography } from '@mui/material'
import { useSelector } from 'react-redux'
import { WorkerHeaderComponent } from './WorkerHeaderComponent'
import { CreateWorkerComponent } from './CreateWorkerComponent'
import { PyodideWorkerComponent } from '../WorkerComponents/PyodideWorkerComponent'
import { LoopGPTWorkerComponent } from '../WorkerComponents/LoopGPTWorkerComponent'

export function WorkerManagerComponent() {
  const state = useSelector((state) => state)
  const { workerStates } = state
  const { workerRegistry } = workerStates

  return (
    <Box>
      <CreateWorkerComponent />

      {!!workerRegistry.length > 0 ? (
        <WorkerRegistryList {...{ workerRegistry }} />
      ) : (
        ''
      )}
    </Box>
  )
}

function WorkerRegistryList({ workerRegistry }) {
  return (
    <Box sx={{ margin: '0 16px' }}>
      <h4>Worker Registry</h4>
      <Typography
        variant="caption"
        style={{ overflow: 'auto', wordWrap: 'break-word' }}
      >
        {workerRegistry?.map((wrapper, _index) => (
          <Paper
            sx={{ margin: '16px 0' }}
            key={`${wrapper.type}-${wrapper.id}`}
          >
            <Box elevation={1}>
              <WorkerHeaderComponent {...{ wrapper }} />
            </Box>

            <Divider />

            {wrapper.type === 'pyodide' && (
              <PyodideWorkerComponent {...{ wrapper }} />
            )}

            {wrapper.type === 'loopgpt' && (
              <LoopGPTWorkerComponent {...{ wrapper }} />
            )}
          </Paper>
        ))}
      </Typography>
    </Box>
  )
}
