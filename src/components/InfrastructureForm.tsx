import { PrimaryButton, TextField } from './FormControls'

export type InfrastructureValues = {
  address: string
  capacity: string
  latitude: string
  longitude: string
  model: string
  note: string
  pole: string
  station: string
}

type InfrastructureFormProps = {
  actionLabel: string
  initialValues?: Partial<InfrastructureValues>
}

const fields: readonly [keyof InfrastructureValues, string][] = [
  ['station', '주유소 이름을 입력해주세요.'],
  ['pole', 'Pole를 입력해주세요.'],
  ['model', '모델명을 입력해주세요.'],
  ['capacity', '용량을 입력해주세요.'],
  ['address', '주소를 입력해주세요.'],
  ['latitude', '위도를 입력해주세요.'],
  ['longitude', '경도를 입력해주세요.'],
  ['note', '비고를 입력해주세요.(ex. 셀프)'],
]

export function InfrastructureForm({ actionLabel, initialValues = {} }: InfrastructureFormProps) {
  return (
    <form className="infrastructure-form" onSubmit={(event) => event.preventDefault()}>
      <div className="form-fields">
        {fields.map(([name, placeholder]) => (
          <TextField
            key={name}
            name={name}
            defaultValue={initialValues[name]}
            placeholder={placeholder}
            aria-label={placeholder}
          />
        ))}
      </div>
      <PrimaryButton type="submit">{actionLabel}</PrimaryButton>
    </form>
  )
}
