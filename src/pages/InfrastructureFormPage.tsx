import { navigate } from '../navigation'
import { useEffect, useState } from 'react'
import { AdminApiError, isInvalidAdminSession } from '../adminAuth'
import { NoticeDialog } from '../components/ConfirmationDialog'
import { getStation, getStationValues, saveStation, STATIONS_LOAD_ERROR, type Station } from '../stations'
import {
  InfrastructureForm,
  type InfrastructureSaveResult,
  type InfrastructureValues,
} from '../components/InfrastructureForm'

type SaveInfrastructureData = (
  values: InfrastructureValues,
) => Promise<InfrastructureSaveResult>

type InfrastructureFormPageProps = {
  error?: string
  onRetry?: () => void
  actionLabel: string
  initialValues?: InfrastructureValues
  save?: SaveInfrastructureData
  title: string
  titleId: string
}

function InfrastructureFormPage({
  actionLabel,
  error,
  onRetry,
  initialValues,
  save,
  title,
  titleId,
}: InfrastructureFormPageProps) {
  return (
    <section className="form-page" aria-labelledby={titleId}>
      <h1 className="data-view__title" id={titleId}>{title}</h1>
      {error ? <NoticeDialog message={error} onClose={() => navigate('/infrastructure')} onRetry={onRetry} /> : <InfrastructureForm
        actionLabel={actionLabel}
        initialValues={initialValues}
        save={save}
      />}
    </section>
  )
}

type InfrastructureCreatePageProps = {
  save?: SaveInfrastructureData
}

export function InfrastructureCreatePage({ save = saveStation }: InfrastructureCreatePageProps = {}) {
  return (
    <InfrastructureFormPage
      actionLabel="인프라 데이터 등록"
      save={save}
      title="신규 인프라 데이터 등록"
      titleId="infrastructure-create-title"
    />
  )
}

type InfrastructureEditPageProps = {
  id: string
  save?: SaveInfrastructureData
}

export function InfrastructureEditPage({
  id,
  save,
}: InfrastructureEditPageProps) {
  const [station, setStation] = useState<Station | null>(null)
  const [loadError, setLoadError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    setStation(null)
    setLoadError('')
    if (!id) { setLoadError('주유소를 찾을 수 없습니다.'); return }
    void getStation(id).then((loaded) => {
      if (active) setStation(loaded)
    }).catch((error: unknown) => {
      if (!active) return
      if (isInvalidAdminSession(error)) navigate('/login')
      else setLoadError(error instanceof AdminApiError && error.status === 404
        ? '주유소를 찾을 수 없습니다.' : STATIONS_LOAD_ERROR)
    })
    return () => { active = false }
  }, [id, refresh])
  if (!station && !loadError) return null
  return (
    <InfrastructureFormPage
      actionLabel="인프라 데이터 수정"
      error={loadError}
      onRetry={() => setRefresh(current => current + 1)}
      initialValues={station ? getStationValues(station) : undefined}
      save={save ?? ((values) => saveStation(values, station ?? undefined))}
      title="인프라 데이터 수정"
      titleId="infrastructure-edit-title"
    />
  )
}
