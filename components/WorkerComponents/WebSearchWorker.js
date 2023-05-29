import { Box, Button, TextField } from '@mui/material'
import { useState } from 'react'
import { CollapsingPanelHeader } from './CollapsingPanelHeader'
import { DynamicReactJson } from '../DynamicReactJson'

export function WebSearchWorkerComponent({ wrapper }) {
  const primaryText = 'Manual Input'
  const [searchResults, setSearchResults] = useState([])

  const [open, setOpen] = useState(false)
  const [inputData, setInputData] = useState({
    query: '',
    numResults: '8',
  })

  const [isValid, setIsValid] = useState(false)

  const validateForm = (form) => {
    const formdata = new FormData(form)
    let input = {
      query: formdata.get('query'),
      numResults: formdata.get('numResults'),
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
              onBlur={(e) => {
                validateForm(e.target.closest('form'))
              }}
              onSubmit={async (e) => {
                e.preventDefault()

                if (isValid) {
                  const results = await wrapper.comlink.googleSearch({
                    query: inputData.query,
                    numResults: inputData.numResults,
                  })
                  setSearchResults(results)
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
                  error={!inputData.numResults}
                  helperText={
                    !inputData.numResults ? 'Enter a valid number' : ''
                  }
                  name="numResults"
                  label="Num Results"
                  type="number"
                  defaultValue={10}
                  variant="standard"
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  type="button"
                  disabled={!isValid}
                  onClick={async (e) => {
                    const results = await wrapper.comlink.searchPastQueries({
                      query: inputData.query,
                      k: inputData.numResults,
                    })

                    setSearchResults(results)
                  }}
                >
                  Query DB
                </Button>
                <Button variant="outlined" type="submit" disabled={!isValid}>
                  Search Web
                </Button>
              </Box>
            </form>
          </Box>
        ) : (
          ''
        )}
        {searchResults.length > 0 ? (
          <>
            <DynamicReactJson
              name={'Data Array'}
              src={searchResults}
              theme={'rjv-default'}
              collapsed
            />
          </>
        ) : (
          ''
        )}
      </Box>
    </>
  )
}
