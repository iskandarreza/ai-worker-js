A little demo / experiment to run autonomous AI agents (think AutoGPT, LoopGPT, or AgentGPT) in web worker threads. Currently the UI is mostly there to make debugging, optimizing, and improving the flow easier. This is a platform for experimenting on LLM prompts and agent workflows directly.

#### Background:

As of this moment, the autonomous AI agent implementations out there all struggle with handling complex tasks or multi-turn conversations. This is my dev playground to explore ways to mitigate that.

And since the projects like AutoGPT, LoopGPT and many others primarily use OpenAI's `gpt-3.5-turbo` or members of the gpt-3 model family, we're limited to a 4096 token context window. So it doesn't matter that I'm running this in a web worker on the browser. It works just as well without needing to have complicated packages for web scraping or data ingestion and vector storage. You gotta address the big elephant in the room, which is this 4000 word limit, to carry on complex tasks through multiple cycles. That means managing the token usage and the context window. That only requires prompt engineering and a workflow to manage the conversation history.

#### The current tech stack here:

- React on NextJS - there's a NextJS API route to serve API keys to the webworkers for use with OpenAI and Google Custom Search, but since I'm running this on my own machine and currently am not prirotising its use and I have the workers/agents take the value directly from `env.local`
- [Web Workers][web_workers] - underrated tech that's been around for a while. I put my [stripped down GPT2 tokenizer][gpt_tok] in one of these bad boys and _voila_, a serverless token counter, no need for a http fetch.
- [Comlink][comlink] - I still have to use `postMessage` with the [`MessageChannel API`](https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API) for some things but it does make calling web worker functions/methods a lot easier.
- [nitaiaharoni1/vector-storage](https://github.com/nitaiaharoni1/vector-storage) - this works amazingly for the purposes of this experiment. It's lightweight, it runs in the browser and saves the vectors (with metadata!) from OpenAI's `text-embedding-ada-002` into IndexedDB and you can do a similarity search query, even filter to include or exclude your custom metadata. That's pretty much what all that's needed for what we currently can do with generalized automated agents. Like really, the heaviest lift here would be saving search results and scraped web page data with the embeddings from OpenAI, then refining the eventual output result that we want to feed back to the agent via semantic search. This NPM package perfectly fits that job description.
- Google Custom Search API - for search results
- OpenAI API - for chat completion task-plan/action/progess and for generating embeddings for the vector store
- [CloudFlare Web Scraper API][web_scraper_worker] - this is a pretty cool, free to use project. You send the API the url and a css selector, it returns what it has from the CloudFlare cache. It's not 100% perfect (for perfect web scraping I highly recommend Puppeteer or Playwright) but web scraping is not my focus for this experiment, token management and context window management is.
- Redux - love redux, makes React state management a breeze.
- [Pyodide][pyodide] - Got this running in a web worker, so we can do Python commands in the browser, serverless!

- [LoopGPT-JS](https://github.com/iskandarreza/loopgpt-js) - My basic port from Python to JS of [LoopGPT](https://github.com/farizrahman4u/loopgpt), itself a reimplimentation of AutoGPT that is modular and extensible. I got it running in a web worker.

[web_workers]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
[gpt_tok]: https://github.com/iskandarreza/gpt-tok
[web_scraper_worker]: https://workers.cloudflare.com/built-with/projects/web-scraper
[pyodide]: https://github.com/pyodide/pyodide
[comlink]: https://github.com/GoogleChromeLabs/comlink

##### Why Web Workers?

Why not?

##### Aren't web workers limited in their capabilities?

Yes, but so is an automated LLM agent tasked with semi-complex multi-cycle goals with a 4096 token context window. Next question.

##### What advantages are there to using web workers?

The token counting and the pyodide python shell can be pretty heavy, if it runs in the main thread it can block things, causes lagginess and unresponsiveness. Running those in a separate worker thread significantly improves the experience. The main `while` loop of all these autonomous agents can also run for a long time so putting them in a seperate thread frees up the main thread to respond to other events, such as responses from another autonomous agent (haven't tested this idea yet, it's in the works)
