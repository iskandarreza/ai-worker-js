import { HIDE_PYODIDE_COMMAND_BOX, SHOW_PYODIDE_COMMAND_BOX } from '../types'

const initialState = {
  inputVisible: false,
}

export default function (state = initialState, action) {
  // console.log({ state, action })

  switch (action.type) {
    case SHOW_PYODIDE_COMMAND_BOX:
      return {
        ...state,
        inputVisible: true,
      }

    case HIDE_PYODIDE_COMMAND_BOX:
      return {
        ...state,
        inputVisible: false,
      }

    default:
      return state
  }
}
