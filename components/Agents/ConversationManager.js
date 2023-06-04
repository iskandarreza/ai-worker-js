import { summarizeText } from './modelCompletion'
import { storeArrayInLocalStorage } from './shared'

export class ConversationManager {
  constructor(promptProvider) {
    this.clearUserMessages = (messages) =>
      messages.filter((msg) => msg.role !== 'user')

    this.summarizeConversation = async (messages, tokenBalance) => {
      console.info('Summarizing conversation...')
      const summaryResponse = async (messages, temperature = 0) => {
        // const tokenBalance = await tokenManager.tokenBalance(messages)
        const response = await summarizeText({
          model: 'text-davinci-003',
          prompt: messages,
          max_tokens: tokenBalance < 500 ? 500 : tokenBalance,
          temperature: temperature,
        })
        return response
      }

      const toolResponseMessage = messages.find((msg) =>
        msg.content.includes('tool results:')
      )
      const hasSummaryMessage = JSON.stringify(messages).includes(
        'Previous conversation history summarized'
      )
      const headers = promptProvider.header.system
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
            `${msg.role}: ${
              msg.role !== 'assistant'
                ? `${msg.content.trim()}`
                : `${(JSON.stringify(msg.content), null, 2)}`
            }\n`
        )
        .join(
          '--\n'
        )}\n--\nReturn summary in markdown format with the following sections:\nImportant Details and Results:\n- Include key findings from the research and data collection phases.\n- Highlight important commands executed and their results.\n\nKey Highlights:\n- Summarize the main points of the conversation in bullet points.\n- Focus on relevant information and filter out redundant exchanges.\n\nAdditional Context:\n- Provide any relevant links or references mentioned during the conversation.\n\nPlease ensure the summary accurately captures the essential aspects of the task and includes details that are crucial for understanding the context and progress.\n\nThank you!`

      let conversationSummary
      try {
        let temperature = summaryRequestMsg.includes(
          'Previous conversation history summarized'
        )
          ? 0.2
          : 0
        conversationSummary = await summaryResponse(
          summaryRequestMsg,
          temperature
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
        content: `${toolsInfo}${
          toolResponseMessage
            ? `\n\nThe last tool/action executed produced the folowing response:\n${toolResponseMessage.content}`
            : ''
        }`,
      }
      messages = [summaryMsg, toolsSummaryPrompt]
      return messages
    }

    return {
      clearUserMessages: this.clearUserMessages,
      summarizeConversation: this.summarizeConversation,
    }
  }
}
