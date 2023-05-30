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

async function scrape(url, selector, maxTokens = 1000) {
  let _selector = !!selector ? selector : 'p, pre'
  const { result } = await scrapeWebPageAPI(url, _selector)
  const countTokens = async (text) =>
    await delegateToWorker({
      channel: self.channels.tokenCounter,
      request: 'countTokens',
      params: text,
      listenEvent: 'countTokenResults',
    })

  const selectors = _selector.split(',')

  const validSelector = selectors.some((sel) => result && result[sel])

  if (!validSelector) {
    console.debug('Unable to fetch the data or selector not found')
    return []
  }

  const cssRegex = /\.css-[a-zA-Z0-9_-]+\{[^{}]*\}(?!\s*\n)/g

  const combinedTexts = []

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
        combinedTexts.push({
          text: currentText.trim(),
          totalTokenCount,
          selector: trimmedSelector,
        })
        currentText = cleanedText + ' '
        totalTokenCount = await countTokens(text)
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
      })
    }
  }

  return combinedTexts
}

expose({
  scrape: async ({ url, selector, maxTokens = 1000 }) => {
    const results = await scrape(url, selector, maxTokens)
    let totalTokenCount = 0
    for (let i = 0; i < results.length; i++) {
      totalTokenCount += results[i].totalTokenCount
    }

    return results
  },
})
