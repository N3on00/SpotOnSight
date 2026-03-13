import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileAsBase64 } from '../utils/fileBase64'

function stubFileReader({ result = '', fail = false } = {}) {
  class MockFileReader {
    readAsDataURL(_file) {
      if (fail) {
        this.onerror?.(new Error('read failed'))
        return
      }
      this.result = result
      this.onload?.()
    }
  }

  vi.stubGlobal('FileReader', MockFileReader)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readFileAsBase64', () => {
  it('strips the data url prefix', async () => {
    stubFileReader({ result: 'data:image/png;base64,abc123' })
    await expect(readFileAsBase64({ name: 'avatar.png' })).resolves.toBe('abc123')
  })

  it('throws a readable error on file-read failure', async () => {
    stubFileReader({ fail: true })
    await expect(readFileAsBase64({ name: 'avatar.png' })).rejects.toThrow('Could not read image file')
  })
})
