import { Box, Typography } from '@mui/material'
import { useEffect } from 'react'

export function WorkerHeaderComponent({ wrapper }) {
  return (
    <Box
      sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '16px' }}
    >
      <Typography variant="p" component={'h3'}>
        {`${wrapper.type} worker`}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <span>{`id: [...${wrapper.id.toString().slice(-8)}]`}</span>
        {!!wrapper.cycle && <span>Cycle: {wrapper.cycle}</span>}
        {wrapper.type === 'loopgpt' ? (
          <span>
            Agent State:{' '}
            {`${
              wrapper.state?.goals.length === 0
                ? 'CONFIG'
                : wrapper.state?.state
            }`}
          </span>
        ) : (
          ''
        )}
      </Box>
    </Box>
  )
}
