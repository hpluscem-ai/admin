import { useEffect, useState } from 'react'
import { AdminApiError, isInvalidAdminSession } from '../adminAuth'
import { getLogisticsCompany, saveLogisticsCompany, LOGISTICS_LOAD_ERROR, type LogisticsCompany } from '../logisticsCompanies'
import {
  LogisticsForm,
  type LogisticsFormValues,
  type LogisticsSaveResult,
} from '../components/LogisticsForm'

type SaveLogisticsData = (
  values: LogisticsFormValues,
) => Promise<LogisticsSaveResult>

type LogisticsFormPageProps = {
  error?: string
  actionLabel: string
  initialValues?: LogisticsFormValues
  save?: SaveLogisticsData
  title: string
  titleId: string
}

function LogisticsFormPage({
  actionLabel,
  error,
  initialValues,
  save,
  title,
  titleId,
}: LogisticsFormPageProps) {
  return (
    <section className="form-page" aria-labelledby={titleId}>
      <h1 className="data-view__title" id={titleId}>{title}</h1>
      {error ? <p className="form-submit-error" role="alert">{error}</p> :
        <LogisticsForm actionLabel={actionLabel} initialValues={initialValues} save={save} />}
    </section>
  )
}

type LogisticsCreatePageProps = {
  save?: SaveLogisticsData
}

export function LogisticsCreatePage({ save = saveLogisticsCompany }: LogisticsCreatePageProps = {}) {
  return (
    <LogisticsFormPage
      actionLabel="물류사 데이터 등록"
      save={save}
      title="신규 물류사 데이터 추가"
      titleId="logistics-create-title"
    />
  )
}

type LogisticsEditPageProps = {
  id: string
  save?: SaveLogisticsData
}

export function LogisticsEditPage({ id, save }: LogisticsEditPageProps) {
  const [company, setCompany] = useState<LogisticsCompany | null>(null)
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    let active = true
    setCompany(null)
    setLoadError('')
    if (!id) {
      setLoadError('물류사를 찾을 수 없습니다.')
      return
    }
    void getLogisticsCompany(id).then((loaded) => {
      if (active) setCompany(loaded)
    }).catch((error: unknown) => {
      if (!active) return
      if (isInvalidAdminSession(error)) {
        window.location.hash = '/login'
        return
      }
      setLoadError(error instanceof AdminApiError && error.status === 404
        ? '물류사를 찾을 수 없습니다.' : LOGISTICS_LOAD_ERROR)
    })
    return () => { active = false }
  }, [id])
  if (!company && !loadError) return null
  return (
    <LogisticsFormPage
      actionLabel="물류사 데이터 수정"
      error={loadError}
      initialValues={company ?? undefined}
      save={save ?? ((values) => saveLogisticsCompany(values, id))}
      title="물류사 데이터 수정"
      titleId="logistics-edit-title"
    />
  )
}
