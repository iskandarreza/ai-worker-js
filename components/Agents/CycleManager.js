import { completePrompt } from './modelCompletion'
import { TokenManager } from './TokenManager'
import { ConversationManager } from './ConversationManager'
import {
  retrieveArrayFromLocalStorage,
  storeArrayInLocalStorage,
} from './shared'

// TODO: This class is still complicated, figure out how to simplify it and/or decompose into different domains
export class CycleManager {
  constructor(promptProvider, tools, maxCycles) {
    const tokenManager = new TokenManager()
    const conversationManager = new ConversationManager(promptProvider)
    const conversationSummarizer = conversationManager.summarize


    this.cycle = 0
    this.maxCycles = maxCycles || 18
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
        toolResponse = `Task completed in ${this.cycle} cycles.`
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
          toolResponse = `Tool "${toolname}" is not available. Currently available tools are:\n${toolsInfo.trim()}`
        }
      }

      // TODO: Let CnversationManager build this message
      let toolResponseStr
      if (typeof toolResponse === 'string' || toolResponse instanceof String) {
        toolResponseStr = toolResponse
      } else {
        toolResponseStr = JSON.stringify(toolResponse)
      }

      const toolResponseMessage = {
        role: 'system',
        content: `${toolname} tool results:\n${toolResponseStr.trim()}`,
      }

      const tokenUsage = await tokenManager.countTokens(
        JSON.stringify(toolResponseMessage)
      )
      await tokenManager.updateTokenUsage('actionResults', tokenUsage)
      console.log({ tokenUsage: tokenManager.tokenUsage, cycle: this.cycle })

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
      const userInitMsg = promptProvider.header.user.initMsg
      // Resume last actions from last run if data is saved
      let messages = retrieveArrayFromLocalStorage('messageHistory')

      if (messages) {
        // remove old instructions
        // messages = conversationManager.clearUserMessages(messages)
        messages = ConversationManager.clearUserMessages(messages)


        console.info(
          `Resuming from last conversation. Tokens left: ${await tokenManager.tokenBalance(
            messages
          )}`
        )
        return this.continueCycle(messages, 0, 0.1)

      } else {
        // Move to ConversationManager?
        const headers = promptProvider.header.system
        const { persona, goals, tools } = headers
        messages = [
          {
            role: 'system',
            content: `${persona()}\n${goals()}\n${tools()}`,
          },
          {
            role: 'user',
            content: userInitMsg(),
          },
        ]
      }

      try {
        // Maybe move to ConversationManager?
        const isWithinLimit = await tokenManager.isWithinLimit('messages', messages)
        let tokenBalance = await tokenManager.tokenBalance(messages)

        if (!isWithinLimit) {
          const summarizedHeader =
            await conversationSummarizer(messages, tokenBalance)

          messages = summarizedHeader

          messages.push({
            role: 'user',
            content: userInitMsg(),
          })
        }

        const startTokens = await tokenManager.countTokens(
          JSON.stringify(messages)
        )
        await tokenManager.updateTokenUsage('messages', startTokens)
        // TODO: tokenBalance should be updated automatically everytime updateTokenUsage is called
        tokenBalance = await tokenManager.tokenBalance(messages)
        console.log({ tokenUsage: tokenManager.tokenUsage })

        console.info(
          `Starting cycle with ${tokenBalance} tokens left`
        )

        const startResponse = await this.getResponse({ messages, temperature })
        const responseObj = JSON.parse(startResponse)
        const thoughts = !!responseObj.thoughts
          ? responseObj.thoughts
          : undefined
        const command = !!responseObj.command ? responseObj.command : undefined

        return {
          messages,
          thoughts,
          command,
        }
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
      let messages = await ConversationManager.clearUserMessages(_messages)

      // Check if messages token count is greater than limit for next responses
      const tokenBalance = await tokenManager.tokenBalance(messages)
      const isWithinLimit = await tokenManager.isWithinLimit('messages', messages)
      console.info(`Tokens left: ${tokenBalance}, is within limit: ${isWithinLimit}`)

      if (!isWithinLimit) {
        messages = await new ConversationManager(promptProvider).summarize(messages, tokenBalance)
        console.info(
          `New context token count: ${await tokenManager.countTokens(
            JSON.stringify(messages)
          )}`
        )
      }

      console.debug(`Cycle ${this.cycle} messages:`, { messages })

      const nextUserMessage = promptProvider.nextPrompt.user

      // Potentially move to ConversationManager
      let nextPrompt = {
        role: 'user',
        content: nextUserMessage(),
      }
      const finalTokenCount = await tokenManager.countTokens(
        JSON.stringify([...messages, nextPrompt])
      )

      let cycleTokens

      // Untangle and move to TokenManager and ConversationManager?
      if (finalTokenCount <= tokenManager.limits.global + 500) {
        messages.push(nextPrompt)

        cycleTokens = await tokenManager.countTokens(JSON.stringify(messages))
        await tokenManager.updateTokenUsage('messages', cycleTokens)
      } else if (finalTokenCount <= tokenManager.limits.global) {
        // send just the expected response format if the usual nextPrompt will break the bank
        nextPrompt.content = nextUserMessage(true)
        messages.push(nextPrompt)

        cycleTokens = await tokenManager.countTokens(JSON.stringify(messages))
        await tokenManager.updateTokenUsage('messages', cycleTokens)
      } else {
        // oh well we tried
        storeArrayInLocalStorage('messageHistory', messages) // we can try again?
        cycleTokens = await tokenManager.countTokens(JSON.stringify(messages))
        await tokenManager.updateTokenUsage('messages', cycleTokens)
        console.log({ tokenUsage: tokenManager.tokenUsage, cycle: this.cycle })

        throw Error('Max tokens')
      }

      console.log({ tokenUsage: tokenManager.tokenUsage, cycle: this.cycle })

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
    this.getResponse = async ({ messages, temperature }) => {
      function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
      }

      const maxRetryCount = 3
      let retryCount = 0

      while (retryCount < maxRetryCount) {
        const response = await completePrompt({
          messages: messages,
          max_tokens: 1000,
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

        tokenManager.resetUsage()

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
