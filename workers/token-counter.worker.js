import { encode } from 'gpt-tok'

const initWorker = async () => {
  // Listen for messages from the main thread
  self.onmessage = (event) => {
    const { type, payload } = event.data

    if (type === 'init') {
      // Respond to the initialization message
      self.postMessage({
        type: 'init',
        payload: 'Token Counter Worker initialized.',
      })
    }

    if (type === 'countTokens') {
      const tokenCount = encode(payload).length

      self.postMessage({
        type: 'countTokenResults',
        payload: tokenCount,
      })
    }
  }
}

initWorker()
