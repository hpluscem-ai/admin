import { useState, type FormEvent, type KeyboardEvent } from 'react'

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

type InfrastructureField = {
  inputMode?: 'decimal' | 'numeric'
  label: string
  name: keyof InfrastructureValues
  placeholder: string
  required: boolean
}

const fields: readonly InfrastructureField[] = [
  {
    name: 'station',
    label: '주유소 이름',
    placeholder: '주유소 이름을 입력해주세요.',
    required: true,
  },
  {
    name: 'pole',
    label: 'Pole',
    placeholder: 'Pole를 입력해주세요.',
    required: true,
  },
  {
    name: 'model',
    label: '모델명',
    placeholder: '모델명을 입력해주세요.',
    required: true,
  },
  {
    name: 'capacity',
    label: '용량',
    placeholder: '용량을 입력해주세요.',
    required: true,
    inputMode: 'numeric',
  },
  {
    name: 'address',
    label: '주소',
    placeholder: '주소를 입력해주세요.',
    required: true,
  },
  {
    name: 'latitude',
    label: '위도',
    placeholder: '위도를 입력해주세요.',
    required: true,
    inputMode: 'decimal',
  },
  {
    name: 'longitude',
    label: '경도',
    placeholder: '경도를 입력해주세요.',
    required: true,
    inputMode: 'decimal',
  },
  {
    name: 'note',
    label: '비고',
    placeholder: '비고를 입력해주세요.(ex. 셀프)',
    required: false,
  },
]

const emptyValues: InfrastructureValues = {
  address: '',
  capacity: '',
  latitude: '',
  longitude: '',
  model: '',
  note: '',
  pole: '',
  station: '',
}

type InfrastructureErrors = Partial<Record<keyof InfrastructureValues, string>>

function formatCapacity(value: string) {
  const digits = value.replace(/\D/g, '')

  if (!digits) {
    return ''
  }

  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}L`
}

function formatCoordinate(value: string) {
  const numericValue = value.replace(/[^\d.]/g, '')
  const decimalPointIndex = numericValue.indexOf('.')

  if (decimalPointIndex === -1) {
    return numericValue
  }

  return `${numericValue.slice(0, decimalPointIndex + 1)}${numericValue
    .slice(decimalPointIndex + 1)
    .replace(/\./g, '')}`
}

function formatFieldValue(name: keyof InfrastructureValues, value: string) {
  if (name === 'capacity') {
    return formatCapacity(value)
  }

  if (name === 'latitude' || name === 'longitude') {
    return formatCoordinate(value)
  }

  return value
}

function createInitialValues(initialValues: Partial<InfrastructureValues>) {
  return Object.fromEntries(
    Object.entries({ ...emptyValues, ...initialValues }).map(([name, value]) => [
      name,
      formatFieldValue(name as keyof InfrastructureValues, value),
    ]),
  ) as InfrastructureValues
}

function validateField(field: InfrastructureField, value: string) {
  if (field.required && !value.trim()) {
    return field.placeholder
  }

  if (
    value &&
    (field.name === 'latitude' || field.name === 'longitude') &&
    !/^\d+(?:\.\d+)?$/.test(value)
  ) {
    return `${field.label}를 숫자 형식으로 입력해주세요.`
  }

  return undefined
}

function getFormErrors(values: InfrastructureValues) {
  return fields.reduce<InfrastructureErrors>((errors, field) => {
    const error = validateField(field, values[field.name])

    if (error) {
      errors[field.name] = error
    }

    return errors
  }, {})
}

export function InfrastructureForm({ actionLabel, initialValues }: InfrastructureFormProps) {
  const isEditForm = initialValues !== undefined
  const [initialFormValues] = useState(() => createInitialValues(initialValues ?? {}))
  const [values, setValues] = useState(initialFormValues)
  const [errors, setErrors] = useState<InfrastructureErrors>({})

  const isValid = fields.every(
    (field) => validateField(field, values[field.name]) === undefined,
  )
  const hasChanges = fields.some(
    ({ name }) => values[name] !== initialFormValues[name],
  )
  const canSubmit = isValid && (!isEditForm || hasChanges)

  const updateField = (name: keyof InfrastructureValues, nextValue: string) => {
    const formattedValue = formatFieldValue(name, nextValue)

    setValues((currentValues) => ({
      ...currentValues,
      [name]: formattedValue,
    }))
    setErrors((currentErrors) => {
      if (!currentErrors[name]) {
        return currentErrors
      }

      return {
        ...currentErrors,
        [name]: undefined,
      }
    })
  }

  const handleCapacityKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const { selectionEnd, selectionStart, value } = event.currentTarget

    if (
      event.key === 'Backspace' &&
      value.endsWith('L') &&
      selectionStart === value.length &&
      selectionEnd === value.length
    ) {
      event.preventDefault()
      updateField('capacity', value.replace(/\D/g, '').slice(0, -1))
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors = getFormErrors(values)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    // 서버 API가 확정되면 이 지점에서 등록·수정 요청과 성공 후 이동을 연결한다.
  }

  return (
    <form className="infrastructure-form" onSubmit={handleSubmit} noValidate>
      <div className="form-fields">
        {fields.map((field) => {
          const error = errors[field.name]
          const errorId = `infrastructure-${field.name}-error`

          return (
            <div className="form-control" key={field.name}>
              <TextField
                name={field.name}
                value={values[field.name]}
                placeholder={field.placeholder}
                aria-label={field.label}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                inputMode={field.inputMode}
                required={field.required}
                onBlur={() => {
                  const nextError = validateField(field, values[field.name])
                  setErrors((currentErrors) => ({
                    ...currentErrors,
                    [field.name]: nextError,
                  }))
                }}
                onChange={(event) => updateField(field.name, event.target.value)}
                onKeyDown={field.name === 'capacity' ? handleCapacityKeyDown : undefined}
              />
              {error ? (
                <p className="form-field-error" id={errorId} role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
      <PrimaryButton type="submit" disabled={!canSubmit}>
        {actionLabel}
      </PrimaryButton>
    </form>
  )
}
