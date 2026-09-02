import { InfrastructureForm, type InfrastructureValues } from '../components/InfrastructureForm'

type InfrastructureFormPageProps = {
  actionLabel: string
  initialValues?: InfrastructureValues
  title: string
  titleId: string
}

function InfrastructureFormPage({ actionLabel, initialValues, title, titleId }: InfrastructureFormPageProps) {
  return (
    <section className="form-page" aria-labelledby={titleId}>
      <h1 className="data-view__title" id={titleId}>{title}</h1>
      <InfrastructureForm actionLabel={actionLabel} initialValues={initialValues} />
    </section>
  )
}

export function InfrastructureCreatePage() {
  return <InfrastructureFormPage title="신규 인프라 데이터 등록" titleId="infrastructure-create-title" actionLabel="인프라 데이터 등록" />
}

type InfrastructureEditPageProps = {
  initialValues: InfrastructureValues
}

export function InfrastructureEditPage({ initialValues }: InfrastructureEditPageProps) {
  return <InfrastructureFormPage title="인프라 데이터 수정" titleId="infrastructure-edit-title" actionLabel="인프라 데이터 수정" initialValues={initialValues} />
}
