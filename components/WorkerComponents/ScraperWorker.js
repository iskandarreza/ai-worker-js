import { Box, Button, TextField } from '@mui/material'
import { useState } from 'react'
import { CollapsingPanelHeader } from './CollapsingPanelHeader'
import { DynamicReactJson } from '../DynamicReactJson'
import { getSystemWorkers } from '../../utils/getSystemWorkers'
import { splitArray } from '../../utils/splitArray'

export function ScraperWorkerComponent({ wrapper }) {
  const primaryText = 'Manual Input'
  const [scrapedData, setScrapedData] = useState([])

  const [open, setOpen] = useState(false)
  const [inputData, setInputData] = useState({
    url: '',
    selector: 'p, pre',
    maxTokens: 400,
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
                  setScrapedData(results)
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
                  defaultValue={inputData.selector}
                  variant="standard"
                />

                <TextField
                  sx={{ marginLeft: '8px' }}
                  error={!inputData.maxTokens}
                  helperText={!inputData.maxTokens ? 'Enter a valid URL' : ''}
                  name="maxtokens"
                  label="Max Tokens"
                  type="number"
                  defaultValue={inputData.maxTokens}
                  variant="standard"
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  type="button"
                  disabled={!isValid && scrapedData.length !== 0}
                  onClick={async (e) => {
                    const preparedData = scrapedData.map(
                      ({ text, selector }, index) => {
                        return {
                          text,
                          metadata: {
                            category: 'scraped_data',
                            link: inputData.url,
                            selector,
                            index,
                          },
                        }
                      }
                    )

                    const [texts, metadatas] = splitArray(preparedData)
                    const systemWorkers = await getSystemWorkers()
                    const [vectorStore] = systemWorkers.filter(
                      (worker) => worker.name === 'vector-storage'
                    )

                    vectorStore.comlink
                      .addTexts({ texts, metadatas })
                      .then(() => {
                        console.info('Data added to vector store')
                      })
                  }}
                >
                  Get Embeddings
                </Button>
                <Button variant="outlined" type="submit" disabled={!isValid}>
                  Scrape
                </Button>
              </Box>
            </form>
          </Box>
        ) : (
          ''
        )}

        {scrapedData.length > 0 ? (
          <>
            <DynamicReactJson
              name={'Data Array'}
              src={scrapedData}
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
