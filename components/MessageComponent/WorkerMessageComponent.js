import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import ModelTrainingIcon from '@mui/icons-material/ModelTraining'
import AddTaskIcon from '@mui/icons-material/AddTask'
import DescriptionIcon from '@mui/icons-material/Description'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import ViewListIcon from '@mui/icons-material/ViewList'
import StorageIcon from '@mui/icons-material/Storage'
import { Divider, ListItem } from '@mui/material'

export function WorkerMessageComponent({ response }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(undefined)
  const [fields, setFields] = useState([])
  const key = `id--${response.id.toString().slice(-8)}--message-cycle-${
    response.cycle
  }`

  const map = {
    error: { icon: <ErrorOutlineIcon />, label: 'error' },
    results: { icon: <FormatListBulletedIcon />, label: 'last results' },
    thoughts: { icon: <ModelTrainingIcon />, label: 'thoughts' },
    command: { icon: <AddTaskIcon />, label: 'command' },
  }

  useEffect(() => {
    const content = response.content
    let _fields = []
    if (content) {
      try {
        const parsed = JSON.parse(content)
        if (parsed.error) {
          setError(parsed.error)
        }
      } catch (err) {
        console.error(err)
      }
    }

    if (response.config?.tool_response) {
      _fields.push('results')
    }
    if (response.thoughts) {
      _fields.push('thoughts')
    }
    if (response.command) {
      _fields.push('command')
    }

    setFields(_fields)
  }, [response, setError, setFields])

  return (
    <Box sx={{ padding: 0 }}>
      <ThemeProvider
        theme={createTheme({
          components: {
            MuiListItemButton: {
              defaultProps: {
                disableTouchRipple: true,
              },
            },
          },
          palette: {
            mode: 'dark',
            primary: { main: 'rgb(102, 157, 246)' },
            background: { paper: 'rgb(5, 30, 52)' },
          },
        })}
      >
        <Paper elevation={0}>
          <Box
            sx={{
              bgcolor: open ? 'rgba(71, 98, 130, 0.2)' : null,
              // pb: open ? 2 : 0,
            }}
          >
            <MessageSummaryHeader />
            {open && (
              <>
                <Divider />
                <MessageResponseMapper />
                <Divider />

                {!!response?.config?.history && response?.config?.memory && (
                  <DebuggerControls {...{ response }} />
                )}
              </>
            )}
          </Box>
        </Paper>
      </ThemeProvider>
    </Box>
  )

  function MessageResponseMapper() {
    return typeof error === 'undefined' ? ( // if message response is ok
      fields.map((label) => (
        <Box key={`${label}--${key}`}>
          <ListItem
            sx={{
              py: 0,
              minHeight: 32,
              color: 'rgba(255,255,255,.8)',
            }}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>
              {map[label].icon}
            </ListItemIcon>
            <ListItemText
              primary={map[label].label}
              primaryTypographyProps={{
                fontSize: 14,
                fontWeight: 'medium',
              }}
            />
          </ListItem>

          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              margin: 0,
              padding: '16px',
            }}
          >
            {label !== 'results'
              ? JSON.stringify(response[label], null, 4)
              : JSON.stringify(response.config.tool_response, null, 4)}
          </pre>
        </Box>
      ))
    ) : (
      // if message response is not ok
      <Box key={`error--${key}`}>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            margin: 0,
            padding: '16px',
          }}
        >
          {JSON.stringify(error, null, 4)}
        </pre>
      </Box>
    )
  }

  function MessageSummaryHeader() {
    return (
      <ListItemButton
        alignItems="flex-start"
        onClick={() => setOpen(!open)}
        sx={{
          px: 3,
          pt: 2.5,
          pb: open ? 0 : 2.5,
          '&:hover, &:focus': { '& svg': { opacity: !open ? 1 : 0 } },
        }}
      >
        {!open ? (
          <ListItemIcon>
            {typeof error === 'undefined' ? (
              <DescriptionIcon />
            ) : (
              <ErrorOutlineIcon />
            )}
          </ListItemIcon>
        ) : (
          ''
        )}
        <ListItemText
          primary={`${key}`}
          primaryTypographyProps={{
            fontSize: 15,
            fontWeight: 'medium',
            lineHeight: '20px',
            mb: '2px',
          }}
          secondary={`${
            typeof error !== 'undefined'
              ? `${JSON.stringify({ error })}`
              : response.command
              ? `next command:${Object.keys(response.command).map((label) => {
                  return ` ${label}:${JSON.stringify(response.command[label])}`
                })}`
              : !!response.config?.tool_response
              ? JSON.stringify(response.config.tool_response)
              : ''
          }`}
          secondaryTypographyProps={{
            noWrap: true,
            fontSize: 12,
            lineHeight: '16px',
            color: !!open ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0.5)',
          }}
          sx={{ my: 0 }}
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
    )
  }
}

function DebuggerControls({ response }) {
  return (
    <ListItem sx={{ padding: 0 }}>
      <ListItemButton
        onClick={() => {
          console.debug(response.config?.history)
        }}
      >
        <ListItemIcon>
          <ViewListIcon />
        </ListItemIcon>
        <ListItemText>Context Sent</ListItemText>
      </ListItemButton>
      <ListItemButton
        onClick={() => {
          console.debug(response.config?.memory)
        }}
      >
        <ListItemIcon>
          <StorageIcon />
        </ListItemIcon>
        <ListItemText>Memory</ListItemText>
      </ListItemButton>
    </ListItem>
  )
}
