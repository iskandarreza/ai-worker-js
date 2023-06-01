import { expose } from 'comlink'
import { delegateToWorker } from '../utils/delegateToWorker'

self.onmessage = function (event) {
  if (event.data.channels) {
    self.channels = event.data.channels
    Object.keys(self.channels).forEach((key) => {
      const channel = self.channels[key]
      channel.postMessage({ type: 'Hello', payload: 'from Web Scraper Worker' })
      channel.onmessage = (e) => {} // weirdness, if this is not here, `countTokens` stops working
    })
  }
}

const scrapeWebPageAPI = async (url, selector) => {
  try {
    const apiUrl = `https://web.scraper.workers.dev?url=${encodeURIComponent(
      url
    )}&selector=${encodeURIComponent(selector)}&scrape=text`
    const response = await fetch(apiUrl)
    const data = await response.json()

    return data
  } catch (error) {
    console.error('An error occurred while scraping the web page:', error)
    return null
  }
}

async function scrape(url, selector, maxTokens = 400) {
  let _selector = !!selector ? selector : 'p, pre'
  const { result } = await scrapeWebPageAPI(url, _selector)

  const selectors = _selector.split(',')

  const validSelector = selectors.some((sel) => result && result[sel])

  if (!validSelector) {
    console.debug('Unable to fetch the data or selector not found')
    return []
  }

  const cssRegex = /\.css-[a-zA-Z0-9_-]+\{[^{}]*\}(?!\s*\n)/g

  const combinedTexts = []
  let currentIndex = 0

  for (const sel of selectors) {
    const trimmedSelector = sel.trim()
    const texts = result[trimmedSelector]

    if (!texts || texts.length === 0) {
      continue
    }

    let totalTokenCount = 0
    let currentText = ''

    for (const text of texts) {
      const cleanedText = text.replace(cssRegex, '')
      const newTokenCount = await countTokens(currentText + cleanedText)

      if (newTokenCount > maxTokens) {
        const splitTexts = await splitTextIntoChunks(
          currentText,
          maxTokens,
          currentIndex
        )
        for (const splitText of splitTexts) {
          combinedTexts.push({
            text: splitText.text.trim(),
            totalTokenCount: splitText.totalTokenCount,
            selector: trimmedSelector,
            index: splitText.index,
          })
        }
        currentIndex += splitTexts.length
        currentText = cleanedText + ' '
      } else {
        currentText += cleanedText + ' '
        totalTokenCount = newTokenCount
      }
    }

    if (currentText.trim().length > 0) {
      combinedTexts.push({
        text: currentText.trim(),
        totalTokenCount,
        selector: trimmedSelector,
        index: currentIndex,
      })
      currentIndex++
    }
  }

  return combinedTexts
}

async function splitTextIntoChunks(text, maxTokens, startIndex) {
  const punctuationRegex = /[.!?\n]/g
  const chunks = []
  let currentChunk = ''
  let currentIndex = startIndex

  const sentences = text.split(punctuationRegex)

  for (const sentence of sentences) {
    const chunkWithSentence = currentChunk ? currentChunk + sentence : sentence
    const chunkTokenCount = await countTokens(chunkWithSentence)

    if (chunkTokenCount > maxTokens) {
      let overlap = 40 + Math.floor(Math.random() * 41) // Random overlap between 40 and 80 tokens
      let remainingTokens = chunkTokenCount

      while (remainingTokens > maxTokens) {
        const splitText = chunkWithSentence.substring(0, maxTokens + overlap)
        const trimmedSplitText = splitText.trim()
        const splitTokenCount = await countTokens(trimmedSplitText)

        chunks.push({
          text: trimmedSplitText,
          totalTokenCount: splitTokenCount,
          index: currentIndex,
        })

        currentIndex++
        currentChunk = chunkWithSentence
          .substring(splitText.length - overlap)
          .trim()
        remainingTokens = await countTokens(currentChunk)
      }
    } else {
      currentChunk = chunkWithSentence.trim() + ' '
    }
    currentIndex++
  }

  if (currentChunk) {
    chunks.push({
      text: currentChunk.trim(),
      totalTokenCount: await countTokens(currentChunk),
      index: currentIndex,
    })
  }

  return chunks
}

async function countTokens(text) {
  return await delegateToWorker({
    channel: self.channels.tokenCounter,
    request: 'countTokens',
    params: text,
    listenEvent: 'countTokenResults',
  })
}

expose({
  scrape: async ({ url, selector, maxTokens = 400 }) => {
    const results = await scrape(url, selector, maxTokens)
    let totalTokenCount = 0
    for (let i = 0; i < results.length; i++) {
      totalTokenCount += results[i].totalTokenCount
    }

    return results
  },
})
