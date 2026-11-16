import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { RefreshCw, Clock, AlertTriangle, CheckCircle, MapPin, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import { dashboardApi } from '../../api/dashboard'
import { PRIORITY_CONFIG, POLL_INTERVALS } from '../../utils/constants'
import { applicationsApi } from '../../api/applications'
import styles from './DistrictEscalations.module.css'

const COLS = ['open', 'assigned', 'resolved']
const COL_ICONS = { open: AlertTriangle, assigned: Clock, resolved: CheckCircle }
const COL_COLORS = { open: '#b91c1c', assigned: '#b45309', resolved: '#15803d' }

function timeAgo(iso) {
  if (!iso) return 'just now'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  return `${Math.round(diff / 3600)}h ago`
}

export default function DistrictEscalations() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const assignedState = user?.state || 'Maharashtra'

  const currentLang = i18n.language || 'en'
  const localeMap = {
    hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN', te: 'te-IN', ta: 'ta-IN',
    gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', en: 'en-IN'
  }

  const queryClient = useQueryClient()
  const [resolutionNotes, setResolutionNotes] = useState({})

  const { data, isLoading, refetch, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['district-escalations', assignedState],
    queryFn: () => dashboardApi.getEscalations(assignedState),
    refetchInterval: POLL_INTERVALS.ESCALATIONS || 12000,
  })

  const mutation = useMutation({
    mutationFn: ({ appNumber, status, note }) => applicationsApi.updateStatus(appNumber, status, note),
    onSuccess: (_, { status }) => {
      toast.success(`Escalation ${status === 'APPROVED' ? 'resolved' : 'updated'}`)
      queryClient.invalidateQueries(['district-escalations', assignedState])
    },
    onError: (err) => toast.error(err.message),
  })

  const allEscalations = data?.escalations || []

  const grouped = {
    open: allEscalations.filter((e) => e.escalation_state === 'OPEN' || (!e.escalation_state && e.status === 'ESCALATED')),
    assigned: allEscalations.filter((e) => e.escalation_state === 'ASSIGNED'),
    resolved: allEscalations.filter((e) => e.escalation_state === 'RESOLVED'),
  }

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString(localeMap[currentLang] || 'en-IN') : ''

  const getColLabel = (col) => {
    if (col === 'open') return t('escalations.colOpen', 'Open')
    if (col === 'assigned') return t('escalations.colAssigned', 'Assigned')
    return t('escalations.colResolved', 'Resolved')
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.headerTag}>
            <MapPin size={13} color="#1e40af" />
            <span>{t('escalations.districtOfficerOversight', { state: assignedState, defaultValue: `District Officer Executive Oversight • ${assignedState} State` })}</span>
          </div>
          <h1 className={styles.title}>{t('district.districtEscalationsTitle', 'District Escalations & Grievances')}</h1>
          <p className={styles.sub}>
            {t('district.escalationsSub', {
              state: assignedState,
              count: allEscalations.length,
              time: lastUpdated,
              defaultValue: `Official dispute escalations and officer review tickets originating from ${assignedState} · ${allEscalations.length} total · Last updated: ${lastUpdated}`
            })}
          </p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.statsRow}>
            {COLS.map((col) => (
              <div key={col} className={styles.statBadge} style={{ borderColor: COL_COLORS[col] }}>
                <span style={{ color: COL_COLORS[col], fontWeight: 700 }}>{grouped[col].length}</span>
                <span className={styles.statLabel}>{getColLabel(col)}</span>
              </div>
            ))}
          </div>
          <button className={styles.refreshBtn} onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={16} className={isFetching ? styles.spin : ''} />
            <span>{t('clerk.refresh', 'Refresh')}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loadBox}>
          <RefreshCw size={24} className={styles.spin} color="#1e40af" />
          <span>{t('escalations.loadingEscalations', { state: assignedState, defaultValue: `Loading escalations for ${assignedState}...` })}</span>
        </div>
      ) : (
        <div className={styles.kanban}>
          {COLS.map((col) => {
            const Icon = COL_ICONS[col]
            return (
              <div key={col} className={styles.column}>
                <div className={styles.colHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={16} style={{ color: COL_COLORS[col] }} />
                    <span className={styles.colTitle}>{getColLabel(col)}</span>
                  </div>
                  <span className={styles.colCount} style={{ backgroundColor: `${COL_COLORS[col]}18`, color: COL_COLORS[col] }}>
                    {grouped[col].length}
                  </span>
                </div>
                <div className={styles.cards}>
                  {grouped[col].length === 0 && (
                    <div className={styles.emptyCol}>
                      {t('escalations.noEscalations', {
                        status: getColLabel(col),
                        state: assignedState,
                        defaultValue: `No ${col} escalations in ${assignedState}`
                      })}
                    </div>
                  )}
                  {grouped[col].map((esc) => {
                    const priority = esc.priority || 'MEDIUM'
                    const pCfg = PRIORITY_CONFIG[priority] || { color: '#b45309', bg: '#fef3c7' }
                    return (
                      <div key={esc.ticket_id || esc.application_number} className={styles.card}>
                        <div className={styles.cardTop}>
                          <span className={styles.priorityTag} style={{ background: pCfg.bg, color: pCfg.color }}>
                            {priority}
                          </span>
                          <span className={styles.timeAgo}>{timeAgo(esc.escalated_at || esc.created_at)}</span>
                        </div>
                        <div className={styles.cardAppHeader}>
                          <Link to={`/district/review/${esc.application_number}`} className={styles.appNum}>
                            {esc.application_number}
                            <ExternalLink size={12} />
                          </Link>
                          <span className={styles.stateTag}>
                            <MapPin size={10} /> {assignedState}
                          </span>
                        </div>
                        <p className={styles.serviceType}>{(esc.service_type || 'REVENUE SERVICE').replace(/_/g, ' ').toUpperCase()}</p>
                        {esc.escalation_reason && (
                          <div className={styles.reasonBox}>
                            <p className={styles.reason}>{esc.escalation_reason}</p>
                          </div>
                        )}
                        {esc.officer_summary && (
                          <div className={styles.summaryBox}>
                            <span className={styles.summaryLabel}>{t('escalations.handoffSummary', 'Handoff Summary:')}</span>
                            <p className={styles.summaryText}>{esc.officer_summary}</p>
                          </div>
                        )}
                        {col !== 'resolved' && (
                          <div className={styles.cardActions}>
                            <input
                              className={styles.noteInput}
                              placeholder={t('escalations.addResolutionNote', 'Add resolution note...')}
                              value={resolutionNotes[esc.application_number] || ''}
                              onChange={(e) =>
                                setResolutionNotes((prev) => ({
                                  ...prev,
                                  [esc.application_number]: e.target.value,
                                }))
                              }
                            />
                            <button
                              className={styles.resolveBtn}
                              onClick={() => {
                                mutation.mutate({
                                  appNumber: esc.application_number,
                                  status: 'APPROVED',
                                  note: resolutionNotes[esc.application_number] || 'Resolved by District Officer',
                                })
                              }}
                              disabled={mutation.isPending}
                            >
                              {t('escalations.resolve', 'Resolve')}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
