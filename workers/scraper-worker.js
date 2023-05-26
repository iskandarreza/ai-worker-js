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

// Listen for messages from the main thread
self.onmessage = async (event) => {
  const { type, payload } = event.data
  // console.debug(`Web Scraper worker received dispatch`, { type, payload })

  if (type === 'init') {
    // Respond to the initialization message
    self.postMessage({
      type: 'init',
      payload: 'Web Scraper Worker initialized.',
    })
  }

  if (type === 'scrapePage') {
    const { url, selector, maxTokens } = payload
    const results = await scrape(url, selector, maxTokens)

    self.postMessage({
      type: 'scraperResults',
      payload: results,
    })
  }

  async function countTokens(text) {
    return new Promise((resolve, reject) => {
      const messageHandler = (event) => {
        if (event.data.type === 'countTokenResults') {
          const tokenCount = event.data.payload
          resolve(tokenCount)
        }
      }

      self.addEventListener('message', messageHandler)

      self.postMessage({
        type: 'countTokens',
        payload: text,
      })

      // Clean up the event listener after receiving the response
      const cleanup = () => {
        self.removeEventListener('message', messageHandler)
      }

      // Set a timeout to handle cases where no response is received
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Timeout: No response received.'))
      }, 5000)

      // Clear the timeout and clean up when the response is received
      const handleResponse = (tokenCount) => {
        clearTimeout(timeout)
        cleanup()
        resolve(tokenCount)
      }

      setTimeout(handleResponse, 500)
    })
  }

  async function scrape(url, selector, maxTokens) {
    const { result } = await scrapeWebPageAPI(url, selector)

    if (!result || !result[selector]) {
      console.debug('Unable to fetch the data or selector not found')
      return []
    }

    let totalTokenCount = 0
    let combinedTexts = []
    let currentText = ''

    for (const text of result[selector]) {
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

    if (currentText.trim().length > 0) {
      combinedTexts.push({ currentText: currentText.trim(), totalTokenCount })
    }

    return combinedTexts
  }
}
