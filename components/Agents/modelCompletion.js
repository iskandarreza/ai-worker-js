export async function completePrompt({
  model = 'gpt-3.5-turbo',
  messages,
  max_tokens = 500,
  temperature = 0.8,
}) {
  return await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.NEXT_PUBLIC_OPEN_AI_API_KEY,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens,
      temperature,
    }),
  })
    .then((res) => res.json())
    .then((res) => res.choices[0].message.content)
    .then(async (res) => {
      console.log('\x1b[91m' + JSON.stringify(messages, null, 4) + '\x1b[0m')

      let results = res
      try {
        console.log(
          '\x1b[92m' + JSON.stringify(JSON.parse(results), null, 4) + '\x1b[0m'
        )
      } catch (error) {
        results = await fixJSON({ prompt: { data: results, errorMsg: JSON.stringify(error) } })
      }
      return results
    })
}

export async function summarizeText({
  model = 'text-davinci-003',
  prompt,
  max_tokens = 500,
  temperature = 0.2,
}) {
  return await fetch('https://api.openai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.NEXT_PUBLIC_OPEN_AI_API_KEY,
    },
    body: JSON.stringify({
      model,
      prompt,
      max_tokens,
      temperature,
    }),
  })
    .then((res) => res.json())
    .then((res) => res.choices[0].text)
    .then((res) => {
      console.log(
        '\x1b[91m' + JSON.stringify(JSON.parse(prompt), null, 4) + '\x1b[0m'
      )
      console.log('\x1b[92m' + res + '\x1b[0m')
      return res
    })
}

export async function fixJSON({
  model = 'text-davinci-003',
  prompt,
  max_tokens = 500,
  temperature = 0.0,
}) {
  const _prompt = `Please fix this JSON output:\n${prompt.data}\n\nThe error message received was:\n${data.errorMsg}\n\nRespond with the fixed JSON without commentary.`
  return await fetch('https://api.openai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.NEXT_PUBLIC_OPEN_AI_API_KEY,
    },
    body: JSON.stringify({
      model,
      _prompt,
      max_tokens,
      temperature,
    }),
  })
    .then((res) => res.json())
    .then((res) => res.choices[0].text)
    .then((res) => {
      try {
        console.log(
          '\x1b[91m' + JSON.stringify(JSON.parse(prompt), null, 4) + '\x1b[0m'
        )
        console.log('\x1b[92m' + res + '\x1b[0m')
        return res
      } catch (error) {
        console.error(error)
      }
    })
}
