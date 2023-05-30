export function splitArray(array) {
  const texts = []
  const metadatas = []

  for (let i = 0; i < array.length; i++) {
    texts.push(array[i].text)
    metadatas.push(array[i].metadata)
  }

  return [texts, metadatas]
}
