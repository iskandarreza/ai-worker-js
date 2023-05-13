importScripts('/swenv.js')
const apiUrl = 'https://api.openai.com/v1/chat/completions'
const apiKey = process.env.NEXT_PUBLIC_OPEN_AI_API_KEY

// Define your AI agent
const agent = {
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello world' }],
  max_tokens: 50,
  n: 1,
  stop: '\n',
  temperature: 0.5,
}

// Send a request to the OpenAI API
fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: agent.model,
    messages: agent.messages,
    max_tokens: agent.max_tokens,
    n: agent.n,
    stop: agent.stop,
    temperature: agent.temperature,
  }),
})
  .then((response) => response.json())
  .then((data) => {
    // Return the response to the main thread
    self.postMessage(data)
  })
  .catch((error) => {
    console.error(error)
  })
