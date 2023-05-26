import { expose } from 'comlink'
import { encode } from 'gpt-tok'

const init = () => {
  self.postMessage({
    type: 'init',
    payload: 'Token Counter Worker initialized.',
  })
}

expose({
  init,
  countTokens: (text) => encode(text).length
})
