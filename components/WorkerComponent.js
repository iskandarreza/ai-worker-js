import React, { useState } from 'react'

function WorkerComponent(props) {
  const [worker, setWorker] = useState(null)

  const createWorker = () => {
    console.log(props.title)
    const newWorker = new Worker(
      new URL(props.workerScript, window.location.origin),
      {
        name: props.title,
        credentials: 'same-origin',
      }
    )

    setWorker(newWorker)

    newWorker.addEventListener('message', (ev) => {
      console.log(ev?.data)
    })
  }

  // Function to terminate the current web worker
  const terminateWorker = () => {
    if (worker !== null) {
      worker.terminate()
      setWorker(null)
    }
  }

  // Render the component with buttons to create and terminate workers
  return (
    <div>
      <p>{props.title}</p>
      {worker === null ? (
        <button onClick={createWorker}>Create Worker</button>
      ) : (
        <button onClick={terminateWorker}>Terminate Worker</button>
      )}
    </div>
  )
}

export default WorkerComponent
