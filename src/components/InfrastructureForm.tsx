import { navigate } from '../navigation'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

import { isInvalidAdminSession } from '../adminAuth'

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

export type InfrastructureSaveResult =
  | { ok: true }
  | { message?: string; ok: false }

type InfrastructureFormProps = {
  actionLabel: string
  initialValues?: Partial<InfrastructureValues>
  save?: (values: InfrastructureValues) => Promise<InfrastructureSaveResult>
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
    label: '주유소명',
    placeholder: '주유소명을 입력해주세요.',
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
    placeholder: '용량을 입력해주세요. (단위: L)',
    required: true,
    inputMode: 'numeric',
  },
  {
    name: 'address',
    label: '주소',
    placeholder: '시군구를 포함한 도로명 주소를 입력해주세요.',
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
  const sign = value.startsWith('-') ? '-' : ''
  const numericValue = value.replace(/[^\d.]/g, '')
  const decimalPointIndex = numericValue.indexOf('.')

  if (decimalPointIndex === -1) {
    return `${sign}${numericValue}`
  }

  return `${sign}${numericValue.slice(0, decimalPointIndex + 1)}${numericValue
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
  return { ...emptyValues, ...initialValues }
}

function validateField(field: InfrastructureField, value: string) {
  if (field.required && !value.trim()) {
    return field.placeholder
  }

  if (
    value &&
    (field.name === 'latitude' || field.name === 'longitude') &&
    !/^-?\d+(?:\.\d+)?$/.test(value)
  ) {
    return `${field.label}를 숫자 형식으로 입력해주세요.`
  }

  if (
    field.name === 'address' &&
    value &&
    !/[가-힣]+(?:시|군|구)(?:\s|$)/.test(value.trim())
  ) {
    return '시/군/구가 포함된 주소를 입력해주세요.'
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

export function InfrastructureForm({
  actionLabel,
  initialValues,
  save,
}: InfrastructureFormProps) {
  const isEditForm = initialValues !== undefined
  const [initialFormValues] = useState(() => createInitialValues(initialValues ?? {}))
  const [values, setValues] = useState(initialFormValues)
  const [errors, setErrors] = useState<InfrastructureErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)
  const submitting = useRef(false)
  const lifetime = useRef<object | null>(null)
  useEffect(() => {
    lifetime.current = {}
    return () => { lifetime.current = null }
  }, [])

  const hasAllRequiredValues = fields.every(
    (field) => !field.required || Boolean(values[field.name].trim()),
  )
  const hasChanges = fields.some(
    ({ name }) => values[name] !== initialFormValues[name],
  )
  const canSubmit = isEditForm ? hasChanges : hasAllRequiredValues

  const updateField = (name: keyof InfrastructureValues, nextValue: string) => {
    if (submitting.current) return
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
    setSubmitError('')
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current || !lifetime.current) return

    const nextErrors = getFormErrors(values)
    setErrors(nextErrors)
    setSubmitError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    if (!save) {
      setSubmitError('인프라 데이터 저장 서버 연동이 필요합니다.')
      return
    }

    const owner = lifetime.current
    const routePath = window.location.pathname
    const isCurrent = () => lifetime.current === owner && window.location.pathname === routePath
    submitting.current = true
    setSaving(true)
    try {
      const result = await save(values)
      if (!isCurrent()) return

      if (!result.ok) {
        setSubmitError(result.message ?? '인프라 데이터를 저장하지 못했습니다.')
        return
      }

      navigate('/infrastructure')
    } catch (error) {
      if (!isCurrent()) return
      if (isInvalidAdminSession(error)) {
        navigate('/login')
        return
      }
      setSubmitError('인프라 데이터 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      if (isCurrent()) {
        submitting.current = false
        setSaving(false)
      }
    }
  }

  return (
    <form className="infrastructure-form" onSubmit={handleSubmit} noValidate>
      <div className="form-fields">
        {fields.map((field) => {
          const error = errors[field.name]
          const fieldId = `infrastructure-${field.name}`
          const errorId = `infrastructure-${field.name}-error`

          return (
            <div className="form-control" key={field.name}>
              <label className="form-field-label" htmlFor={fieldId}>
                {field.label}
              </label>
              <div className="form-field-feedback">
                <TextField
                  disabled={saving}
                  id={fieldId}
                  name={field.name}
                  value={values[field.name]}
                  placeholder={field.placeholder}
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
            </div>
          )
        })}
      </div>
      <PrimaryButton type="submit" disabled={!canSubmit || saving}>
        {actionLabel}
      </PrimaryButton>
      {submitError ? (
        <p className="form-submit-error" role="alert">
          {submitError}
        </p>
      ) : null}
    </form>
  )
}
