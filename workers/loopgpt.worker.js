import loopgpt from 'loopgpt-js'
const {
  Agent,
  AgentStates,
  LocalMemory,
  OpenAIEmbeddingProvider,
  OpenAIModel,
} = loopgpt

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

function postState(agent) {
  const agentConfig = {...agent}
  agentConfig.model.apiKey = null
  self.postMessage({
    type: 'state',
    payload: {
      fromId: self.id,
      toId: 'all',
      content: agentConfig,
    },
  })
}

const initWorker = async () => {
  let agent

  self.onmessage = async (event) => {
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

    const { type, payload } = event.data

    switch (type) {
      case 'init':
        self.id = payload.id
        agent = await initAgent()
        postState(agent)
        break

      case 'config':
        agent.name = payload.name
        agent.description = payload.description
        agent.goals = payload.goals
        agent.constraints = payload.constraints
        postState(agent)
        break

      case 'chat':
        startChat()
        break

      case 'runTool':
        await runTool()
        break

      case 'state':
        postState(agent)
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
      postState(agent)
      postMessage('response', response)
    }

    async function startChat() {
      postMessage('message', 'Initiating chat...')
      const response = await agent.chat({ message: payload })
      postState(agent)
      postMessage('response', response)
      return response
    }

    async function initAgent() {
      const apiKeyResponse = await fetch('/api/openai', {
        method: 'POST',
      })

      const { apiKey } = await apiKeyResponse.json()

      const apiUrl = 'https://api.openai.com/v1/chat/completions'

      // Create a new instance of the Agent class
      const agent = new Agent({
        model: new OpenAIModel('gpt-3.5-turbo', apiKey, apiUrl),
        embedding_provider: new OpenAIEmbeddingProvider(),
        temperature: 0.8,
        memory: new LocalMemory(),
        history: [],
        goals: [],
        progress: [],
        plan: [],
        constraints: [],
        state: AgentStates.START,
      })

      return agent
    }
  }
}

initWorker()
