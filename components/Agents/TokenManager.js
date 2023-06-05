import { getSystemWorkers } from '../../utils/getSystemWorkers'

export class TokenManager {
  constructor(
    config = { limits: { global: 3000, messages: 1200, actionResults: 800 } }
  ) {
    this.limits = {
      global: config.limits.global,
      messages: config.limits.messages,
      actionResults: config.limits.actionResults,
    }
    this.tokenUsage = {
      messages: 0,
      actionResults: 0,
    }

    this.countTokens = async (text) => {
      const systemWorkers = await getSystemWorkers()
      const tokenCounter = systemWorkers.find(
        (worker) => worker.name === 'token-counter'
      )
      const tokenCount = await tokenCounter.comlink.countTokens(text)

      return tokenCount
    }
    this.updateTokenUsage = async (type, tokens) => {
      switch (type) {
        case 'messages':
          this.tokenUsage.messages += tokens
          break
        case 'actionResults':
          this.tokenUsage.actionResults += tokens
          break
        case 'summarized':
          this.tokenUsage.messages = tokens
          this.tokenUsage.actionResults = 0
          break
        default:
          break
      }
    }
    this.resetUsage = () => {
      this.tokenUsage.messages = 0
      this.tokenUsage.messages = 0
    }
    this.tokenBalance = async (messages) => {
      if (Array.isArray(messages)) {
        return (
          this.limits.global -
          (await this.countTokens(JSON.stringify(messages)))
        )
      } else if (typeof messages === 'string' || messages instanceof String) {
        return this.limits.global - (await this.countTokens(messages))
      } else {
        console.debug('Unrecognized input: ', { messages })
        throw Error('Unrecognized input')
      }
    }
    this.isWithinLimit = async (type, data) => {
      switch (type) {
        case 'messages':
          return (
            (await this.countTokens(JSON.stringify(data))) <=
            this.limits.messages
          )

        case 'actions':
          return (
            (await this.countTokens(JSON.stringify(data))) <=
            this.limits.actionResults
          )

        default:
          break
      }
    }
    return {
      limits: this.limits,
      tokenUsage: this.tokenUsage,
      countTokens: this.countTokens,
      updateTokenUsage: this.updateTokenUsage,
      resetUsage: this.resetUsage,
      tokenBalance: this.tokenBalance,
      isWithinLimit: this.isWithinLimit,
    }
  }
}
