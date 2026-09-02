import {
  LogisticsForm,
  type LogisticsFormValues,
  type LogisticsSaveResult,
} from '../components/LogisticsForm'

type SaveLogisticsData = (
  values: LogisticsFormValues,
) => Promise<LogisticsSaveResult>

type LogisticsFormPageProps = {
  actionLabel: string
  initialValues?: LogisticsFormValues
  save?: SaveLogisticsData
  title: string
  titleId: string
}

function LogisticsFormPage({
  actionLabel,
  initialValues,
  save,
  title,
  titleId,
}: LogisticsFormPageProps) {
  return (
    <section className="form-page" aria-labelledby={titleId}>
      <h1 className="data-view__title" id={titleId}>{title}</h1>
      <LogisticsForm actionLabel={actionLabel} initialValues={initialValues} save={save} />
    </section>
  )
}

type LogisticsCreatePageProps = {
  save?: SaveLogisticsData
}

export function LogisticsCreatePage({ save }: LogisticsCreatePageProps = {}) {
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
  initialValues: LogisticsFormValues
  save?: SaveLogisticsData
}

export function LogisticsEditPage({ initialValues, save }: LogisticsEditPageProps) {
  return (
    <LogisticsFormPage
      actionLabel="물류사 데이터 수정"
      initialValues={initialValues}
      save={save}
      title="물류사 데이터 수정"
      titleId="logistics-edit-title"
    />
  )
}
