import TextField from '@mui/material/TextField'
import { Grid } from '@mui/material'
import { useSelector } from 'react-redux'

export const ConfigureWorkerForm = ({
  workerId,
  setName,
  setDescription,
  setGoals,
  setConstraints,
}) => {
  const config = useSelector((state) => state.uiStates.workerConfig).find(
    (config) => config.id === workerId
  )
  const { name, description, goals, constraints } = config

  return (
    <>
      <h4>{name}</h4>

      <Grid container item xs={12}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Agent Name"
            defaultValue={name}
            onChange={(e) => {
              setName(e.target.value)
            }}
            variant="standard"
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Agent Description"
            defaultValue={description}
            onChange={(e) => {
              setDescription(e.target.value)
            }}
            variant="standard"
          />
        </Grid>
      </Grid>

      <Grid container item xs={12}>
        <Grid container item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Goals"
            defaultValue={goals.join('\n')}
            onChange={(e) => {
              const goalsArray = e.target.value
                .split('\n')
                .map((item) => item.trim())
              setGoals(goalsArray)
            }}
            variant="standard"
          />
        </Grid>

        <Grid container item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Constraints"
            defaultValue={constraints}
            onChange={(e) => {
              setConstraints(e.target.value)
            }}
            variant="standard"
          />
        </Grid>
      </Grid>
    </>
  )
}
