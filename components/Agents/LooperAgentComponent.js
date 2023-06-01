import { DEFAULT_RESPONSE_FORMAT, INIT_PROMPT, NEXT_PROMPT } from './prompts'
import { Button } from '@mui/material'
import { useState } from 'react'
import { DynamicReactJson } from '../DynamicReactJson'
import { getSystemWorkers } from '../../utils/getSystemWorkers'
import { completePrompt, summarizeText } from './modelCompletion'
import { sendReport, webScraperWorker, webSearchWorker } from './tools'

// Basic flow:
// 1. Header prompt, role: 'system' is created from user input - name, description, goals, current date and time, tools available
// 2. Init prompt, role: 'user' is inserted from template, contains instructions on what kind of answer to give and what the output format should look like
// 3. Header and init prompt sent together to 'gpt-3.5-turbo' chat completion API in 'messages' array
// 4. Response received from API, 99% of the time in the correct format (JSON), added to the messages array
// 5. Response JSON parsed, 'response.command' contains the name of the next action to take and the command arguments, this is evaluated with the appropriate 'tool'
// 6. Token count of entire messages array is checked, if there is not enough tokens left to add tool response and next user prompt,
//    messages after the header and init prompts will be sent to `text-davinci-003` completion API for summarization
// 7. Summary is packaged as 'system' prompt and inserted into messages array
// 8. Tool response is packaged into a 'system' prompt and added to the messages array
// 9. Next prompt is inserted as 'user' prompt from template into messages array
// 10. Check we have not exceeded the cycle count, send new message array as updated context to chat completion
//
// Weakest link here is the summarization, some details may be lost, but better than no details passed to the next cycle.
// Other caveats: Web Search and Web Scraping eats up tokens fast. Typically can't hold more than 5-8 search results or a 1000 token chunk of scraped data
// retrived from a vector store via semantic search, without needing to run a summarization, which sometimes removes the search result links.
//
// For a 4000 token context window, all this translates to:
// * 1000-1500 tokens for header, init and next prompts, non-negotiable
// * 1000-1500 tokens for extra context i.e. search results or external docs/site data
// * Balance of 1000-2000 tokens to share between message history (summarized or otherwise) and completion response

export function LooperAgentComponent() {
  const [lastResponse, setLastResponse] = useState('')
  const goals = [
    'Find out what github projects and other research has been done in the multi agent LLM space.',
    'Generate a report to send to the user in markdown.',
  ]

  const tools = {
    webSearchWorker: webSearchWorker, // typically 100 tokens per result
    webScraperWorker: webScraperWorker,
    sendReport: sendReport,
  }

  const toolsInfo = `You have access to the following tools:\n${Object.keys(
    tools
  )
    .map((toolname) => {
      const { description, args } = tools[toolname]
      return `${toolname}: ${description} - args: ${args}`
    })
    .join('\n')}`

  const tokenManager = new (function () {
    this.limits = {
      global: 3800,
      messages: 1200,
      actionResults: 1000,
    }
    this.countTokens = async (text) => {
      const systemWorkers = await getSystemWorkers()
      const tokenCounter = systemWorkers.find(
        (worker) => worker.name === 'token-counter'
      )
      const tokenCount = await tokenCounter.comlink.countTokens(text)

      return tokenCount
    }
    this.tokenBalance = async (messages) => {
      return (
        this.limits.global - (await this.countTokens(JSON.stringify(messages)))
      )
    }
    this.isWithinLimit = async (type, data) => {
      switch (type) {
        case 'messages':
          return (
            this.limits.global -
              (await this.countTokens(JSON.stringify(data))) >
            this.limits.messages
          )

        default:
          break
      }
    }
    return {
      limits: this.limits,
      countTokens: this.countTokens,
      tokenBalance: this.tokenBalance,
      isWithinLimit: this.isWithinLimit,
    }
  })()

  const promptProvider = {
    header: {
      system: {
        persona: (
          name = 'Looper Generalized Autonomous Agent',
          description = `a prototypical autonomous self-prompting, LLM AI assistant agent that reponds only in JSON, who seeks ways to improve it's capabilities while operating in the limiting environment of a webworker thread.`
        ) =>
          `You are ${name}, ${description}.\nThe current time and date is ${new Date().toLocaleString()}`,
        goals: (strArr = goals) =>
          `GOALS:\n${strArr.map((goal, i) => `${i + 1}. ${goal}`).join('\n')}`,
        tools: (str = toolsInfo) => str,
      },
      user: {
        initMsg: (initMsg = INIT_PROMPT, specificInput = '') =>
          `${initMsg}${specificInput ? `${specificInput}\n` : ''}`,
      },
    },
    nextPrompt: {
      user: (
        compact = false,
        str = NEXT_PROMPT,
        responseFormat = DEFAULT_RESPONSE_FORMAT
      ) => (compact ? responseFormat : str),
    },
  }

  const cycleManager = new (function () {
    this.maxCycles = 18
    this.thoughtCycle = async (thoughts, cycle) => {
      // TODO: Explore ways to optimize these in terms of storage and retrieval, and ultimately token economy
      const { plan, reasoning, progress } = thoughts

      Object.keys({ plan, reasoning, progress }).forEach((key) => {
        console.info(`${key}:`, JSON.stringify(thoughts[key], null, 4))
      })

      return {
        cycle,
        plan,
        reasoning,
        progress,
      }
    }
    this.actionCycle = async (command, cycle) => {
      // run system commands
      let { name: toolname, args } = command
      let toolResponse

      if (toolname === 'taskComplete') {
        toolResponse = `Task completed in ${cycle} cycles.`
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

      return {
        toolname,
        args,
        toolResponseMessage,
      }
    }
    this.startCycle = async (temperature) => {
      const userInitMsg = promptProvider.header.user.initMsg
      // Resume last actions from last run if data is saved
      let messages = retrieveArrayFromLocalStorage('messageHistory')

      if (messages) {
        // remove old instructions
        messages = conversationManager.clearUserMessages(messages)
        console.info(
          `Resuming from last conversation. Tokens left: ${await tokenManager.tokenBalance(
            messages
          )}`
        )
      } else {
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
        if (
          (await tokenManager.isWithinLimit('messages', messages)) === false
        ) {
          const summarizedHeader = await summarizeConversation(
            tokenManager,
            messages
          )

          messages = summarizedHeader

          messages.push({
            role: 'user',
            content: userInitMsg(),
          })
        }

        console.info(
          `Starting cycle with ${await tokenManager.tokenBalance(
            messages
          )} tokens left`
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
    this.continueCycle = async (_messages, cycle, temperature) => {
      // Filter out previous instructions to reduce token cost, we'll reinsert later at the end to keep it fresh
      let messages = conversationManager.clearUserMessages(_messages)

      // Check if messages token count is greater than limit for next responses
      console.info(`Tokens left: ${await tokenManager.tokenBalance(messages)}`)
      if (await tokenManager.isWithinLimit('messages', messages)) {
        messages = await summarizeConversation(tokenManager, messages)
        console.info(
          `New context token count: ${await tokenManager.countTokens(
            JSON.stringify(messages)
          )}`
        )
      }

      console.debug(`Cycle ${cycle} messages:`, { messages })

      const nextUserMessage = promptProvider.nextPrompt.user

      let nextPrompt = {
        role: 'user',
        content: nextUserMessage(),
      }
      const finalTokenCount = await tokenManager.countTokens(
        JSON.stringify([...messages, nextPrompt])
      )

      console.debug({ finalTokenCount })

      if (finalTokenCount <= tokenManager.limits.global + 200) {
        messages.push(nextPrompt)
      } else if (finalTokenCount - tokenManager.limits.global <= 500) {
        // send just the expected response format if the usual nextPrompt will break the bank
        nextPrompt.content = nextUserMessage(true)
        messages.push({
          role: 'user',
          content: `${DEFAULT_RESPONSE_FORMAT}`,
        })
      } else {
        // oh well we tried
        storeArrayInLocalStorage('messageHistory', messages) // we can try again?
        throw Error('Max tokens')
      }

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
    this.getResponse = async ({ messages, temperature }) => {
      function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
      }

      const maxRetryCount = 3
      let retryCount = 0

      while (retryCount < maxRetryCount) {
        const response = await completePrompt({
          messages: messages,
          max_tokens: await tokenManager.tokenBalance(messages),
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

    return {
      thoughtCycle: this.thoughtCycle,
      actionCycle: this.actionCycle,
      startCycle: this.startCycle,
      continueCycle: this.continueCycle,
      maxCycles: this.maxCycles,
    }
  })()

  const conversationManager = new (function () {
    this.clearUserMessages = (messages) =>
      messages.filter((msg) => msg.role !== 'user')

    return {
      clearUserMessages: this.clearUserMessages,
    }
  })()

  const handleClick = async () => {
    const baseTemperature = 0.1

    let response
    let messages
    let cycle = 0
    let toolResponseMessage = ''
    let temperature = parseFloat(baseTemperature)

    try {
      const startResponse = await cycleManager.startCycle(baseTemperature)

      response = {
        thoughts: startResponse.thoughts,
        command: startResponse.command,
      }
      messages = startResponse.messages

      setLastResponse(startResponse)
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
        await cycleManager.thoughtCycle(response.thoughts, cycle)
      }

      // run system commands
      if (response.command?.name) {
        const actionResults = await cycleManager.actionCycle(
          response.command,
          cycle
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

      cycle++

      if (cycle <= cycleManager.maxCycles) {
        const nextResponse = await cycleManager.continueCycle(
          messages,
          cycle,
          temperature
        )
        response = nextResponse.response
        messages = nextResponse.messages

        setLastResponse(response)
      } else {
        console.error('Max cycles reached')
        // Save history to resume later
        storeArrayInLocalStorage('messageHistory', messages)
        break
      }
    }
  }

  return (
    <>
      <Button onClick={handleClick}>Test</Button>
      {lastResponse ? (
        <>
          <DynamicReactJson
            name={'Data Array'}
            src={lastResponse}
            theme={'rjv-default'}
            collapsed
          />
        </>
      ) : (
        ''
      )}
    </>
  )

  // TODO: Move conversation stuff to the conversationManager
  async function summarizeConversation(tokenManager, messages) {
    console.info('Summarizing conversation...')
    const summaryResponse = async (messages, temperature = 0) => {
      const tokenBalance = await tokenManager.tokenBalance(messages)
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
            (_, i) =>
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
}

function storeArrayInLocalStorage(key, array) {
  localStorage.setItem(key, JSON.stringify(array))
}

function retrieveArrayFromLocalStorage(key) {
  const storedArray = localStorage.getItem(key)
  if (storedArray) {
    return JSON.parse(storedArray)
  } else {
    return null
  }
}
