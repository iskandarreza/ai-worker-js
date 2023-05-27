import { expose } from 'comlink'
import { VectorStorage } from 'vector-storage'

const vectorStore = new VectorStorage({
  openAIApiKey: process.env.NEXT_PUBLIC_OPEN_AI_API_KEY,
})

self.onmessage = function (event) {
  if (event.data.channels) {
    self.channels = event.data.channels

    Object.keys(self.channels).forEach((key) => {
      const channel = self.channels[key]
      channel.postMessage({ type: 'Hello', payload: 'from Vector Storage Worker' })

      channel.onmessage = function (event) {
        const { type, payload } = event.data

        switch (type) {
          case 'vectorSearch':
            console.log({ type, payload })
            vectorStore
              .similaritySearch({
                query: payload.query,
                k: payload.k,
                filterOptions: {
                  metadata: { category: payload.category },
                },
              })
              .then((results) => {
                console.log({ results })

                channel.postMessage({
                  type: 'vectorSearchResults',
                  payload: results,
                })
              })

            break

          default:
            break
        }
      }
    })
  }
}

expose({
  vectorStore,
})
