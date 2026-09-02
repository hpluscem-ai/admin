import {
  InfrastructureForm,
  type InfrastructureSaveResult,
  type InfrastructureValues,
} from '../components/InfrastructureForm'

type SaveInfrastructureData = (
  values: InfrastructureValues,
) => Promise<InfrastructureSaveResult>

type InfrastructureFormPageProps = {
  actionLabel: string
  initialValues?: InfrastructureValues
  save?: SaveInfrastructureData
  title: string
  titleId: string
}

function InfrastructureFormPage({
  actionLabel,
  initialValues,
  save,
  title,
  titleId,
}: InfrastructureFormPageProps) {
  return (
    <section className="form-page" aria-labelledby={titleId}>
      <h1 className="data-view__title" id={titleId}>{title}</h1>
      <InfrastructureForm
        actionLabel={actionLabel}
        initialValues={initialValues}
        save={save}
      />
    </section>
  )
}

type InfrastructureCreatePageProps = {
  save?: SaveInfrastructureData
}

export function InfrastructureCreatePage({ save }: InfrastructureCreatePageProps = {}) {
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
  initialValues: InfrastructureValues
  save?: SaveInfrastructureData
}

export function InfrastructureEditPage({
  initialValues,
  save,
}: InfrastructureEditPageProps) {
  return (
    <InfrastructureFormPage
      actionLabel="인프라 데이터 수정"
      initialValues={initialValues}
      save={save}
      title="인프라 데이터 수정"
      titleId="infrastructure-edit-title"
    />
  )
}
