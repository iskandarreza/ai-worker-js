import { getSystemWorkers } from '../../utils/getSystemWorkers'
import { splitArray } from '../../utils/splitArray'

export const sendReport = {
  description: 'Send Report Function, sends a report to the user',
  args: '{text: string}',
  run: async (args) => {
    console.debug('Send report: ', { args })
    return 'Report sent'
  },
}

export const webSearchWorker = {
  description:
    'Web Search Worker, returns the most relevant query results from the web or the vector db',

  args: '{query: string, numResults: number}',
  run: async (args) => {
    const systemWorkers = await getSystemWorkers()
    const searcher = systemWorkers.find(
      (worker) => worker.name === 'web-search'
    )
    const vector = systemWorkers.find(
      (worker) => worker.name === 'vector-storage'
    )
    const tokenCounter = systemWorkers.find(
      (worker) => worker.name === 'token-counter'
    )

    const results = await searcher.comlink.googleSearch(args)
    console.debug('Search results', { results })

    // save to vectordb
    const [texts, metadatas] = splitArray(results)
    await vector.comlink.addTexts({ texts, metadatas })

    // get relevant results from vectorDB
    const relevantResults = await searcher.comlink.searchPastQueries({
      query: args.query,
      k: args.numResults <= 10 ? args.numResults : 10,
    })
    const parsedResults = relevantResults.similarItems.map(
      (entry) =>
        `${entry.metadata.title}\n${
          entry.metadata.link || entry.metadata.url
        }\n\"${entry.text}\"`
    )

    // calculate token usage, send whatever result items that can fit the limit
    let totalTokens = 0
    const maxTokens = 1000
    const selectedResults = []

    for (const result of parsedResults) {
      const tokenCount = await tokenCounter.comlink.countTokens(`${result}\n\n`)
      totalTokens += tokenCount

      if (totalTokens <= maxTokens) {
        selectedResults.push(result)
      } else {
        break
      }
    }

    if (selectedResults.length !== 0) {
      if (args.numResults && Number.isInteger(args.numResults)) {
        return `\nQuestion: ${args.query}\n\n${selectedResults
          .slice(0, args.numResults)
          .join('\n\n')}`
      } else {
        return `\nQuestion: ${args.query}\n\n${selectedResults.join('\n\n')}`
      }
    } else {
      return 'ERROR: Unable to fetch the data or no results found'
    }
  },
}

export const webScraperWorker = {
  description:
    'Web Scraper Worker, scrapes a url, add a relevant question string for db metadata',

  args: '{url: string, question: string}',
  run: async (args) => {
    const systemWorkers = await getSystemWorkers()
    const scraper = systemWorkers.find(
      (worker) => worker.name === 'scraper-worker'
    )
    const vector = systemWorkers.find(
      (worker) => worker.name === 'vector-storage'
    )
    const tokenCounter = systemWorkers.find(
      (worker) => worker.name === 'token-counter'
    )

    // Check vector storage
    const getFromVectorDB = async () => {
      const curatedResults = await vector.comlink.similaritySearch({
        query: args.question,
        k: 10,
        filterOptions: {
          include: {
            metadata: {
              link: args.url,
            },
          },
          exclude: {
            metadata: {
              category: 'web_search',
            },
          },
        },
      })

      const results = await curatedResults.similarItems.map((item) => {
        return {
          text: item.text,
          index: item.index,
        }
      })

      // calculate token usage, send whatever result items that can fit the limit
      let totalTokens = 0
      const maxTokens = 1000
      const selectedResults = []

      for (const result of results) {
        const tokenCount = await tokenCounter.comlink.countTokens(
          `${result.text}\n\n`
        )
        totalTokens += tokenCount

        if (totalTokens <= maxTokens) {
          selectedResults.push(result)
        } else {
          break
        }
      }

      return selectedResults
    }

    const selectedResults = await getFromVectorDB()

    if (selectedResults.length > 0) {
      console.debug({ args, selectedResults })
      return `${selectedResults.map((v) => v.text).join('\n')}`
    } else {
      const results = await scraper.comlink.scrape(args)

      if (results.length !== 0) {
        console.debug('Scraper results', { results })

        if (results.length > 1) {
          let texts = []
          let metadatas = []

          for (const result of results) {
            texts.push(result.text)
            metadatas.push({
              category: 'scraped_data',
              link: args.url,
              selector: result.selector,
              index: results.index,
            })
          }

          // add to vector storage
          await vector.comlink.addTexts({ texts, metadatas })

          const selectedResults = await getFromVectorDB()

          return `${selectedResults.map((v) => v.text).join('\n')}`
        } else {
          return `${results.text}`
        }
      } else {
        return 'Unable to fetch the data or selector not found'
      }
    }
  },
}