import { KeyboardArrowDown } from '@mui/icons-material'
import { ListItemButton, ListItemText } from '@mui/material'

export function CollapsingPanelHeader({ setOpen, open, primaryText }) {
  return (
    <>
      <ListItemButton alignItems="flex-start" onClick={() => setOpen(!open)}>
        <ListItemText
          primary={primaryText}
          primaryTypographyProps={{
            fontSize: 12,
          }}
        />
        <KeyboardArrowDown
          sx={{
            mr: -1,
            opacity: 1,
            transform: !!open ? 'rotate(-180deg)' : 'rotate(0)',
            transition: '0.2s',
          }}
        />
      </ListItemButton>
    </>
  )
}
