export default async function handler(req, res) {
  const apiKey = process.env.NEXT_PUBLIC_OPEN_AI_API_KEY

  res.status(200).json({ apiKey })
}
