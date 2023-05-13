import { combineReducers } from 'redux'
import uiReducer from './uiReducer'

export default combineReducers({
  uiStates: uiReducer,
})
