import { expose } from 'comlink'
import { delegateToWorker } from '../utils/delegateToWorker'

self.onmessage = function (event) {
  if (event.data.channels) {
    self.channels = event.data.channels

    Object.keys(self.channels).forEach((key) => {
      const channel = self.channels[key]
      channel.postMessage({ type: 'Hello', payload: 'from Web Search Worker' })
      channel.onmessage = (e) => {} // weirdness, if this is not here, `searchVectorDB` stops working
    })
  }
}

async function googleSearch({ query, numResults = 8 }) {
  const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY
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
      category: 'web_search',
    }

    entries.push({ text: snippet, metadata })
  }

  return entries
}

async function searchPastQueries({ query, k }) {
  const semanticSearch = await delegateToWorker({
    channel: self.channels.vectorStore,
    request: 'vectorSearch',
    params: {
      query,
      k,
      filterOptions: {
        metadata: { category: 'web_search' },
      },
    },
    listenEvent: 'vectorSearchResults',
  })
  let results = { ...semanticSearch }

  return results
}

expose({
  searchPastQueries,
  googleSearch,
})
