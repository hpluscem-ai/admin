import { InfrastructureForm, type InfrastructureValues } from '../components/InfrastructureForm'

const values: InfrastructureValues = {
  station: '역삼주유소',
  pole: 'GS칼텍스',
  model: 'HG500S',
  capacity: '2,000L',
  address: '서울 강남구 역삼로 134',
  latitude: '37.5012',
  longitude: '127.0365',
  note: '셀프',
}

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

export function InfrastructureEditPage() {
  return <InfrastructureFormPage title="인프라 데이터 수정" titleId="infrastructure-edit-title" actionLabel="인프라 데이터 수정" initialValues={values} />
}
