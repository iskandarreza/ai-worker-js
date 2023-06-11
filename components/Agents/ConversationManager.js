import { TokenManager } from './TokenManager'
import { summarizeText } from './modelCompletion'
import { DEFAULT_RESPONSE_FORMAT, INIT_PROMPT, NEXT_PROMPT } from './prompts'
import { storeArrayInLocalStorage } from './shared'

export class ConversationManager {
  constructor(goals, tools, tokenManager) {
    this.tokenManager = tokenManager || new TokenManager()
    this.tokenLimit = this.tokenManager.limits.global || 4000
    this.promptProvider = {
      header: {
        system: {
          persona: (
            name = 'Looper Generalized Autonomous Agent',
            description = `a prototypical autonomous self-prompting, LLM AI assistant agent that reponds only in JSON, who seeks ways to improve it's capabilities while operating in the limiting environment of a webworker thread.`
          ) =>
            `You are ${name}, ${description}.\nThe current time and date is ${new Date().toLocaleString()}`,
          goals: (strArr = goals) =>
            `GOALS:\n${strArr.map((goal, i) => `${i + 1}. ${goal}`).join('\n')}`,
          tools: (toolsArr = tools) => `You have access to the following tools:\n${Object.keys(
            toolsArr
          )
            .map((toolname) => {
              const { description, args } = toolsArr[toolname]
              return `${toolname}: ${description} - args: ${args}`
            })
            .join('\n')}`,
        },
        user: {
          initMsg: (initMsg = INIT_PROMPT, specificInput = '') =>
            `${initMsg}${specificInput ? `${specificInput}\n` : ''}`,
        },
      },
      nextPrompt: {
        system: () => { throw Error('Not implemented') },
        user: (
          compact = false,
          str = NEXT_PROMPT,
          responseFormat = DEFAULT_RESPONSE_FORMAT
        ) => (compact ? responseFormat : str),
      },
    }
    // a more reliable method of recordkeeping than asking the LLM to send a report
    this.summmaries = []
  }


  async generateToolResponseMsg(toolname, toolResponse) {
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

    const tokenUsage = await this.tokenManager.countTokens(
      JSON.stringify(toolResponseMessage)
    )
    await this.tokenManager.updateTokenUsage('actionResults', tokenUsage)
    console.log({ tokenUsage: this.tokenManager.tokenUsage })
    return toolResponseMessage
  }

  // TODO: create a dynamic summary response where max_tokens depends on the value of tokenBalance
  summarize = async (messages, tokenBalance) => {
    console.info('Summarizing conversation...')
    let dataStore = {}
    dataStore.messages = [...messages]
    const summaryResponse = async (messages, temperature = 0, maxTokens) => {
      const response = await summarizeText({
        model: 'text-davinci-003',
        prompt: messages,
        max_tokens: maxTokens,
        temperature: temperature,
      })
      return response
    }

    const hasSummaryMessage = JSON.stringify(messages).includes(
      'Previous conversation history summarized'
    )
    const headers = this.promptProvider.header.system
    const { persona, goals } = headers

    const reconstructedMessages = hasSummaryMessage
      ? [
        {
          role: 'system',
          content: `${persona()}\n${goals()}`,
        },
        ...messages.filter(
          (_, _i) =>
            !_.content.includes('Previous conversation history summarized')
        ),
      ]
      : [...messages]


    function parseAssistantResponse(str) {
      try {
        const responseObj = JSON.parse(str)
        const { thoughts, command } = responseObj
        console.log({ thoughts })
        return Object.keys(thoughts).map((key) => {
          return `${key} - ${thoughts[key]}`
        }).join('\n')
      } catch (error) {
        console.error(error.message)
        return null
      }
    }

    const summaryRequestMsg = `Please summarize this conversation for me:\n${reconstructedMessages
      .map(
        (msg) =>
          `${msg.role}: ${msg.role !== 'assistant'
            ? `${msg.content.trim()}`
            : `${typeof parseAssistantResponse(msg.content) !== null ? parseAssistantResponse(msg.content) : ''}`
          }\n`
      )
      .join(
        '--\n'
      )}\n--\nReturn summary in markdown format with the following sections:\nImportant Details and Results:\n- Include key findings from the research and data collection phases.\n- Highlight important commands executed and their results.\n\nKey Highlights:\n- Summarize the main points of the conversation in bullet points.\n- Focus on relevant information and filter out redundant exchanges.\n\nAdditional Context:\n- Provide any relevant links or references mentioned during the conversation.\n\nPlease ensure the summary accurately captures the essential aspects of the task and includes details that are crucial for understanding the context and progress.\n\nThank you!`

    const summaryRequestTokens = await this.tokenManager.countTokens(JSON.stringify(summaryRequestMsg))
    console.log({ summaryRequestTokens })
    const maxTokens = 800 // Need to figure out a formula to make this adaptive and dynamic

    let conversationSummary
    try {
      let temperature = summaryRequestMsg.includes(
        'Previous conversation history summarized'
      )
        ? 0.2
        : 0
      conversationSummary = await summaryResponse(
        summaryRequestMsg,
        temperature,
        maxTokens
      )
    } catch (error) {
      console.error(error)
      storeArrayInLocalStorage('messageHistory', messages)
      throw Error(error.message)
    }

    const summaryMsg = {
      role: 'system',
      content: `${persona()}\n${goals()}\nPrevious conversation history summarized:\n${conversationSummary
        .toString()
        .trim()}`,
    }

    messages = [summaryMsg]

    const summarizedTokenCount = await this.tokenManager.countTokens(JSON.stringify(messages))
    this.tokenManager.resetUsage()
    await this.tokenManager.updateTokenUsage('summarized', summarizedTokenCount)
    console.log({ summarizedTokenCount, tokenUsage: this.tokenManager.tokenUsage })

    dataStore.summary = conversationSummary
    this.summmaries.push(dataStore)
    console.log({ summmaries: this.summmaries })
    return messages
  }

  newConversation = async () => {
    const headers = this.promptProvider.header.system
    const userInitMsg = this.promptProvider.header.user.initMsg
    const { persona, goals, tools } = headers
    let messages = [
      {
        role: 'system',
        content: `${persona()}\n${goals()}\n${tools()}`,
      },
    ]

    await this.tokenManager.updateTokenUsage('messages', await this.tokenManager.countTokens(JSON.stringify(messages)))
    const isWithinLimit = await this.tokenManager.isWithinLimit('messages', messages)

    if (!isWithinLimit) {
      const summarizedHeader =
        await this.summarize(messages, this.tokenManager.tokenBalance())

      messages = summarizedHeader

    }

    messages.push({
      role: 'user',
      content: userInitMsg(),
    })

    await this.tokenManager.updateTokenUsage('messages', await this.tokenManager.countTokens(JSON.stringify(messages)))

    console.log({ tokenBalance: this.tokenManager.tokenBalance(), tokenUsage: this.tokenManager.tokenUsage })
    return messages
  }

  async generateSubTaskPrompt() {
    const headers = this.promptProvider.header.system
    const { goals, tools } = headers

    let subTaskPromptMessages = []
    let subTaskSystemPrompt = [
      'You are part of a larger system of self-instructing LLM agents tasked with a main goal to achieve.',
      'Your role is that of a task analyzer agent that breaks down goals into subtask for other agents.',
      'Each subtask can only have one action/tool/command.'

    ]
    const subTaskSystemMsg = {
      role: 'system',
      content: `${subTaskSystemPrompt.join('\n')}\n${tools()}\n${goals()}` // list of tools available (command, args), list of goals set (array of strings)
    }
    const typedef = `/**
    * @typedef {Object} SubTaskItem
    * @property {string} taskId - Unique identifier for the task
    * @property {string} action - Command name
    * @property {Object} args - Arguments for the command (key-value pairs)
    * @property {string} reason - The reason for this subtask
    * @property {string} request - The expected result
    * @property {Array<string|null>} dependencies - array of taskId that needs to be completed, if any
    */`

    const subTaskUserMsg = {
      role: 'user',
      content: `Respond only with a JSON array of subtask objects with the following type definition with no additional commentary:\n${typedef}`
    }

    subTaskPromptMessages.push(subTaskSystemMsg)
    subTaskPromptMessages.push(subTaskUserMsg)

    return subTaskPromptMessages
  }

  async continueConversation(_messages) {
    let messages = await ConversationManager.clearUserMessages(_messages)

    // Check if messages token count is greater than limit for next responses
    await this.tokenManager.updateTokenUsage('messages', await this.tokenManager.countTokens(JSON.stringify(messages)))
    const tokenBalance = this.tokenManager.tokenBalance()
    const isWithinLimit = await this.tokenManager.isWithinLimit('messages', messages)
    console.info(`Tokens left: ${tokenBalance}, is within limit: ${isWithinLimit}`)

    if (!isWithinLimit) {
      messages = await this.summarize(messages, tokenBalance)
      console.info(
        `New context token count: ${await this.tokenManager.countTokens(
          JSON.stringify(messages)
        )}`
      )
    }

    const nextUserMessage = this.promptProvider.nextPrompt.user

    // Potentially move to ConversationManager
    let nextPrompt = {
      role: 'user',
      content: nextUserMessage(),
    }
    const finalTokenCount = await this.tokenManager.countTokens(
      JSON.stringify([...messages, nextPrompt])
    )

    this.tokenManager.resetUsage()

    let cycleTokens

    // Untangle and move to TokenManager and ConversationManager?
    if (finalTokenCount <= this.tokenManager.limits.global + 500) {
      messages.push(nextPrompt)

      cycleTokens = await this.tokenManager.countTokens(JSON.stringify(messages))
      await this.tokenManager.updateTokenUsage('messages', cycleTokens)
    } else if (finalTokenCount <= this.tokenManager.limits.global) {
      // send just the expected response format if the usual nextPrompt will break the bank
      nextPrompt.content = nextUserMessage(true)
      messages.push(nextPrompt)

      cycleTokens = await this.tokenManager.countTokens(JSON.stringify(messages))
      await this.tokenManager.updateTokenUsage('messages', cycleTokens)
    } else {
      // oh well we tried
      storeArrayInLocalStorage('messageHistory', messages) // we can try again?
      cycleTokens = await this.tokenManager.countTokens(JSON.stringify(messages))
      await this.tokenManager.updateTokenUsage('messages', cycleTokens)
      console.log({ tokenUsage: this.tokenManager.tokenUsage, cycle: this.cycle })

      throw Error('Max tokens')
    }
    return messages
  }

  static clearUserMessages = (messages) =>
    messages.filter((msg) => msg.role !== 'user')
}
