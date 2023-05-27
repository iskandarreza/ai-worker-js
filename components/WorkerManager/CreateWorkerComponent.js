import { Box, Button, ListItem } from '@mui/material'
import { useDispatch } from 'react-redux'
import { ADD_AGENT } from '../../store/types'
import { v4 as uuidv4 } from 'uuid'
import { useEffect } from 'react'
import { wrap } from 'comlink'

class WorkerWrapper {
  constructor(name, type) {
    this.name = name
    this.type = type

    this.id = uuidv4()
    this.assetPath = `/workers/${name}.js`
    this.worker = new Worker(new URL(this.assetPath, window.location.origin), {
      name: name,
      credentials: 'same-origin',
      type: 'module',
    })
    this.comlink = wrap(this.worker)
  }
}

function createWorker(name, type) {
  const wrapper = new WorkerWrapper(name, type)

  return wrapper
}

export function CreateWorkerComponent() {
  const dispatch = useDispatch()
  const agents = [
    { name: 'pyodide', type: 'agent' },
    { name: 'loopgpt', type: 'agent' },
  ]

  useEffect(initSystemWorkers(), [])

  return (
    <Box display={'flex'}>
      {agents.map(({ name, type }, index) => (
        <ListItem key={`${name}-${index}`}>
          <Button
            variant="outlined"
            onClick={() => {
              dispatch({ type: ADD_AGENT, payload: createWorker(name, type) })
            }}
          >
            Create {`${name.toUpperCase()}`} Worker
          </Button>
        </ListItem>
      ))}
    </Box>
  )

  function initSystemWorkers() {
    return () => {
      const createSystemWorker = (name) => createWorker(name, 'system-worker')
      const vectorStorage = createSystemWorker('vector-storage')
      dispatch({ type: ADD_AGENT, payload: vectorStorage })

      const webSearch = createSystemWorker('web-search')
      dispatch({ type: ADD_AGENT, payload: webSearch })

      const tokenCounter = createSystemWorker('token-counter')
      const scraperWorker = createSystemWorker('scraper-worker')

      dispatch({ type: ADD_AGENT, payload: tokenCounter })
      dispatch({ type: ADD_AGENT, payload: scraperWorker })

      setupMessageChannels()

      return () => {
        vectorStorage.comlink.terminate()
        webSearch.comlink.terminate()
        tokenCounter.comlink.terminate()
        scraperWorker.comlink.terminate()
      }

      function setupMessageChannels() {
        const channelWebSearchVector = new MessageChannel()
        const channelScraperVector = new MessageChannel()
        const channelScraperTokenCounter = new MessageChannel()
        const portVectorToWebSearch = channelWebSearchVector.port1
        const portWebSearchToVector = channelWebSearchVector.port2
        const portVectorToScraper = channelScraperVector.port1
        const portScraperToVector = channelScraperVector.port2
        const portTokenCounterToScraper = channelScraperTokenCounter.port1
        const portScraperToTokenCounter = channelScraperTokenCounter.port2

        vectorStorage.worker.postMessage(
          {
            channels: {
              webSearch: portVectorToWebSearch,
              webScraper: portVectorToScraper
            }
          },
          [portVectorToWebSearch, portVectorToScraper]
        )
        webSearch.worker.postMessage(
          { channels: { vectorStore: portWebSearchToVector } },
          [portWebSearchToVector]
        )
        tokenCounter.worker.postMessage(
          { channels: { webScraper: portTokenCounterToScraper } },
          [portTokenCounterToScraper]
        )
        scraperWorker.worker.postMessage(
          {
            channels: {
              vectorStore: portScraperToVector,
              tokenCounter: portScraperToTokenCounter
            }
          },
          [portScraperToVector, portScraperToTokenCounter]
        )
      }
    }
  }
}
