import { Box, Button, TextField } from '@mui/material'
import { useState } from 'react'
import { CollapsingPanelHeader } from './CollapsingPanelHeader'

export function VectorStorageWorkerComponent({ wrapper }) {
  const primaryText = 'Manual Input'

  const [open, setOpen] = useState(false)
  const [inputData, setInputData] = useState({
    query: '',
    k: '3',
    filterOptions: {},
  })

  const [isValid, setIsValid] = useState(false)

  const validateForm = (form) => {
    const formdata = new FormData(form)
    let input = {
      query: formdata.get('query'),
      k: formdata.get('k'),
      filterOptions: JSON.parse(formdata.get('filterOptions')),
    }
    setInputData(input)

    console.log(input)
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
              onBlur={(e) => {
                validateForm(e.target.closest('form'))
              }}
              onSubmit={async (e) => {
                e.preventDefault()

                if (isValid) {
                  const results =
                    await wrapper.comlink.vectorStore.similaritySearch(
                      inputData
                    )
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
                  error={!inputData.query}
                  helperText={!inputData.query && 'Enter a valid query'}
                  name="query"
                  fullWidth
                  label="Search Query"
                  defaultValue={''}
                  variant="standard"
                />

                <TextField
                  sx={{ marginLeft: '8px' }}
                  error={!inputData.k}
                  helperText={!inputData.k ? 'Enter a valid number' : ''}
                  name="k"
                  label="Num Results"
                  type="number"
                  defaultValue={3}
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
                  error={!inputData.filterOptions}
                  helperText={
                    !inputData.filterOptions ? 'Enter a valid property' : ''
                  }
                  name="filterOptions"
                  fullWidth
                  label="Filter Options"
                  defaultValue={JSON.stringify({ category: 'web_search' })}
                  variant="standard"
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="outlined" type="submit" disabled={!isValid}>
                  Query
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
