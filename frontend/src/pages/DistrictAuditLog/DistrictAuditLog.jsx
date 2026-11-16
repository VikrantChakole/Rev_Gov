import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, RefreshCw, Filter, Shield, MapPin } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import { dashboardApi } from '../../api/dashboard'
import { EVENT_TYPE_CONFIG, POLL_INTERVALS } from '../../utils/constants'
import styles from './DistrictAuditLog.module.css'

const EVENT_TYPES = ['DATA_GUARD', 'CONSENT', 'SUBMISSION', 'PAYMENT', 'ESCALATION', 'STATUS_UPDATE', 'FRAUD_REJECT']

export default function DistrictAuditLog() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const assignedState = user?.state || 'Maharashtra'

  const [filterType, setFilterType] = useState('')
  const [limit, setLimit] = useState(50)

  const currentLang = i18n.language || 'en'
  const localeMap = {
    hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN', te: 'te-IN', ta: 'ta-IN',
    gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', en: 'en-IN'
  }

  const { data, isLoading, refetch, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['district-audit-log', assignedState, filterType, limit],
    queryFn: () => dashboardApi.getAuditLog(limit, filterType || null, assignedState),
    refetchInterval: POLL_INTERVALS.LIVE_FEED || 10000,
  })

  const events = data?.events || []
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString(localeMap[currentLang] || 'en-IN') : ''

  const exportCSV = () => {
    const headers = ['id', 'timestamp', 'event_type', 'actor', 'action', 'outcome', 'citizen_ref', 'application_id']
    const rows = events.map((e) =>
      headers
        .map((h) => JSON.stringify(e[h] ?? ''))
        .join(',')
    )
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `district_audit_log_${assignedState}_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.headerTag}>
            <MapPin size={13} color="#1e40af" />
            <span>{t('audit.districtComplianceTrail', { state: assignedState, defaultValue: `District Officer Compliance Trail • ${assignedState} State` })}</span>
          </div>
          <h1 className={styles.title}>{t('district.auditTrailLogs', 'District Audit Trail & Logs')}</h1>
          <p className={styles.sub}>
            {t('district.auditSub', {
              state: assignedState,
              count: events.length,
              time: lastUpdated,
              defaultValue: `Immutable event and security log for citizen submissions originating from ${assignedState} · ${events.length} events · Last updated: ${lastUpdated}`
            })}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={16} className={isFetching ? styles.spin : ''} />
            <span>{t('clerk.refresh', 'Refresh')}</span>
          </button>
          <button className={styles.iconBtn} onClick={exportCSV} disabled={events.length === 0}>
            <Download size={16} />
            <span>{t('audit.exportCsv', 'Export CSV')}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={16} color="#64748b" />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>{t('audit.filterLabel', 'Filter:')}</span>
        </div>
        <button
          className={`${styles.filterChip} ${!filterType ? styles.chipActive : ''}`}
          onClick={() => setFilterType('')}
        >
          {t('audit.allEvents', 'All Events')}
        </button>
        {EVENT_TYPES.map((evType) => (
          <button
            key={evType}
            className={`${styles.filterChip} ${filterType === evType ? styles.chipActive : ''}`}
            onClick={() => setFilterType(filterType === evType ? '' : evType)}
          >
            {evType.replace('_', ' ')}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <select
            className={styles.limitSel}
            value={limit}
            onChange={(e) => setLimit(+e.target.value)}
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {t('audit.showLimit', { count: n, defaultValue: `Show ${n}` })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Content */}
      {isLoading ? (
        <div className={styles.loadBox}>
          <RefreshCw size={24} className={styles.spin} color="#1e40af" />
          <span>{t('audit.loadingAuditLog', { state: assignedState, defaultValue: `Loading audit log for ${assignedState}...` })}</span>
        </div>
      ) : events.length === 0 ? (
        <div className={styles.emptyBox}>
          <Shield size={40} color="#94a3b8" />
          <p style={{ fontWeight: 600, color: '#334155', margin: '4px 0 0 0' }}>
            {t('audit.noAuditRecordsFound', { state: assignedState, defaultValue: `No audit records matching filters in ${assignedState}` })}
          </p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>{t('audit.colId', 'ID')}</th>
                <th className={styles.th}>{t('audit.colTimestamp', 'Timestamp')}</th>
                <th className={styles.th}>{t('audit.colEventType', 'Event Type')}</th>
                <th className={styles.th}>{t('audit.colActor', 'Actor')}</th>
                <th className={styles.th}>{t('audit.colActionDesc', 'Action Description')}</th>
                <th className={styles.th}>{t('audit.colOutcome', 'Outcome')}</th>
                <th className={styles.th}>{t('audit.colCitizenRef', 'Citizen Ref')}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => {
                const cfg = EVENT_TYPE_CONFIG[ev.event_type] || {
                  bg: '#f1f5f9',
                  color: '#475569',
                }
                const isBlock = ev.outcome === 'BLOCK' || ev.outcome === 'FAILURE'

                return (
                  <tr key={ev.id || i} className={styles.tr}>
                    <td className={styles.td}>
                      <code className={styles.idCell}>{ev.id}</code>
                    </td>
                    <td className={styles.td}>
                      {new Date(ev.created_at || Date.now()).toLocaleString(localeMap[currentLang] || 'en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className={styles.td}>
                      <span className={styles.typeBadge} style={{ background: cfg.bg, color: cfg.color }}>
                        {ev.event_type}
                      </span>
                    </td>
                    <td className={styles.td}>{ev.actor || 'SYSTEM'}</td>
                    <td className={styles.td} title={ev.action}>
                      {(ev.action || '').substring(0, 70)}
                      {ev.action?.length > 70 ? '…' : ''}
                    </td>
                    <td className={styles.td}>
                      <span className={isBlock ? styles.outcomeBlock : styles.outcomeSuccess}>
                        {ev.outcome || 'ALLOW'}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <code className={styles.appCell}>{ev.citizen_ref || '—'}</code>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
