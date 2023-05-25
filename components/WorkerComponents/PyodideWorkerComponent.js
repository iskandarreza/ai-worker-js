import { Box, ListItemButton } from '@mui/material'
import { RemoveWorkerComponent } from '../WorkerManager/RemoveWorkerComponent'

export function PyodideWorkerComponent({ wrapper }) {
  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <ListItemButton
          onClick={() => {
            // dispatch({ type: SHOW_PYODIDE_COMMAND_BOX })
          }}
        >
          Run python command
        </ListItemButton>

        <RemoveWorkerComponent {...{ wrapper }} />
      </Box>
    </>
  )
}
