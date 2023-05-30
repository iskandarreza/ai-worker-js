import { INIT_PROMPT, NEXT_PROMPT } from './prompts'
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
  const goals = ['Generate a list of in demand services that an automated self-prompting LLM agent can provide. Then send the report to the user.']
  const maxTokens = 3800

  const goalsPrompt = () => {
    let prompt = []
    prompt.push('GOALS:')
    for (let i = 0; i < goals.length; i++) {
      prompt.push(`${i + 1}. ${goals[i]}`)
    }
    return prompt.join('\n') + '\n'
  }

  const tools = {
    webSearchWorker: webSearchWorker, // typically 100 tokens per result
    webScraperWorker: webScraperWorker,
    sendReport: sendReport,
  }

  const toolsInfo = `${Object.keys(tools)
    .map((toolname) => {
      const { description, args } = tools[toolname]
      return `${toolname}: ${description} - args: ${args}`
    })
    .join('\n')}`

  // 214 tokens
  const headerMsg = (
    name = 'Looper Generalized Autonomous Agent',
    description = `a prototype autonomous, self-prompting, LLM AI agent that reponds only in JSON, who seeks ways to improve it's capabilities while operating in the limiting environment of a webworker thread.`
  ) => {
    return {
      role: 'system',
      content: `You are ${name}, ${description}.\n${goalsPrompt()}\nThe current time and date is ${new Date().toLocaleString()}\nYou have access to the following tools:\n${toolsInfo}`,
    }
  }

  // 259 tokens
  const fullInitMsg = (INIT_PROMPT = INIT_PROMPT, message = '') => {
    return {
      role: 'user',
      content: `${INIT_PROMPT}\n${message}`,
    }
  }

  const handleClick = async () => {
    const systemWorkers = await getSystemWorkers()
    const [tokenCounter] = systemWorkers.filter(
      (worker) => worker.name === 'token-counter'
    )
    const countTokens = async (text) =>
      await tokenCounter.comlink.countTokens(text)

    const response = async (messages) => {
      const tokenCount = await countTokens(JSON.stringify(messages))

      // TODO: an agent that splits the task into subtasks and an agent that asseses what model and temperature to spawn a new agent for the subtask
      const response = await completePrompt({
        messages: messages,
        max_tokens: maxTokens - tokenCount,
        temperature: 0.1,
      })
      return response
    }

    // Resume last from last run
    let messages = retrieveArrayFromLocalStorage('messageHistory')

    if (!messages) {
      messages = [headerMsg(), fullInitMsg(INIT_PROMPT)]
    }

    let responseJSON
    let cycle = 0

    try {
      const startResponse = await response(messages)
      responseJSON = JSON.parse(startResponse)
      setLastResponse(responseJSON)
    } catch (error) {
      console.error(error)
    }

    while (responseJSON) {
      let command = !!responseJSON.command ? responseJSON.command : undefined
      let toolResponse = undefined

      let responseMessage = {
        role: 'assistant',
        content: JSON.stringify(responseJSON),
      }
      messages.push(responseMessage)

      let toolResponseMessage = undefined

      // run system commands
      if (command?.name) {
        console.debug(command)
        const toolname = command.name
        let args = command.args

        if (toolname === 'taskComplete') {
          toolResponse = `Task completed in ${cycle} cycles.`
          console.info(toolResponse)
          break
        } else if (toolname === 'doNothing') {
          toolResponse = 'Nothing done.'
          // TODO: count num of times this happens in a row, course correct if it's mostly unnecessary
        } else {
          // run staged tool
          if (tools.hasOwnProperty(toolname)) {
            try {
              args = JSON.parse(args)
            } catch (error) {
              // pass
            }
            try {
              // TODO: format responses to be all text so we can make the `toolResponseMessage` more compact
              toolResponse = await tools[toolname].run(args)
            } catch (error) {
              console.error(error)
            }
          } else {
            toolResponse = `Tool "${toolname}" is not available. Currently available tools are:\n${toolsInfo}`
          }
        }

        console.debug({ toolResponse })

        if (toolResponse) {
          let toolResponseStr
          if (typeof toolResponse === 'string' || toolResponse instanceof String) {
            toolResponseStr = toolResponse
          } else {
            toolResponseStr = JSON.stringify(toolResponse)
          }

          toolResponseMessage = {
            role: 'system',
            content: `${toolname} tool results: ${toolResponseStr}`,
          }

          messages.push(toolResponseMessage)
        }
      }

      cycle++

      if (cycle <= 18) {
        // 437 tokens
        const nextUserMessage = {
          role: 'user',
          content: `${NEXT_PROMPT}`,
        }

        // Filter out previous instructions to reduce token cost, we'll reinsert later at the end to keep it fresh
        messages = messages.filter(
          (msg) =>
            !(msg.role === 'user' && msg.content.includes('INSTRUCTIONS'))
        )

        // Check if messages token count is greater than limit for next responses
        let tokenCount = await countTokens(JSON.stringify(messages))
        console.debug(`Tokens left: ${maxTokens - tokenCount}`)
        if (maxTokens - tokenCount < 1000) {
          const summaryResponse = async (messages) => {
            const messagesJSON = JSON.stringify(messages)
            const tokenCount = await countTokens(messagesJSON)

            const response = await summarizeText({
              model: 'text-davinci-003',
              prompt: messagesJSON,
              max_tokens: maxTokens - tokenCount < 500 ? 500 : maxTokens - tokenCount,
              temperature: 0.0,
            })
            return response
          }

          const messagesInBetween = messages.slice(2, -1) // Should we reformat as a conversation text?

          // 1st update suggestion from chatgpt
          const summaryRequestMsg = {
            role: 'user',
            content: `Please summarize this conversation for me:\n${JSON.stringify(
              messagesInBetween
            )}\n\nImportant Details and Results:\n- Include key findings from the research and data collection phases.\n- Highlight important commands executed and their results.\n\nKey Highlights:\n- Summarize the main points of the conversation in bullet points.\n- Focus on relevant information and filter out redundant exchanges.\n\nAdditional Context:\n- Provide any relevant links or references mentioned during the conversation.\n\nPlease ensure the summary accurately captures the essential aspects of the task and includes details that are crucial for understanding the context and progress.\n\nThank you!`,
          }

          const conversationSummary = await summaryResponse([summaryRequestMsg])
          const summaryMsg = {
            role: 'system',
            content: `Conversation history summarized:\n${conversationSummary}`,
          }
          messages = [headerMsg(), summaryMsg]

          if (toolResponseMessage) {
            messages.push(toolResponseMessage) // Yeah probably a good idea to standardize tool responses to markdown text
          }

          tokenCount = await countTokens(
            JSON.stringify(messages)
          )
          console.debug(
            `New context token count: ${tokenCount}`
          )
        }

        console.debug(`Cycle ${cycle}:`, { messages })
        const finalTokenCount = await countTokens(JSON.stringify([...messages, nextUserMessage]))
        console.debug(finalTokenCount, maxTokens)
        if (finalTokenCount <= maxTokens) {
          messages.push(nextUserMessage)
        } else {
          // messages.push({
          //   role: 'user',
          //   content: `${DEFAULT_RESPONSE_FORMAT}`
          // })
          console.error('Max tokens')
          break
        }


        // trigger next cycle
        const nextResponse = await response(messages)
        responseJSON = JSON.parse(nextResponse)
        setLastResponse(responseJSON)
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
}

function storeArrayInLocalStorage(key, array) {
  localStorage.setItem(key, JSON.stringify(array));
}

function retrieveArrayFromLocalStorage(key) {
  const storedArray = localStorage.getItem(key);
  if (storedArray) {
    return JSON.parse(storedArray);
  } else {
    return null;
  }
}