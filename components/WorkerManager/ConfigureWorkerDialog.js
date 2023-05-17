import Button from '@mui/material/Button'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Dialog from '@mui/material/Dialog'
import { useDispatch, useSelector } from 'react-redux'
import { CREATE_WORKER_CONFIG, HIDE_AGENT_CONFIG_FORM } from '../../store/types'
import { ConfigureWorkerForm } from './ConfigureWorkerForm'
import { useEffect, useState } from 'react'

export function ConfigureWorkerDialog({ workerId }) {
  const state = useSelector((state) => state)
  const wrapper = state.workerStates.workerRegistry.find((wrapper) => wrapper.id === workerId)
  const workerConfigState = useSelector(
    (state) => state.uiStates.workerConfig
  ).find((config) => config.id === workerId)
  const { uiStates } = state
  const isOpen = uiStates.isConfiguringWorker
  const dispatch = useDispatch()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [goals, setGoals] = useState('')
  const [constraints, setConstraints] = useState('')

  const handleCancel = () => {
    dispatch({ type: HIDE_AGENT_CONFIG_FORM })
  }

  const handleOk = () => {
    dispatch({
      type: CREATE_WORKER_CONFIG,
      payload: { id: workerId, name, description, goals, constraints },
    })
    dispatch({ type: HIDE_AGENT_CONFIG_FORM })
    wrapper.worker.postMessage({
      type: 'config',
      payload: { name, description, goals, constraints },
    })

  }

  useEffect(() => {
    const currentConfig = uiStates.workerConfig.find(
      (config) => config.id === workerId
    )
    if (!currentConfig) {
      dispatch({ type: CREATE_WORKER_CONFIG, payload: { id: workerId } })
    } else {
      console.log({ currentConfig })
    }
  }, [dispatch, workerId, uiStates.workerConfig])

  return (
    <Dialog
      // sx={{ '& .MuiDialog-paper': { width: '80%', maxHeight: 435 } }}
      // maxWidth="xs"
      open={isOpen}
    >
      <DialogTitle>Configure Worker</DialogTitle>
      <DialogContent dividers>
        <ConfigureWorkerForm
          {...{ workerId, setName, setDescription, setGoals, setConstraints }}
        />
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={handleCancel}>
          Cancel
        </Button>
        <Button onClick={handleOk}>Ok</Button>
      </DialogActions>
    </Dialog>
  )
}
