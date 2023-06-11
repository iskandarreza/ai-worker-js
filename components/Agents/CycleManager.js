import { completePrompt } from './modelCompletion'
import { TokenManager } from './TokenManager'
import { ConversationManager } from './ConversationManager'
import {
  retrieveArrayFromLocalStorage,
  storeArrayInLocalStorage,
} from './shared'

// TODO: This class is still complicated, figure out how to simplify it and/or decompose into different domains
export class CycleManager {
  constructor(goals, tools, maxCycles) {
    this.tokenManager = new TokenManager()
    const conversationManager = new ConversationManager(goals, tools, this.tokenManager)


    this.cycle = 0
    this.maxCycles = maxCycles || 1
    this.toolResponses = [] // saving the responses, maybe implement some way to use this to track progress 
    this.incrementCycle = () => {
      this.cycle++
    }
    this.thoughtCycle = async (thoughts) => {
      // TODO: Explore ways to optimize these in terms of storage and retrieval, and ultimately token economy
      const { plan, reasoning, progress } = thoughts

      Object.keys({ plan, reasoning, progress }).forEach((key) => {
        console.info(`${key}:`, JSON.stringify(thoughts[key], null, 4))
      })

      return {
        plan,
        reasoning,
        progress,
      }
    }
    /* `actionCycle` is a method of the `CycleManager` class that runs system commands. It takes
    in a `command` object as a parameter, which contains the name of the tool to be run and any
    arguments that need to be passed to it. */
    this.actionCycle = async (command) => {
      // run system commands
      let { name: toolname, args } = command
      let toolResponse

      if (toolname === 'taskComplete') {
        toolResponse = `Task completed in ${this.cycle + 1} cycle${this.cycle === 0 ? '' : 's'}.`
      } else if (toolname === 'doNothing') {
        toolResponse = 'Nothing done. '
      } else {
        // run staged tool
        if (tools.hasOwnProperty(toolname)) {
          try {
            args = JSON.parse(args)
          } catch (error) {
            // pass
          }
          try {
            toolResponse = await tools[toolname].run(args)
          } catch (error) {
            console.error(error)
          }
        } else {
          toolResponse = `Tool "${toolname}" is not available. ${conversationManager.promptProvider.header.system.tools(tools).trim()}`
        }
      }

      this.toolResponses.push({ cycle: this.cycle, toolname, toolResponse })
      console.log({ toolResponses: this.toolResponses })
      const toolResponseMessage = await conversationManager.generateToolResponseMsg(toolname, toolResponse)

      return {
        toolname,
        args,
        toolResponseMessage,
      }
    }
    /* The code defines an asynchronous function called `initCycle` that initializes a
    conversation cycle with a chatbot. It first checks if there is any saved conversation
    history in the local storage and resumes the conversation from where it was left off. If
    there is no saved history, it starts a new conversation by displaying some system headers
    and prompting the user for an initial message. It then checks if the number of tokens
    required for the conversation is within the limit and summarizes the conversation if
    necessary. It then counts the number of tokens required for the conversation and updates
    the token usage. Finally, it sends the initial message */
    this.initCycle = async (temperature) => {
      // Resume last actions from last run if data is saved
      let messages = retrieveArrayFromLocalStorage('messageHistory')

      if (messages) {
        // remove old instructions
        messages = ConversationManager.clearUserMessages(messages)

        this.tokenManager.updateTokenUsage('messages', await this.tokenManager.countTokens(JSON.stringify(messages)))

        console.info(
          `Resuming from last conversation. Tokens left: ${this.tokenManager.tokenBalance(
            messages
          )}`
        )
        return this.continueCycle(messages, 0, 0.1)

      } else {
        messages = await conversationManager.generateSubTaskPrompt()
        // messages = await conversationManager.newConversation()
      }

      try {
        const startTokens = await this.tokenManager.countTokens(
          JSON.stringify(messages)
        )
        await this.tokenManager.updateTokenUsage('messages', startTokens)
        let tokenBalance = this.tokenManager.tokenBalance()

        console.info(
          `Starting cycle with ${tokenBalance} tokens left`
        )

        const startResponse = await this.getResponse({ messages, temperature, maxTokens: tokenBalance })
        const responseObj = JSON.parse(startResponse)

        return {
          messages,
          taskArray: responseObj
        }

        // const thoughts = !!responseObj.thoughts
        //   ? responseObj.thoughts
        //   : undefined
        // const command = !!responseObj.command ? responseObj.command : undefined

        // return {
        //   messages,
        //   thoughts,
        //   command,
        // }
      } catch (error) {
        console.error(error)
      }
    }
    /* The code defines a function `continueCycle` that takes in three parameters:
    `_messages`, `cycle`, and `temperature`. It filters out previous instructions to reduce
    token cost, summarizes the conversation, and checks if the messages token count is greater
    than the limit for the next responses. If it is within the limit, it updates the token
    usage and triggers the next cycle to get a response. If it is not within the limit, it
    throws an error. */
    this.continueCycle = async (_messages, temperature) => {
      // Filter out previous instructions to reduce token cost, we'll reinsert later at the end to keep it fresh
      let messages = await conversationManager.continueConversation(_messages)
      console.debug(`Cycle ${this.cycle} messages:`, { messages })

      // trigger next cycle
      try {
        const nextResponse = await this.getResponse({ messages, temperature })

        return {
          messages,
          response: JSON.parse(nextResponse),
        }
      } catch (error) {
        console.error(error)
        storeArrayInLocalStorage('messageHistory', messages)
        throw Error(error.message)
      }
    }
    /* The code defines a function `getResponse` that takes in an object with `messages` and
    `temperature` properties as parameters. The function uses a `while` loop to make a request
    to an API using the `completePrompt` function and waits for a response. If the response
    status is 429 (Too Many Requests), the function waits for 10 seconds and retries the
    request up to a maximum of 3 times. If the retry limit is exceeded, the function returns
    the last response. */
    this.getResponse = async ({ messages, temperature, maxTokens }) => {
      function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
      }

      const maxRetryCount = 3
      let retryCount = 0

      while (retryCount < maxRetryCount) {
        const response = await completePrompt({
          messages: messages,
          max_tokens: maxTokens || 1000,
          temperature: temperature,
        })

        if (response.status === 429) {
          retryCount++
          await sleep(10000)
        } else {
          return response
        }
      }

      // Retry limit exceeded, return the last response
      return response
    }
    /* The above code defines a function called `startCycle` which takes in a base temperature and
    a callback function as parameters. The function initializes a cycle with the given base
    temperature and then enters a loop where it continues the cycle until a maximum number of
    cycles is reached. During each cycle, the function checks for any system commands to run
    and executes them if necessary. It also increments the cycle count and continues the cycle
    with the updated temperature. The function logs messages and tool response messages during
    each cycle and calls the callback function with the response object. If the maximum number
    of cycles is reached, the function saves the conversation history for another run. */
    this.startCycle = async (baseTemperature, callback) => {
      let response
      let messages
      let toolResponseMessage = ''
      let temperature = parseFloat(baseTemperature)

      try {
        const startResponse = await this.initCycle(baseTemperature)
        console.log({ startResponse })

        response = {
          thoughts: startResponse.thoughts,
          command: startResponse.command,
        }
        messages = startResponse.messages

        !!callback && callback(startResponse)
      } catch (error) {
        console.error(error)
      }

      while (response) {
        let responseMessage = {
          role: 'assistant',
          content: JSON.stringify(response),
        }
        messages.push(responseMessage)

        if (response.thoughts) {
          await this.thoughtCycle(response.thoughts)
        }

        // run system commands
        if (response.command?.name) {
          const actionResults = await this.actionCycle(
            response.command,
            this.cycle
          )

          if (actionResults.toolname === 'taskComplete') {
            console.info(actionResults.toolResponseMessage.content)
            break
          } else {
            toolResponseMessage = actionResults.toolResponseMessage
            messages.push(toolResponseMessage)
            console.debug({ toolResponseMessage })
          }
        }

        this.incrementCycle()

        if (this.cycle <= this.maxCycles) {
          const nextResponse = await this.continueCycle(
            messages,
            temperature
          )
          response = nextResponse.response
          messages = nextResponse.messages

          !!callback && callback(response)
        } else {
          console.error('Max cycles reached')
          // Save history to resume later
          storeArrayInLocalStorage('messageHistory', messages)
          response = false
          break
        }
      }
    }

    return {
      startCycle: this.startCycle,
    }
  }

}
