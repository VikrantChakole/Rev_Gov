import client from './client'

export const applicationsApi = {
  listServices: ()           => client.get('/applications/services'),
  getService:   (id)         => client.get(`/applications/services/${id}`),
  getStatus:    (appNum)     => client.get(`/applications/status/${appNum}`),
  getMyApplications: (citizenIdentifier = null, limit = 100) => {
    const id = citizenIdentifier || localStorage.getItem('citizen_identifier')
    if (id) {
      return client.get(`/applications/citizen/${id}?limit=${limit}`).catch(() => client.get(`/applications/my-applications?limit=${limit}`))
    }
    return client.get(`/applications/my-applications?limit=${limit}`)
  },
  getCitizenApps: (id)       => client.get(`/applications/citizen/${id}`),
  getRecent:    (limit = 20) => client.get(`/applications/recent?limit=${limit}`),
  getById:      (id)         => client.get(`/applications/${id}`),
  updateStatus: (appNum, status, note = '') =>
    client.patch(`/applications/status/${appNum}`, { status, note }),
  validateEligibility: (serviceId, slots) =>
    client.post('/applications/validate-eligibility', { service_id: serviceId, slots }),

  // ── Authoritative Admin APIs ──
  getAdminList: (params = {}) => client.get('/applications/admin/list', { params }),
  getAdminDetail: (idOrNumber) => client.get(`/applications/admin/${idOrNumber}`),
  assignApplication: (idOrNumber) => client.post(`/applications/${idOrNumber}/assign`),
  submitDecision: (idOrNumber, decision, reason = '', adminNotes = '') =>
    client.post(`/applications/admin/${idOrNumber}/decision`, {
      decision,
      reason: reason || null,
      admin_notes: adminNotes || null,
    }),
  submitForVerification: (idOrNumber) => client.post(`/applications/${idOrNumber}/submit`),
  escalateApplication: (idOrNumber, reason, priority = 'HIGH') =>
    client.post(`/applications/${idOrNumber}/escalate`, { reason, priority }),

  // ── Citizen Payment & Certificate APIs ──
  initiatePayment: (applicationId, citizenIdentifier, amount = 50.0) =>
    client.post('/payment/initiate', {
      application_id: applicationId,
      citizen_identifier: citizenIdentifier,
      amount,
      channel: 'WEB',
      mode: 'MOCK_AUTO',
    }),

  // ── New Application & Manual Form APIs ──
  getActiveDraft: () =>
    client.get('/applications/active-draft'),
  createDraft: (serviceId = 'caste_certificate', channel = 'WEB_MANUAL') =>
    client.post('/applications/draft', { service_id: serviceId, channel }),
  discardDraft: (draftId) =>
    client.delete(`/applications/${draftId}/draft`),
  deleteApplication: (idOrNumber) =>
    client.delete(`/applications/${idOrNumber}`),
  updateDraftService: (draftId, serviceId) =>
    client.patch(`/applications/${draftId}/draft`, { service_id: serviceId }),
  uploadDraftDocument: (draftId, formData) =>
    client.post(`/applications/${draftId}/upload-document`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),
  deleteDraftDocument: (draftId, docId) =>
    client.delete(`/applications/${draftId}/documents/${docId}`),
  manualSubmit: (draftId, payload) =>
    client.post(`/applications/${draftId}/manual-submit`, payload),

  // ── Automated (AI Assisted) Form APIs ──
  getAutomatedState: (draftId) =>
    client.get(`/applications/automated/${draftId}/state`),
  sendAutomatedChat: (draftId, message) =>
    client.post(`/applications/automated/${draftId}/chat`, { message }),
  uploadAutomatedDocument: (draftId, formData) =>
    client.post(`/applications/automated/${draftId}/upload-document`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),
  deleteAutomatedDocument: (draftId, docId) =>
    client.delete(`/applications/automated/${draftId}/documents/${docId}`),
  resolveAutomatedField: (draftId, payload) =>
    client.post(`/applications/automated/${draftId}/resolve-field`, payload),
  updateAutomatedFormField: (draftId, payload) =>
    client.post(`/applications/automated/${draftId}/update-form-field`, payload),
  submitAutomatedForm: (draftId, payload) =>
    client.post(`/applications/automated/${draftId}/submit`, payload),
}

