// Import the Pyodide loader
importScripts('https://cdn.jsdelivr.net/pyodide/v0.23.2/full/pyodide.js')

// Initialize Pyodide and import required modules
// Load the Pyodide wasm and set up the module object
const pyodide = await loadPyodide({
  indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.2/full/',
})

// Import the required Python modules
await pyodide.loadPackage(['numpy'])

// Listen for messages from the main thread
self.onmessage = (event) => {
  if (event.data.type === 'init') {
    // Respond to the initialization message
    self.postMessage('Pyodide initialized.')
  } else if (event.data.type === 'run') {
    // Run the Python code and respond with the output
    const code = event.data.code
    const output = pyodide.runPython(code)
    self.postMessage(output)
  }
}
