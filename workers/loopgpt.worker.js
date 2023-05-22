import loopgpt from 'loopgpt-js'
const { Agent } = loopgpt

const initWorker = async () => {
  let agent
  let cycle = 0
  let response

  self.onmessage = async (event) => {
    const { type, payload } = event.data

    const postMessage = (type, payload) => {
      self.postMessage({
        type,
        payload: {
          fromId: self.id,
          toId: 'all',
          content: payload,
        },
      })
    }

    switch (type) {
      case 'init':
        self.id = payload.id
        agent = await initAgent()
        postState(agent.config())
        break

      case 'config':
        agent.name = payload.name
        agent.description = payload.description
        agent.goals = payload.goals
        agent.constraints = payload.constraints
        postState(agent.config())
        break

      case 'chat':
        // startChat()
        chatLoop()
        break

      case 'runTool':
        await runTool()
        break

      case 'state':
        postState(agent.config())
        break

      case 'hello':
        postMessage('message', 'Hello!')
        break

      default:
        break
    }

    async function runTool() {
      postMessage('message', 'Running staged tool...')
      const response = await agent.chat({ run_tool: true })
      postState(agent.config())
      if (response) postMessage('response', response)
    }

    async function startChat() {
      postMessage('message', 'Initiating chat...')
      const response = await agent.chat({ message: payload })
      postState(agent.config())
      postMessage('response', response)
      return response
    }

    async function chatLoop() {
      postMessage('message', 'Initiating chat...')

      response = await agent.chat({ message: null })
      postState(agent.config())
      postResponse({ ...{ cycle }, ...response })

      while (response?.command?.name !== 'task_complete' && cycle <= 12) {
        cycle++
        response = await agent.chat({ run_tool: true })
        postState(agent.config())
        postResponse({ ...{ cycle }, ...response })

        if (
          JSON.stringify(agent.config()?.tool_response)?.includes(
            'Critical error, threads should be ended'
          )
        ) {
          const errMsg = 'Critical error, ending loop.'
          postError({ errMsg, response })
          throw Error(errMsg)
        }

        if (response?.error) {
          const errMsg = 'Error in response, ending loop.'
          postError({ errMsg, response })
          throw Error(errMsg)
        }
      }

      function postResponse(response) {
        if (response) {
          // for the UI, don't delete!
          postMessage('response', response)
          postMessage('tool_response', agent.tool_response)

          // the rest are for logging
          postMessage(`Cycle ${cycle}`, response)

          if (response.thoughts) {
            postMessage('thoughts', response.thoughts)
          }

          if (response.plan) {
            postMessage('plan', response.plan)
          }

          if (response.command) {
            postMessage('command', response.command)
          }
        }
      }
    }
  }

  self.onerror = (event) => {
    postError(event)
  }
}

async function initAgent() {
  const openaiApiKeyResponse = await fetch('/api/openai', {
    method: 'POST',
  })
  const googleApiKeyResponse = await fetch('/api/google', {
    method: 'POST',
  })

  const { apiKey: openaiApiKey } = await openaiApiKeyResponse.json()
  const { apiKey: googleApiKey, cxId } = await googleApiKeyResponse.json()

  const apiUrl = 'https://api.openai.com/v1/chat/completions'

  const keys = {
    openai: { apiKey: openaiApiKey, apiUrl },
    google: {
      googleApiKey: googleApiKey,
      googleCxId: cxId,
    },
  }

  // Create a new instance of the Agent class
  const agent = new Agent({
    keys: keys,
  })

  return agent
}

function postError(error) {
  self.postMessage({
    type: 'error',
    payload: {
      fromId: self.id,
      toId: 'all',
      content: {
        name: error.name,
        message: error.message,
        ...(!!error.stack && { stack: error.stack }),
      },
    },
  })
}

function postState(agentConfig) {
  let content = { ...agentConfig }
  const { memory } = { ...content }

  self.postMessage({
    type: 'memory',
    payload: {
      fromId: self.id,
      toId: 'all',
      content: memory,
    },
  })


  delete content.memory
  self.postMessage({
    type: 'state',
    payload: {
      fromId: self.id,
      toId: 'all',
      content,
    },
  })
}

initWorker()
