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
      channel.postMessage({
        type: 'Hello',
        payload: 'from Vector Storage Worker',
      })

      channel.onmessage = function (event) {
        const { type, payload } = event.data

        switch (type) {
          case 'vectorSearch':
            similaritySearch({
              query: payload.query,
              k: payload.k,
              filterOptions: {
                metadata: { category: payload.category },
              },
            }).then((results) => {
              channel.postMessage({
                type: 'vectorSearchResults',
                payload: results,
              })
            })

            break

          case 'addTexts':
            addTexts(payload)
              .then(() => {
                channel.postMessage({
                  type: 'addTextsSuccess',
                })
              })
              .catch((e) => {
                channel.postMessage({
                  type: 'addTextsError',
                  payload: e,
                })
              })

          default:
            break
        }
      }
    })
  }
}

async function similaritySearch({ query, k, filterOptions }) {
  const results = await vectorStore.similaritySearch({
    query,
    k,
    filterOptions,
  })
  return results
}

async function addText({ text, metadata }) {
  const results = await vectorStore.addText(text, metadata).then(() => {
    return 'Data added to vectorStore'
  })

  return results
}

async function addTexts({ texts, metadatas }) {
  const results = await vectorStore.addTexts(texts, metadatas).then(() => {
    return 'Data added to vectorStore'
  })

  return results
}

expose({
  similaritySearch,
  addText,
  addTexts,
})
