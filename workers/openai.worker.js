// Credits to Fariz Rahman for https://github.com/farizrahman4u/loopgpt
// importScripts('/workers/bundles/openai-bundle.js')
// TODO: above import not working, need alternative, using simple regex for now to accomplish token counting

const DEFAULT_AGENT_NAME = 'AI-Worker'
const DEFAULT_AGENT_DESCRIPTION =
  'Autonomous AI Agent that runs in a web worker thread'

const _DEFAULT_RESPONSE_FORMAT = {
  thoughts: {
    text: 'What do you want to say to the user?',
    reasoning: 'Why do you want to say this?',
    progress: '- A detailed list\n - of everything you have done so far',
    plan: '- short bulleted\n- list that conveys\n- long-term plan',
    speak: 'thoughts summary to say to user',
  },
  command: { name: 'next command in your plan', args: { arg_name: 'value' } },
}
const DEFAULT_RESPONSE_FORMAT = `You should only respond in JSON format as described below \nResponse Format: \n
${JSON.stringify(_DEFAULT_RESPONSE_FORMAT)}
\nEnsure the response can be parsed by JavaScript JSON.parse()`

const NEXT_PROMPT =
  'INSTRUCTIONS:\n' +
  '1 - Check the progress of your goals.\n' +
  '2 - If you have achieved all your goals, execute the "task_complete" command IMMEDIATELY. Otherwise,\n' +
  '3 - Use the command responses in previous system messages to plan your next command to work towards your goals\n' +
  '4 - Only use available commmands.\n' +
  '5 - Commands are expensive. Aim to complete tasks in the least number of steps.\n' +
  '6 - A command is considered executed only if it is confirmed by a system message.\n' +
  '7 - A command is not considered executed just becauses it was in your plan.\n' +
  '8 - Remember to use the output of previous command. If it contains useful information, save it to a file.\n' +
  '9 - Do not use commands to retrieve or analyze information you already have. Use your long term memory instead.\n' +
  '10 - Execute the "do_nothing" command ONLY if there is no other command to execute.\n' +
  '11 - Make sure to execute commands only with supported arguments.\n' +
  '12 - ONLY RESPOND IN THE FOLLOWING FORMAT: (MAKE SURE THAT IT CAN BE DECODED WITH JAVASCRIPT JSON.parse())\n' +
  JSON.stringify(JSON._DEFAULT_RESPONSE_FORMAT) +
  '\n'

const INIT_PROMPT =
  'Do the following:\n' +
  '1 - Execute the next best command to achieve the goals.\n' +
  '2 - Execute the "do_nothing" command if there is no other command to execute.\n' +
  '3 - ONLY RESPOND IN THE FOLLOWING FORMAT: (MAKE SURE THAT IT CAN BE DECODED WITH JAVACRIPT JSON.parse())\n' +
  JSON.stringify(_DEFAULT_RESPONSE_FORMAT) +
  '\n'

const AgentStates = {
  START: 'START',
  IDLE: 'IDLE',
  TOOL_STAGED: 'TOOL_STAGED',
  STOP: 'STOP',
}

class Agent {
  constructor({
    name = DEFAULT_AGENT_NAME,
    description = DEFAULT_AGENT_DESCRIPTION,
    goals = null,
    model = null,
    embedding_provider = null,
    temperature = 0.8,
  } = {}) {
    this.name = name
    this.description = description
    this.goals = goals || []
    this.model = model || 'gpt-3.5-turbo'
    this.embedding_provider =
      embedding_provider || new OpenAIEmbeddingProvider()
    this.temperature = temperature
    this.memory = new LocalMemory({
      embedding_provider: this.embedding_provider,
    })
    this.history = []
    this.init_prompt = INIT_PROMPT
    this.next_prompt = NEXT_PROMPT
    this.progress = []
    this.plan = []
    this.constraints = []
    this.state = AgentStates.START
  }

  _getNonUserMessages(n) {
    const msgs = this.history.filter((msg) => {
      return (
        msg.role !== 'user' &&
        !(msg.role === 'system' && msg.content.includes('do_nothing'))
      )
    })
    return msgs.slice(-n - 1, -1)
  }

  getFullPrompt(user_input = '') {
    const header = { role: 'system', content: this.headerPrompt() }
    const dtime = {
      role: 'system',
      content: `The current time and date is ${new Date().toLocaleString()}`,
    }
    const msgs = this._getNonUserMessages(10)
    const relevant_memory = this.memory.get(msgs.toString(), 5)
    const user_prompt = user_input
      ? [{ role: 'user', content: user_input }]
      : []
    const history = this.getCompressedHistory()

    const _msgs = () => {
      const msgs = [header, dtime]
      msgs.push(...history.slice(0, -1))
      if (relevant_memory.length) {
        const memstr = relevant_memory.join('\n')
        const context = {
          role: 'system',
          content: `You have the following items in your memory as a result of previously executed commands:\n${memstr}\n`,
        }
        msgs.push(context)
      }
      msgs.push(...history.slice(-1))
      msgs.push(...user_prompt)
      return msgs
    }

    const maxtokens = this.model.getTokenLimit() - 1000
    let ntokens = 0
    while (true) {
      const msgs = _msgs()
      ntokens += this.model.countTokens(msgs)
      if (ntokens < maxtokens) {
        break
      } else {
        if (history.length > 1) {
          history.shift()
        } else if (relevant_memory.length) {
          relevant_memory.shift()
        } else {
          break
        }
      }
    }

    return { full_prompt: _msgs(), token_count: ntokens }
  }

  getCompressedHistory() {
    let hist = this.history.slice()
    let system_msgs = hist.reduce((indices, msg, i) => {
      if (msg.role === 'system') {
        indices.push(i)
      }
      return indices
    }, [])
    let assist_msgs = hist.reduce((indices, msg, i) => {
      if (msg.role === 'assistant') {
        indices.push(i)
      }
      return indices
    }, [])
    assist_msgs.forEach((i) => {
      let entry = Object.assign({}, hist[i])
      try {
        let respd = JSON.parse(entry.content)
        let thoughts = respd.thoughts
        if (thoughts) {
          delete thoughts.reasoning
          delete thoughts.speak
          delete thoughts.text
          delete thoughts.plan
        }
        entry.content = JSON.stringify(respd, null, 2)
        hist[i] = entry
      } catch (e) {}
    })
    let user_msgs = hist.reduce((indices, msg, i) => {
      if (msg.role === 'user') {
        indices.push(i)
      }
      return indices
    }, [])
    hist = hist.filter((msg, i) => {
      return !user_msgs.includes(i)
    })
    return hist
  }

  getFullMessage(message) {
    if (this.state === AgentStates.START) {
      return `${this.init_prompt}\n\n${message || ''}`
    } else {
      return `${this.next_prompt}\n\n${message || ''}`
    }
  }

  async chat(message = null, run_tool = false) {
    if (this.state === AgentStates.STOP) {
      throw new Error(
        'This agent has completed its tasks. It will not accept any more messages. You can do `agent.clear_state()` to start over with the same goals.'
      )
    }

    message = this.getFullMessage(message)

    if (this.staging_tool) {
      const tool = this.staging_tool
      if (run_tool) {
        const output = await this.run_staging_tool()
        this.tool_response = output

        if (tool.name === 'task_complete') {
          this.history.push({
            role: 'system',
            content: 'Completed all user specified tasks.',
          })
          this.state = AgentStates.STOP
          return
        }

        if (tool.name !== 'do_nothing') {
          // TODO: We don't have enough space for this in GPT-3
          // this.memory.add(
          //   `Command "${tool.name}" with args ${tool.args} returned :\n ${output}`
          // );
        }
      } else {
        this.history.push({
          role: 'system',
          content: `User did not approve running ${tool.name || tool}.`,
        })
        // this.memory.add(
        //   `User disapproved running command "${tool.name}" with args ${tool.args} with following feedback\n: ${message}`
        // );
      }

      this.staging_tool = null
      this.staging_response = null
    }

    const { full_prompt, token_count } = this.getFullPrompt(message)
    const token_limit = await this.model.getTokenLimit()
    const max_tokens = Math.min(1000, Math.max(token_limit - token_count, 0))
    assert(max_tokens, {
      message: `Token limit of ${token_limit} exceeded`,
      token_count,
    })

    const resp = await this.model.chat(full_prompt, {
      max_tokens,
      temperature: this.temperature,
    })

    let parsedResp = resp.choices[0].message.content

    try {
      parsedResp = await this.loadJson(parsedResp)
      let plan = await parsedResp.thoughts.plan

      if (plan && Array.isArray(plan)) {
        if (
          plan.length === 0 ||
          (plan.length === 1 && plan[0].replace('-', '').length === 0)
        ) {
          this.staging_tool = { name: 'task_complete', args: {} }
          this.staging_response = parsedResp
          this.state = AgentStates.STOP
        }
      } else {
        if (typeof parsedResp === 'object') {
          if ('name' in parsedResp) {
            parsedResp = { command: parsedResp }
          }
          if (parsedResp.command) {
            this.staging_tool = parsedResp.command
            this.staging_response = parsedResp
            this.state = AgentStates.TOOL_STAGED
          } else {
            this.state = AgentStates.IDLE
          }
        } else {
          this.state = AgentStates.IDLE
        }
      }

      const progress = await parsedResp.thoughts?.progress
      if (progress) {
        if (typeof plan === 'string') {
          this.progress.push(progress)
        } else if (Array.isArray(progress)) {
          this.progress.push(...progress)
        }
      }

      this.plan = await parsedResp.thoughts?.plan
      if (plan) {
        if (typeof plan === 'string') {
          this.plan = [plan]
        } else if (Array.isArray(plan)) {
          this.plan = plan
        }
      }
    } catch {}

    this.history.push({ role: 'user', content: message })
    this.history.push({
      role: 'assistant',
      content:
        typeof parsedResp === 'object'
          ? JSON.stringify(parsedResp)
          : await parsedResp,
    })

    return await parsedResp
  }

  headerPrompt() {
    const prompt = []
    prompt.push(this.personaPrompt())
    // if (this.tools.length > 0) {
    //   prompt.push(this.toolsPrompt());
    // }
    if (this.goals.length > 0) {
      prompt.push(this.goalsPrompt())
    }
    if (this.constraints.length > 0) {
      prompt.push(this.constraintsPrompt())
    }
    if (this.plan.length > 0) {
      prompt.push(this.planPrompt())
    }
    if (this.progress.length > 0) {
      prompt.push(this.progressPrompt())
    }
    return prompt.join('\n') + '\n'
  }

  personaPrompt() {
    return `You are ${this.name}, ${this.description}.`
  }

  progressPrompt() {
    let prompt = []
    prompt.push('PROGRESS SO FAR:')
    for (let i = 0; i < this.progress.length; i++) {
      prompt.push(`${i + 1}. DONE - ${this.progress[i]}`)
    }
    return prompt.join('\n') + '\n'
  }

  planPrompt() {
    let plan = this.plan.join('\n')
    return `CURRENT PLAN:\n${plan}\n`
  }

  goalsPrompt() {
    let prompt = []
    prompt.push('GOALS:')
    for (let i = 0; i < this.goals.length; i++) {
      prompt.push(`${i + 1}. ${this.goals[i]}`)
    }
    return prompt.join('\n') + '\n'
  }

  constraintsPrompt() {
    let prompt = []
    prompt.push('CONSTRAINTS:')
    for (let i = 0; i < this.constraints.length; i++) {
      prompt.push(`${i + 1}. ${this.constraints[i]}`)
    }
    return prompt.join('\n') + '\n'
  }

  async loadJson(s, try_gpt = true) {
    try {
      if (s.includes('Result: {')) {
        s = s.split('Result: ')[0]
      }
      if (!s.includes('{') || !s.includes('}')) {
        throw new Error('Invalid JSON format')
      }

      try {
        return JSON.parse(s)
      } catch (error) {
        this.postError(error)

        s = s.substring(s.indexOf('{'), s.lastIndexOf('}') + 1)

        try {
          return JSON.parse(s)
        } catch (error) {
          this.postError(error)

          try {
            s = s.replace(/\n/g, ' ')
            return s
          } catch (error) {
            this.postError(error)

            try {
              return `${s}}`
            } catch (error) {
              // Retry with GPT extraction
              this.postError(error)
              if (try_gpt) {
                s = await extractJsonWithGpt(s)
                try {
                  return s
                } catch (error) {
                  this.postError(error)
                  return loadJson(s, false)
                }
              }
              throw new Error('Unable to parse JSON')
            }
          }
        }
      }
    } catch (error) {
      this.postError(error)
      throw error
    }
  }

  async extractJsonWithGpt(s) {
    self.postMessage({ extractJsonWithGpt: s })

    const func = `function convertToJson(response) {
      // Implement the logic to convert the given string to a JSON string
      // of the desired format
      // Ensure the result can be parsed by JSON.parse
      // Return the JSON string
    }`

    const desc = `Convert the given string to a JSON string of the form
  ${JSON.stringify(DEFAULT_RESPONSE_FORMAT_, null, 4)}
  Ensure the result can be parsed by JSON.parse.`

    const args = [s]

    const msgs = [
      {
        role: 'system',
        content: `You are now the following JavaScript function:\n\n${func}\n\nOnly respond with your 'return' value.`,
      },
      { role: 'user', content: args.join(', ') },
    ]

    const token_count = this.model.countTokens(message)
    const token_limit = await this.model.getTokenLimit()
    const max_tokens = Math.min(1000, Math.max(token_limit - token_count, 0))

    return this.model.chat({
      messages: msgs,
      temperature: 0.0,
      max_tokens,
    })
  }

  runStagingTool() {
    if (!this.staging_tool.hasOwnProperty('name')) {
      const resp = 'Command name not provided. Make sure to follow the specified response format.';
      this.history.push({
        role: 'system',
        content: resp,
      });
      return resp;
    }
  
    const toolId = this.staging_tool.name;
    const args = this.staging_tool.args || {};
  
    if (toolId === 'task_complete') {
      const resp = { success: true };
      this.history.push({
        role: 'system',
        content: `Command "${toolId}" with args ${JSON.stringify(args)} returned:\n${JSON.stringify(resp)}`,
      });
      return resp;
    }
  
    if (toolId === 'do_nothing') {
      const resp = { response: 'Nothing Done.' };
      this.history.push({
        role: 'system',
        content: `Command "${toolId}" with args ${JSON.stringify(args)} returned:\n${JSON.stringify(resp)}`,
      });
      return resp;
    }
  
    if (!this.staging_tool.hasOwnProperty('args')) {
      const resp = 'Command args not provided. Make sure to follow the specified response format.';
      this.history.push({
        role: 'system',
        content: resp,
      });
      return resp;
    }
  
    const kwargs = this.staging_tool.args;
    let found = false;

    if (this.tools && typeof this.tools === 'object') {
      for (const [k, tool] of Object.entries(this.tools)) {
        if (k === toolId) {
          found = true;
          break;
        }
      }
    }

    if (!found) {
      const resp = `Command "${toolId}" does not exist.`;
      this.history.push({
        role: 'system',
        content: resp,
      });
      return resp;
    }
  
    try {
      const tool = this.tools[toolId];
      const resp = tool.run(kwargs);
      this.history.push({
        role: 'system',
        content: `Command "${toolId}" with args ${JSON.stringify(args)} returned:\n${JSON.stringify(resp)}`,
      });
      return resp;
    } catch (e) {
      const resp = `Command "${toolId}" failed with error: ${e}`;
      this.history.push({
        role: 'system',
        content: resp,
      });
      return resp;
    }
  }
  
}

class LocalMemory {
  constructor(embeddingProvider) {
    this.docs = []
    this.embs = null
    this.embeddingProvider = embeddingProvider
  }

  add(doc, key = null) {
    if (!key) {
      key = doc
    }
    const emb = this.embeddingProvider(key)
    if (this.embs === null) {
      this.embs = [emb]
    } else {
      this.embs.push(emb)
    }
    this.docs.push(doc)
  }

  get(query, k) {
    if (this.embs === null) {
      return []
    }
    const emb = this.embeddingProvider(query)
    const scores = this.embs.map((e) =>
      e.reduce((acc, val, i) => acc + val * emb[i], 0)
    )
    const idxs = scores
      .map((score, i) => [i, score])
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map((pair) => pair[0])
    return idxs.map((i) => this.docs[i])
  }

  _serializeEmbs() {
    if (this.embs === null) {
      return null
    }
    return {
      dtype: this.embs[0].constructor.name,
      data: this.embs.map((arr) => Array.from(arr)),
      shape: [this.embs.length, this.embs[0].length],
    }
  }

  clear() {
    this.docs = []
    this.embs = null
  }
}

class OpenAIEmbeddingProvider {
  constructor(model = 'text-embedding-ada-002', apiKey = null) {
    this.model = model
    this.apiKey = apiKey
  }

  async get(text) {
    const url = 'https://api.openai.com/v1/embeddings'
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    }
    const body = JSON.stringify({
      input: text,
      model: this.model,
    })

    const response = await fetch(url, { method: 'POST', headers, body })
    if (!response.ok) {
      throw new Error(
        `Failed to get embeddings: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()
    return new Float32Array(data.data[0].embedding)
  }

  config() {
    return { model: this.model, apiKey: this.apiKey }
  }

  static fromConfig(config) {
    return new OpenAIEmbeddingProvider(config.model, config.apiKey)
  }
}

class OpenAIModel {
  constructor(model = 'gpt-3.5-turbo', apiKey = null) {
    this.model = model
    this.apiKey = apiKey
  }

  async chat(messages, maxTokens = null, temperature = 0.8) {
    const { max_tokens } = maxTokens
    this.max_tokens = maxTokens
    this.temperature = temperature

    const num_retries = 3

    for (let i = 0; i < num_retries; i++) {
      try {
        const apiKeyResponse = await fetch('/api/openai', {
          method: 'POST',
        })
        const { apiKey } = await apiKeyResponse.json()

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            max_tokens,
            temperature,
          }),
        })

        const data = await response.json()

        return data
      } catch (error) {
        if (error.statusCode === 429) {
          console.warn('Rate limit exceeded. Retrying after 20 seconds.')
          await new Promise((resolve) => setTimeout(resolve, 20000))
          if (i == num_retries - 1) {
            throw error
          }
        } else {
          throw error
        }
      }
    }
  }

  countTokens(messages) {
    // Can't get tiktoken to load with a web worker...
    // const [tokens_per_message, tokens_per_name] = {
    //   'gpt-3.5-turbo': [4, -1],
    //   'gpt-4': [3, -1],
    //   'gpt-4-32k': [3, -1],
    // }[this.model];
    // const enc = encoding_for_model(this.model);
    // let num_tokens = 0;
    // for (const message of messages) {
    //   num_tokens += tokens_per_message;
    //   for (const [key, value] of Object.entries(message)) {
    //     num_tokens += enc.encode(value).length;
    //     if (key === "name") {
    //       num_tokens += tokens_per_name;
    //     }
    //   }
    // }
    // num_tokens += 3;
    // return num_tokens;

    // oversimplied implementation
    const modelTokens = {
      'gpt-3.5-turbo': 4,
      'gpt-4': 3,
      'gpt-4-32k': 3,
    }[this.model]

    let numTokens = 0
    for (const message of messages) {
      numTokens += modelTokens
      for (const value of Object.values(message)) {
        numTokens += value.split(/\s+/).length
      }
      numTokens += 3 // Add tokens for start and end sequences
    }

    return numTokens
  }

  getTokenLimit() {
    return {
      'gpt-3.5-turbo': 4000,
      'gpt-4': 8000,
      'gpt-4-32k': 32000,
    }[this.model]
  }

  config() {
    return {
      model: this.model,
      apiKey: this.apiKey,
    }
  }

  static fromConfig(config) {
    return new OpenAIModel(config.model, config.apiKey)
  }

  async getOpenAiKey() {
    const response = await fetch('/api/openai', {
      method: 'POST',
    })
    const data = await response.json()
    const { apiKey } = data
    this.apiKey = apiKey
    return apiKey
  }
}

function assert(condition, message) {
  if (!condition) {
    postError({ name: 'Assertion error', message })
    throw new Error(JSON.stringify(message) || 'Assertion failed')
  }
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

function postState(agent) {
  self.postMessage({
    type: 'state',
    payload: {
      fromId: self.id,
      toId: 'all',
      content: agent,
    },
  })
}

const apiUrl = 'https://api.openai.com/v1/chat/completions'

// Create a new instance of the Agent class
const agent = new Agent({
  model: new OpenAIModel('gpt-3.5-turbo'),
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

const initWorker = async () => {
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
        postState(agent)
        break

      case 'chat':
        startChat()
        break

      case 'runTool':
        postMessage('message', 'Running staged tool...')
        const response = await agent.chat({run_tool: true})
        postState(agent)
        postMessage('response', response)
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

    async function startChat() {
      postMessage('message', 'Initiating chat...')
      const response = await agent.chat(payload)
      postState(agent)
      postMessage('response', response)
      return response
    }
  }
}

initWorker()
