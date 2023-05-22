export default async function handler(req, res) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
  const cxId = process.env.NEXT_PUBLIC_GOOGLE_CX_ID

  res.status(200).json({ apiKey, cxId })
}
