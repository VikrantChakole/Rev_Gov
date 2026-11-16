import client from './client'

export const ocrApi = {
  getConfig: () => client.get('/admin/ocr/config'),
  updateConfig: (payload) => client.post('/admin/ocr/config', payload),
  testExtraction: (formData) =>
    client.post('/admin/ocr/test', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}
