import { encode } from 'gpt-3-encoder'

export default async function handler(req, res) {
  const { text } = req.body
  let encodedText = encode(JSON.stringify(text))
  let tokenCount = encodedText.length

  res.status(200).json({ count: tokenCount })
}
