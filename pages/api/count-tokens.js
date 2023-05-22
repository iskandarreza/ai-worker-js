import { encode } from 'gpt-3-encoder'

export default async function handler(req, res) {
  console.log({ body: req.body })
  const { text } = req.body
  let encodedText = encode(JSON.stringify(text))
  let tokenCount = encodedText.length

  res.status(200).json({ count: tokenCount })
}
