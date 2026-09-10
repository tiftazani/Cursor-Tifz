export function downloadFile(filename: string, contents: BlobPart | Uint8Array, mime: string): void {
  const part: BlobPart =
    contents instanceof Uint8Array
      ? (contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength) as ArrayBuffer)
      : contents
  const blob = new Blob([part], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function stampFile(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`
}
