import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Search,
  Filter,
  ArrowUpDown,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  MapPin,
  ShieldCheck,
} from 'lucide-react'
import useAuthStore from '../../store/authStore'
import { applicationsApi } from '../../api/applications'
import { STATUS_CONFIG } from '../../utils/constants'
import styles from './DistrictApplications.module.css'

const formatServiceName = (name, id = '', t) => {
  if (id && t) {
    const key = `services.${id}.name`
    const translated = t(key, '')
    if (translated && translated !== key) return translated
  }
  if (!name) return (id || '').replace(/_/g, ' ')
  if (typeof name === 'object') return name.en || Object.values(name)[0] || id
  return String(name).replace(/_/g, ' ')
}

const STATUS_FILTERS = [
  { id: 'DISTRICT_OFFICER_APPROVAL', labelKey: 'districtOfficerApproval', label: 'District Officer Approval' },
  { id: 'SUBMITTED', labelKey: 'submittedQueue', label: 'Submitted (Queue)' },
  { id: 'APPROVED', labelKey: 'approved', label: 'Approved' },
  { id: 'COMPLETED', labelKey: 'completed', label: 'Completed' },
  { id: 'ALL', labelKey: 'allApplications', label: 'All Applications' },
]

export default function DistrictApplications() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const assignedState = user?.state || 'Maharashtra'

  const [searchParams, setSearchParams] = useSearchParams()
  const initialStatus = searchParams.get('status') || STATUS_FILTERS[0].id

  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [searchTerm, setSearchTerm] = useState('')
  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const limit = 15

  const currentLang = i18n.language || 'en'
  const localeMap = {
    hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN', te: 'te-IN', ta: 'ta-IN',
    gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', en: 'en-IN'
  }
  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString(localeMap[currentLang] || 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['district-apps-list', assignedState, statusFilter, serviceFilter, searchTerm, sortBy, page],
    queryFn: () =>
      applicationsApi.getAdminList({
        state: assignedState,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        service_id: serviceFilter !== 'ALL' ? serviceFilter : undefined,
        search: searchTerm.trim() || undefined,
        sort_by: sortBy,
        page,
        limit,
      }),
    refetchInterval: 10000,
  })

  const { data: servicesData } = useQuery({
    queryKey: ['services-list'],
    queryFn: applicationsApi.listServices,
  })

  const applications = data?.applications || []
  const total = data?.total || 0
  const totalPages = data?.total_pages || 1
  const statusCounts = data?.status_counts || {}

  const handleStatusChange = (st) => {
    setStatusFilter(st)
    setPage(1)
    if (st === 'ALL') {
      searchParams.delete('status')
    } else {
      searchParams.set('status', st)
    }
    setSearchParams(searchParams)
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerTag}>
            <MapPin size={13} color="#1e40af" />
            <span>{t('district.districtWorkstationTag', { state: assignedState, defaultValue: `District Officer Administration • ${assignedState} Jurisdiction` })}</span>
          </div>
          <h1 className={styles.title}>{t('district.districtApplicationsDir', 'District Applications Directory')}</h1>
          <p className={styles.subtitle}>
            {t('district.districtApplicationsSub', { state: assignedState, defaultValue: `Citizen revenue applications originating from ${assignedState} state jurisdiction.` })}
          </p>
        </div>
        <button
          className={styles.refreshBtn}
          onClick={() => refetch()}
          disabled={isFetching}
          title={t('clerk.refreshTooltip', 'Refresh applications')}
        >
          <RefreshCw size={16} className={isFetching ? styles.spin : ''} />
          <span>{t('clerk.refresh', 'Refresh')}</span>
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className={styles.tabsWrapper}>
        <div className={styles.tabsList}>
          {STATUS_FILTERS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tabBtn} ${statusFilter === tab.id ? styles.activeTab : ''}`}
              onClick={() => handleStatusChange(tab.id)}
            >
              <span>{t(`clerk.${tab.labelKey}`, t(`common.${tab.labelKey}`, tab.label))}</span>
              {statusCounts[tab.id] !== undefined && (
                <span className={styles.tabBadge}>{statusCounts[tab.id]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Secondary Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t('clerk.searchPlaceholder', 'Search by Tracking ID, citizen name, phone, or Aadhaar...')}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <div className={styles.selectGroup}>
          <div className={styles.filterItem}>
            <Filter size={15} color="#64748b" />
            <select
              className={styles.selectInput}
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">{t('clerk.allServices', 'All Services')}</option>
              {(servicesData?.services || []).map((srv) => (
                <option key={srv.id} value={srv.id}>
                  {formatServiceName(srv.name, srv.id, t)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterItem}>
            <ArrowUpDown size={15} color="#64748b" />
            <select
              className={styles.selectInput}
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value)
                setPage(1)
              }}
            >
              <option value="newest">{t('clerk.newestFirst', 'Newest First')}</option>
              <option value="oldest">{t('clerk.oldestFirst', 'Oldest First')}</option>
              <option value="readiness">{t('clerk.readinessSort', 'Readiness (High to Low)')}</option>
              <option value="updated">{t('clerk.recentlyUpdated', 'Recently Updated')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Applications Table */}
      <div className={styles.tableCard}>
        {isLoading ? (
          <div className={styles.loadingBox}>
            <RefreshCw size={24} className={styles.spin} color="#1e40af" />
            <p>{t('clerk.loadingApplicationsState', { state: assignedState, defaultValue: `Loading applications for ${assignedState}...` })}</p>
          </div>
        ) : applications.length === 0 ? (
          <div className={styles.emptyBox}>
            <FileCheck size={40} color="#94a3b8" />
            <p className={styles.emptyTitle}>{t('clerk.noAppsFoundState', { state: assignedState, defaultValue: `No applications found in ${assignedState}` })}</p>
            <p className={styles.emptySubtitle}>{t('clerk.tryChangingFilter', 'Try changing the status filter or search keywords.')}</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('clerk.colTrackingId', 'Tracking ID')}</th>
                <th>{t('clerk.colCitizenDetails', 'Citizen Details')}</th>
                <th>{t('clerk.colServiceType', 'Service Name')}</th>
                <th>{t('clerk.colAssignedState', 'Jurisdiction')}</th>
                <th>{t('clerk.colCurrentStatus', 'Status')}</th>
                <th>{t('district.colMatchScore', 'Match Score')}</th>
                <th>{t('clerk.colRiskLevel', 'Risk Level')}</th>
                <th>{t('clerk.colSubmittedDate', 'Submitted')}</th>
                <th>{t('clerk.colAction', 'Action')}</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const conf = STATUS_CONFIG[app.status] || {
                  label: app.status,
                  color: '#475569',
                  bg: '#f1f5f9',
                }

                return (
                  <tr key={app.id}>
                    <td>
                      <span className={styles.trackingId}>
                        {app.tracking_id || app.application_number}
                      </span>
                    </td>
                    <td>
                      <div className={styles.citizenCell}>
                        <span className={styles.citizenName}>
                          {app.applicant_name || app.citizen_name || 'Citizen'}
                        </span>
                        <span className={styles.citizenRef}>{app.citizen_ref}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.serviceName}>
                        {formatServiceName(app.service_name, app.service_id, t)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.stateBadge}>
                        <MapPin size={11} />
                        {app.state || assignedState}
                      </span>
                    </td>
                    <td>
                      <span
                        className={styles.statusBadge}
                        style={{ color: conf.color, backgroundColor: conf.bg }}
                      >
                        {conf.label || app.status}
                      </span>
                    </td>
                    <td>
                      {app.match_score !== null && app.match_score !== undefined ? (
                        <span className={styles.scoreText}>{app.match_score}%</span>
                      ) : (
                        <span className={styles.scoreNull}>—</span>
                      )}
                    </td>
                    <td>
                      {app.risk_level ? (
                        <span
                          className={`${styles.riskBadge} ${
                            app.risk_level === 'HIGH'
                              ? styles.riskHigh
                              : app.risk_level === 'MEDIUM'
                              ? styles.riskMedium
                              : styles.riskLow
                          }`}
                        >
                          {app.risk_level}
                        </span>
                      ) : (
                        <span className={styles.scoreNull}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={styles.dateText}>
                        {formatDate(app.submitted_at)}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/district/review/${app.application_number || app.id}`}
                        className={styles.actionBtn}
                        title={t('clerk.review', 'Review and verify application')}
                      >
                        <span>{t('clerk.review', 'Review')}</span>
                        <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>
            {t('clerk.paginationText', {
              start: (page - 1) * limit + 1,
              end: Math.min(page * limit, total),
              total,
              defaultValue: `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total} applications`
            })}
          </span>
          <div className={styles.pageBtns}>
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={16} />
              <span>{t('clerk.previous', 'Previous')}</span>
            </button>
            <span className={styles.pageNumber}>
              {t('clerk.pageOf', { current: page, total: totalPages, defaultValue: `Page ${page} of ${totalPages}` })}
            </span>
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <span>{t('clerk.next', 'Next')}</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
