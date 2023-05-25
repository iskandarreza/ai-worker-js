/**
 * This function downloads JSON data as a file.
 * @param {JSON} data - The JSON data that needs to be downloaded as a file.
 */
export function downloadJsonData(data) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'data.json'
  link.click()
}
