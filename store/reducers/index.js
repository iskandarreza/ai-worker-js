import { combineReducers } from 'redux'
import uiReducer from './uiReducer'
import agentReducer from './agentReducer'
import pyodide from './pyodide'

export default combineReducers({
  uiStates: uiReducer,
  workerStates: agentReducer,
  pyodide: pyodide,
})
