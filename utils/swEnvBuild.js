require('dotenv').config({ path: '.env.local' })
const fs = require('fs')

fs.writeFileSync(
  './public/swenv.js',
  `
 const process = {
          env: {
            NEXT_PUBLIC_OPEN_AI_API_KEY: '${process.env.NEXT_PUBLIC_OPEN_AI_API_KEY}',
  }
 }`
)
