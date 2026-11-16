import client from './client'

export const configApi = {
  // Message & WhatsApp Configuration
  getMessageConfig: () => client.get('/admin/config/message'),
  updateMessageConfig: (payload) => client.post('/admin/config/message', payload),
  testMessageDispatch: (payload) => client.post('/admin/config/message/test', payload),

  // IVR Configuration
  getIVRConfig: () => client.get('/admin/config/ivr'),
  updateIVRConfig: (payload) => client.post('/admin/config/ivr', payload),
  testIVRTTS: (payload) => client.post('/admin/config/ivr/test-tts', payload),
}
