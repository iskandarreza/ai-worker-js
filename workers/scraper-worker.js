import { expose } from 'comlink'

self.onmessage = function (event) {
  if (event.data.channels) {
    self.channels = event.data.channels
    Object.keys(self.channels).forEach((key) => {
      const channel = self.channels[key]
      channel.postMessage({ type: 'Hello', payload: 'from Web Scraper Worker' })
      channel.onmessage = (e) => { } // weirdness, if this is not here, `countTokens` stops working
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

async function countTokens(text) {
  return new Promise((resolve, reject) => {
    const messageHandler = (event) => {
      if (event.data.type === 'countTokenResults') {
        const tokenCount = event.data.payload
        resolve(tokenCount)
        cleanup()
      }
    }

    self.channels.tokenCounter.addEventListener('message', messageHandler)

    self.channels.tokenCounter.postMessage({
      type: 'countTokens',
      payload: text,
    })

    // Clean up the event listener after receiving the response
    const cleanup = () => {
      self.channels.tokenCounter.removeEventListener('message', messageHandler)
    }

    // Set a timeout to handle cases where no response is received
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timeout: No response received.'))
    }, 15000)
  })
}

async function scrape(url, selector = 'p, pre', maxTokens = 1000) {
  const { result } = await scrapeWebPageAPI(url, selector)

  const selectors = selector.split(',')

  const validSelector = selectors.some((sel) => result && result[sel])

  if (!validSelector) {
    console.debug('Unable to fetch the data or selector not found')
    return []
  }

  let totalTokenCount = 0
  let combinedTexts = []
  let currentText = ''

  for (const sel of selectors) {
    const texts = result[sel]

    if (!texts || texts.length === 0) {
      continue
    }

    for (const text of texts) {
      const newTokenCount = await countTokens(currentText + text)

      if (newTokenCount > maxTokens) {
        combinedTexts.push({ currentText: currentText.trim(), totalTokenCount })
        currentText = text + ' '
        totalTokenCount = await countTokens(text)
      } else {
        currentText += text + ' '
        totalTokenCount = newTokenCount
      }
    }
  }

  if (currentText.trim().length > 0) {
    combinedTexts.push({ currentText: currentText.trim(), totalTokenCount })
  }

  return combinedTexts
}


expose({
  scrape: async ({ url, selector, maxTokens }) => {
    const results = await scrape(url, selector, maxTokens)
    let totalTokenCount = 0
    for (let i = 0; i < results.length; i++) {
      totalTokenCount += results[i].totalTokenCount
    }

    return results
  },
})
