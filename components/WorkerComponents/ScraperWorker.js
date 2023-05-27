import { Box, Button, TextField } from '@mui/material'
import { useState } from 'react'
import { CollapsingPanelHeader } from './CollapsingPanelHeader'

export function ScraperWorkerComponent({ wrapper }) {
  const primaryText = 'Manual Input'

  const [open, setOpen] = useState(false)
  const [inputData, setInputData] = useState({
    url: '',
    selector: 'div',
    maxTokens: 1000,
  })
  const [isValid, setIsValid] = useState(false)

  const validateForm = (form) => {
    const formdata = new FormData(form)
    let input = {
      url: formdata.get('url'),
      selector: formdata.get('selector'),
      maxTokens: formdata.get('maxtokens'),
    }
    setInputData(input)

    const allPropsNotEmpty = Object.values(input).every((prop) => prop !== '')
    setIsValid(allPropsNotEmpty)
  }

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <CollapsingPanelHeader {...{ setOpen, open, primaryText }} />

        {open ? (
          <Box sx={{ padding: '16px' }}>
            <form
              onChange={(e) => {
                validateForm(e.target.closest('form'))
              }}
              onSubmit={async (e) => {
                e.preventDefault()

                if (inputData.url) {
                  const results = await wrapper.comlink.scrape(inputData)
                  console.log(results)
                }
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  paddingBottom: '8px',
                }}
              >
                <TextField
                  error={!inputData.url}
                  helperText={!inputData.url && 'Enter a valid URL'}
                  name="url"
                  fullWidth
                  label="URL"
                  defaultValue={inputData.url}
                  variant="standard"
                />
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  paddingBottom: '8px',
                }}
              >
                <TextField
                  error={!inputData.selector}
                  helperText={!inputData.selector ? 'Enter a valid URL' : ''}
                  name="selector"
                  fullWidth
                  label="CSS Selector"
                  defaultValue={'div'}
                  variant="standard"
                />

                <TextField
                  sx={{ marginLeft: '8px' }}
                  error={!inputData.maxTokens}
                  helperText={!inputData.maxTokens ? 'Enter a valid URL' : ''}
                  name="maxtokens"
                  label="Max Tokens"
                  type="number"
                  defaultValue={1000}
                  variant="standard"
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="outlined" type="submit" disabled={!isValid}>
                  Scrape
                </Button>
              </Box>
            </form>
          </Box>
        ) : (
          ''
        )}
      </Box>
    </>
  )
}
