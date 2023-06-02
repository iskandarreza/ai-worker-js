export async function delegateToWorker({
  channel,
  request,
  params,
  listenEvent,
}) {
  return new Promise((resolve, reject) => {
    const messageHandler = (event) => {
      if (event.data.type === listenEvent) {
        const results = event.data.payload
        resolve(results)
        cleanup()
      }
    }

    channel.addEventListener('message', messageHandler)

    channel.postMessage({
      type: request,
      payload: params,
    })

    // Clean up the event listener after receiving the response
    const cleanup = () => {
      channel.removeEventListener('message', messageHandler)
    }

    // Set a timeout to handle cases where no response is received
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timeout: No response received.'))
    }, 15000)
  })
}
