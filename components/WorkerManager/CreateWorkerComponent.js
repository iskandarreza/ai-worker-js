import { Box, Button, ListItem } from '@mui/material'
import { useDispatch } from 'react-redux'
import { ADD_AGENT } from '../../store/types'
import { v4 as uuidv4 } from 'uuid'
import { useEffect } from 'react'
import { wrap } from 'comlink'

class WorkerWrapper {
  constructor(type) {
    this.type = type
    this.id = uuidv4()
    this.assetPath = `/workers/${type}.js`
    this.worker = new Worker(new URL(this.assetPath, window.location.origin), {
      name: type,
      credentials: 'same-origin',
      type: 'module',
    })
    this.comlink = wrap(this.worker)
  }
}

function createWorker(type) {
  const wrapper = new WorkerWrapper(type)
  wrapper.worker.postMessage({
    type: 'init',
    payload: { id: wrapper.id },
  })
  return wrapper
}

export function CreateWorkerComponent() {
  const dispatch = useDispatch()
  const workerTypes = ['pyodide', 'loopgpt']

  useEffect(() => {
    const tokenCounter = createWorker('token-counter')
    const scraperWorker = createWorker('scraper-worker')
    dispatch({ type: ADD_AGENT, payload: tokenCounter })
    dispatch({ type: ADD_AGENT, payload: scraperWorker })

    function listenForTokenCounter() {
      return (event) => {
        const { type, payload } = event.data
        // console.debug(`main received dispatch`, { type, payload })

        switch (type) {
          case 'init':
            console.log({ type, payload })
            break

          default:
            break
        }
      }
    }

    function listenForScraper() {
      return (event) => {
        const { type, payload } = event.data
        // console.debug(`main received dispatch`, { type, payload })

        switch (type) {
          case 'init':
            console.log({ type, payload })
            break

          case 'countTokens':
            tokenCounter.comlink.countTokens(payload).then((result) => {
              scraperWorker.worker.postMessage({
                type: 'countTokenResults',
                payload: result
              })
            })

            break

          default:
            break
        }
      }
    }

    tokenCounter.comlink.init()
    scraperWorker.comlink.init()

    tokenCounter.worker.addEventListener('message', listenForTokenCounter())
    scraperWorker.worker.addEventListener('message', listenForScraper())

    let test = async () => {
      const results = await scraperWorker.comlink.scrape({
        url: 'https://cameronrwolfe.substack.com/p/practical-prompt-engineering-part',
        selector: 'p',
        maxTokens: 1000,
      })

      return results
    }

    test().then(results => {
      console.log({ results })
    })


    return () => {
      tokenCounter.worker.removeEventListener('message', listenForTokenCounter)
      scraperWorker.worker.removeEventListener('message', listenForScraper)
      tokenCounter.comlink.terminate()
      scraperWorker.comlink.terminate()
    }
  }, [])

  return (
    <Box display={'flex'}>
      {workerTypes.map((type, index) => (
        <ListItem key={`${type}-${index}`}>
          <Button
            variant="outlined"
            onClick={() => {
              dispatch({ type: ADD_AGENT, payload: createWorker(type) })
            }}
          >
            Create {`${type.toUpperCase()}`} Worker
          </Button>
        </ListItem>
      ))}
    </Box>
  )
}
