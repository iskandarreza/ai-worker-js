export function storeArrayInLocalStorage(key, array) {
  localStorage.setItem(key, JSON.stringify(array))
}

export function retrieveArrayFromLocalStorage(key) {
  const storedArray = localStorage.getItem(key)
  if (storedArray) {
    return JSON.parse(storedArray)
  } else {
    return null
  }
}
