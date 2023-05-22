import { Box } from '@mui/material'

export function WorkerTitleIDComponent({ wrapper }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <h3>{`${wrapper.type} worker`}</h3>
      <p>{`[...${wrapper.id.toString().slice(-8)}]`}</p>
      {!!wrapper.cycle && <p>Cycle: {wrapper.cycle}</p>}
    </Box>
  )
}
