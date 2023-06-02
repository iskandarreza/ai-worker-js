import { Box, Divider, Paper, Typography } from '@mui/material'
import { useSelector } from 'react-redux'
import { WorkerHeaderComponent } from './WorkerHeaderComponent'
import { CreateWorkerComponent } from './CreateWorkerComponent'
import { PyodideWorkerComponent } from '../WorkerComponents/PyodideWorkerComponent'
import { LoopGPTWorkerComponent } from '../WorkerComponents/LoopGPTWorkerComponent'
import { TokenCounterWorkerComponent } from '../WorkerComponents/TokenCounterWorker'
import { ScraperWorkerComponent } from '../WorkerComponents/ScraperWorker'
import { VectorStorageWorkerComponent } from '../WorkerComponents/VectorStorageWorker'
import { WebSearchWorkerComponent } from '../WorkerComponents/WebSearchWorker'

export function WorkerManagerComponent() {
  const state = useSelector((state) => state)
  const { workerStates } = state
  const { workerRegistry } = workerStates

  return (
    <Box>
      <CreateWorkerComponent />

      {!!workerRegistry.length > 0 ? (
        <>
          <WorkerRegistryList {...{ workerRegistry }} />
          {/* // TODO: <Box sx={{ margin: '0 16px' }}>
            <h4>System Worker Messages</h4>
            <List>
              <ListItem>Messages Placeholder</ListItem>
              <ListItem>Messages Placeholder</ListItem>
            </List>
          </Box> */}
        </>
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
            key={`${wrapper.name}-${wrapper.id}`}
          >
            <Box elevation={1}>
              <WorkerHeaderComponent {...{ wrapper }} />
            </Box>

            <Divider />

            {wrapper.name === 'vector-storage' && (
              <VectorStorageWorkerComponent {...{ wrapper }} />
            )}

            {wrapper.name === 'web-search' && (
              <WebSearchWorkerComponent {...{ wrapper }} />
            )}

            {wrapper.naem === 'token-counter' && (
              <TokenCounterWorkerComponent {...{ wrapper }} />
            )}

            {wrapper.name === 'scraper-worker' && (
              <ScraperWorkerComponent {...{ wrapper }} />
            )}

            {wrapper.name === 'pyodide' && (
              <PyodideWorkerComponent {...{ wrapper }} />
            )}

            {wrapper.name === 'loopgpt' && (
              <LoopGPTWorkerComponent {...{ wrapper }} />
            )}
          </Paper>
        ))}
      </Typography>
    </Box>
  )
}
