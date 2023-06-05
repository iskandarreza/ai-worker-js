import { TokenManager } from './TokenManager'
import { summarizeText } from './modelCompletion'
import { storeArrayInLocalStorage } from './shared'

// Notes: Consider rolling promptProvider object into this class
export class ConversationManager {
  constructor(promptProvider, tokenManager) {
    this.tokenManager = tokenManager || new TokenManager()
    this.tokenLimit = this.tokenManager.limits.global || 4000
    this.promptProvider = promptProvider
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
    const summaryResponse = async (messages, temperature = 0, maxTokens) => {
      const response = await summarizeText({
        model: 'text-davinci-003',
        prompt: messages,
        max_tokens: maxTokens,
        temperature: temperature,
      })
      return response
    }

    let toolResponseMessage = messages.find((msg) =>
      msg.content.includes('tool results:')
    )
    const toolResponseTokens = await this.tokenManager.countTokens(JSON.stringify(toolResponseMessage))

    if (toolResponseTokens > this.tokenManager.limits.actionResults) {
      // handle situation
      console.debug('tool response over limit', { toolResponseTokens })
    }

    const toolSummarySeparator = '\n\nThe last tool/action executed produced the following response:\n';
    toolResponseMessage.content = toolResponseMessage.content.includes(toolSummarySeparator)
      ? toolResponseMessage.content.split(toolSummarySeparator)[1]
      : toolResponseMessage.content;

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

    const summaryRequestMsg = `Please summarize this conversation for me:\n${reconstructedMessages
      .map(
        (msg) =>
          `${msg.role}: ${msg.role !== 'assistant'
            ? `${msg.content.trim()}`
            : `${(JSON.stringify(msg.content), null, 2)}`
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

    const toolsSummaryPrompt = {
      role: 'system',
      content: `${headers.tools()}${toolResponseMessage
        ? `\n\nThe last tool/action executed produced the folowing response:\n${toolResponseMessage.content}`
        : ''
        }`,
    }
    messages = [summaryMsg, toolsSummaryPrompt]

    const summarizedTokenCount = await this.tokenManager.countTokens(JSON.stringify(messages))
    this.tokenManager.resetUsage()
    await this.tokenManager.updateTokenUsage('summarized', summarizedTokenCount)
    console.log({ summarizedTokenCount, tokenUsage: this.tokenManager.tokenUsage })
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
