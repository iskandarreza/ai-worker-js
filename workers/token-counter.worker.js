import { expose } from 'comlink'
import { encode } from 'gpt-tok'

self.onmessage = function (event) {
  if (event.data.channels) {
    self.channels = event.data.channels

    Object.keys(self.channels).forEach((key) => {
      const channel = self.channels[key]
      channel.postMessage({
        type: 'Hello',
        payload: 'from Token Counter Worker',
      })

      channel.onmessage = function (event) {
        const { type, payload } = event.data

        switch (type) {
          case 'countTokens':
            channel.postMessage({
              type: 'countTokenResults',
              payload: countTokens(payload),
            })

            break

          default:
            break
        }
      }
    })
  }
}

function countTokens(text) {
  const tokenCount = encode(text).length
  return tokenCount
}

expose({
  countTokens,
})
