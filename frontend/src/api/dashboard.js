import client from './client'

export const dashboardApi = {
  getOverview: (state = null) =>
    client.get('/dashboard/overview', { params: state ? { state } : {} }),
  getAuditLog: (limit = 50, eventType = null, state = null) => {
    const params = { limit }
    if (eventType) params.event_type = eventType
    if (state) params.state = state
    return client.get('/dashboard/audit-log', { params })
  },
  getDataGuardStats: () => client.get('/dashboard/data-guard-stats'),
  getEscalations: (state = null) =>
    client.get('/dashboard/escalations', { params: state ? { state } : {} }),
  getServiceHealth: () => client.get('/dashboard/service-health'),
}

