import WorkerComponent from './WorkerComponent'

export default function Home() {
  return (
    <>
      <WorkerComponent
        title="Pyodide worker"
        workerScript="/workers/pyodide.worker.js"
      />
      <WorkerComponent
        title="OpenAI worker "
        workerScript="/workers/openai.worker.js"
      />
    </>
  )
}
