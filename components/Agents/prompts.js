const typedef = `/**
* @typedef {Object} ResponseFormat
* @property {Object} thoughts - Your thought response as an object
* @property {string} thoughts.text - What you want to say to the user
* @property {string} thoughts.reasoning - Reason behind your response
* @property {string} thoughts.progress - Detailed list of your actions
* @property {string} thoughts.plan - Short bulleted list conveying long-term plan
* @property {string} thoughts.speak - Summary of thoughts to say to the user
* @property {Object} command - Next command in your plan as an object
* @property {string} command.name - Command name
* @property {Object} command.args - Arguments for the command (key-value pairs)
*/`

export const _DEFAULT_RESPONSE_FORMAT = {
  thoughts: {
    text: 'What do you want to say to the user?',
    reasoning: 'Why do you want to say this?',
    progress: 'A detailed list of everything you have done so far',
    plan: 'A short bulleted list that conveys a long-term plan',
    speak: 'thoughts summary to say to user',
  },
  command: {
    name: 'next command in your plan',
    args: [{ arg_name: 'value' }],
  },
}

export const DEFAULT_RESPONSE_FORMAT = `Provide response in JSON format below without any other commentary.
${typedef}`

export const INIT_PROMPT = `Do the following:
\n- Execute next best command to achieve goals.
\n- Execute 'doNothing' command if no other command available.
\n- ${DEFAULT_RESPONSE_FORMAT}
`

export const NEXT_PROMPT = `INSTRUCTIONS:
\n- Check goal progress.
\n- If all goals achieved, execute "taskComplete" command IMMEDIATELY. Otherwise,
\n- Plan next command based on previous responses to work towards goals.
\n- Use available commands only.
\n- Aim for minimal steps as commands are expensive.
\n- Confirm execution only if system acknowledges.
\n- Don't assume execution based on plan.
\n- Save useful info to a file if applicable.
\n- Utilize long-term memory instead of reanalyzing.
\n- Execute "doNothing" ONLY if no other command available.
\n- Ensure supported arguments for commands.
\n- Select alternative command if unavailable.

${DEFAULT_RESPONSE_FORMAT}
`
