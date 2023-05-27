import loopgpt from 'loopgpt-js'
const { Agent } = loopgpt

const initWorker = async () => {
  let agent
  let cycle = 0
  let cycleLimit = 12
  let response
  let stopLoop = false

  self.onmessage = async (event) => {
    const { type, payload } = event.data
    console.debug(`worker${!!self.id ? ` ${self.id}` : ''} received dispatch`, {
      type,
      payload,
    })

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
        setConfig()
        break

      case 'chat':
        startChat()
        break

      case 'loop':
        chatLoop()
        break

      case 'stop':
        stopLoop = true
        break

      case 'runTool':
        await runTool()
        break

      case 'state':
        postState(agent.config())
        break

      default:
        break
    }

    function setConfig() {
      agent.name = payload.name
      agent.description = payload.description
      agent.goals = payload.goals
      agent.constraints = payload.constraints
      postState(agent.config())
    }

    function postResponse(response) {
      if (response) {
        let content = {}
        try {
          const parsed = JSON.parse(response)
          if (parsed.error) {
            content = {
              ...parsed,
            }
          }
        } catch (err) {
          content = {
            ...response,
          }
        }

        postState(agent.config())
        postMessage('response', { ...content, cycle, config: agent.config() })
      }
    }

    async function startChat() {
      try {
        postMessage('message', 'Initiating chat...')
        const response = await agent.chat({ message: payload.message })
        postResponse(response)
        return response
      } catch (error) {
        postError(error)
      }
    }

    async function runTool() {
      postMessage('message', 'Running staged tool...')
      try {
        const response = await agent.chat({ run_tool: true })
        if (response) postResponse(response)
      } catch (error) {
        postError(error)
      }
    }

    async function chatLoop() {
      postMessage('message', 'Initiating chat...')

      try {
        stopLoop = false
        response = await agent.chat({ message: null })
        postResponse(response)

        while (
          !stopLoop &&
          cycle <= cycleLimit &&
          response?.command?.name !== 'task_complete'
        ) {
          postMessage('next_cycle', { history: agent.config().history })
          cycle++
          response = await agent.chat({ run_tool: true })
          postState(agent.config())
          postResponse(response)

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
      } catch (error) {
        postError(error)
      }
    }
  }

  self.onerror = (event) => {
    postError(event)
  }
}

async function initAgent() {
  const apiUrl = 'https://api.openai.com/v1/chat/completions'

  const keys = {
    openai: { apiKey: process.env.NEXT_PUBLIC_OPEN_AI_API_KEY, apiUrl },
    google: {
      googleApiKey: NEXT_PUBLIC_GOOGLE_API_KEY,
      googleCxId: NEXT_PUBLIC_GOOGLE_CX_ID,
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
