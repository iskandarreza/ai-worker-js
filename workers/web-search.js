import { expose } from 'comlink'

self.onmessage = function (event) {
  if (event.data.channels) {
    self.channels = event.data.channels

    Object.keys(self.channels).forEach((key) => {
      const channel = self.channels[key]
      channel.postMessage({ type: 'Hello', payload: 'from Web Search Worker' })
    })

  }
}

async function googleSearch({ query, numResults = 8 }) {
  const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    }&cx=${process.env.NEXT_PUBLIC_GOOGLE_CX_ID}&q=${encodeURIComponent(query)}`
  const response = await fetch(apiUrl)
  const data = await response.json()

  // Extract the search results from the response data
  const results = await data.items?.map((item) => ({
    title: item.title,
    link: item.link,
    snippet: item.snippet,
  }))

  let entries = []

  for (const { title, link, snippet } of results) {
    const metadata = {
      link,
      question: query,
      title,
    }

    entries.push({ text: snippet, metadata })
  }

  return entries
}

async function searchVectorDB({ query, k }) {
  return new Promise((resolve, reject) => {
    const messageHandler = (event) => {
      if (event.data.type === 'vectorSearchResults') {
        const queryResults = event.data.payload
        resolve(queryResults)
        cleanup()
      }
    }

    self.channels.vectorStore.addEventListener('message', messageHandler)

    self.channels.vectorStore.postMessage({
      id: 'webSearch',
      type: 'vectorSearch',
      payload: {
        query,
        k,
        filterOptions: {
          metadata: { category: 'web_search' },
        },
      },
    })

    // Clean up the event listener after receiving the response
    const cleanup = () => {
      self.channels.vectorStore.removeEventListener('message', messageHandler)
    }

    // Set a timeout to handle cases where no response is received
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timeout: No response received.'))
    }, 15000)
  })
}

async function search({ query, k }) {
  const semanticSearch = await searchVectorDB({ query, k })
  let results = { ...semanticSearch }

  return results
}

expose({
  search,
})
