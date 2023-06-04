import { DEFAULT_RESPONSE_FORMAT, INIT_PROMPT, NEXT_PROMPT } from './prompts'
import { Button } from '@mui/material'
import { useState } from 'react'
import { DynamicReactJson } from '../DynamicReactJson'
import { sendReport, webScraperWorker, webSearchWorker } from './tools'
import { CycleManager } from './CycleManager'

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
    'Find out how those projects handle communication between agents.',
    'Generate a report on the findings of the previous two goals to send to the user in markdown.',
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

  // Provides prompt strings to compose messages to send to chat completion for context
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

  const cycleManager = new CycleManager(promptProvider, 18)

  const handleClick = async () => {
    await cycleManager.startCycle(0.2, setLastResponse)
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