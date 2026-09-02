import { useState, type FormEvent } from 'react'

import chevronDownIcon from '../assets/chevron-down.svg'
import { PrimaryButton, TextField } from './FormControls'

export type LogisticsFormValues = {
  accountHolder: string
  accountNumber: string
  bank: string
  businessAddress: string
  businessName: string
  businessNumber: string
  corporateRegistrationNumber: string
  managerName: string
  managerPhone: string
}

export type LogisticsSaveResult =
  | { ok: true }
  | { message?: string; ok: false }

type LogisticsFormProps = {
  actionLabel: string
  initialValues?: LogisticsFormValues
  save?: (values: LogisticsFormValues) => Promise<LogisticsSaveResult>
}

type LogisticsField = {
  inputMode?: 'numeric'
  label: string
  name: keyof LogisticsFormValues
  placeholder: string
  type: 'select' | 'text'
}

const fields: readonly LogisticsField[] = [
  {
    name: 'businessName',
    label: '사업자명',
    placeholder: '사업자명을 입력해주세요.',
    type: 'text',
  },
  {
    name: 'businessNumber',
    label: '사업자번호',
    placeholder: '사업자번호를 입력해주세요.',
    inputMode: 'numeric',
    type: 'text',
  },
  {
    name: 'corporateRegistrationNumber',
    label: '법인등록번호',
    placeholder: '법인등록번호를 입력해주세요.',
    inputMode: 'numeric',
    type: 'text',
  },
  {
    name: 'businessAddress',
    label: '사업장소재지',
    placeholder: '사업장소재지를 입력해주세요.',
    type: 'text',
  },
  {
    name: 'managerName',
    label: '담당자명',
    placeholder: '담당자명을 입력해주세요.',
    type: 'text',
  },
  {
    name: 'managerPhone',
    label: '담당자연락처',
    placeholder: '담당자연락처를 입력해주세요.',
    inputMode: 'numeric',
    type: 'text',
  },
  {
    name: 'accountNumber',
    label: '계좌번호',
    placeholder: '계좌번호를 입력해주세요.',
    inputMode: 'numeric',
    type: 'text',
  },
  {
    name: 'bank',
    label: '은행',
    placeholder: '은행을 선택해주세요.',
    type: 'select',
  },
  {
    name: 'accountHolder',
    label: '예금주',
    placeholder: '예금주를 입력해주세요.',
    type: 'text',
  },
]

const bankOptions = [
  '국민은행',
  '신한은행',
  '하나은행',
  '우리은행',
  '농협은행',
  '기업은행',
  'SC제일은행',
  '대구은행',
  '부산은행',
  '광주은행',
  '제주은행',
  '전북은행',
  '경남은행',
  '수협은행',
  '산업은행',
  '카카오뱅크',
  '토스뱅크',
] as const

const emptyValues: LogisticsFormValues = {
  accountHolder: '',
  accountNumber: '',
  bank: '',
  businessAddress: '',
  businessName: '',
  businessNumber: '',
  corporateRegistrationNumber: '',
  managerName: '',
  managerPhone: '',
}

type LogisticsErrors = Partial<Record<keyof LogisticsFormValues, string>>

function getDigits(value: string, maximumLength?: number) {
  const digits = value.replace(/\D/g, '')

  return maximumLength === undefined ? digits : digits.slice(0, maximumLength)
}

function formatBusinessNumber(value: string) {
  const digits = getDigits(value, 10)

  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

function formatCorporateRegistrationNumber(value: string) {
  const digits = getDigits(value, 13)

  if (digits.length <= 6) return digits
  return `${digits.slice(0, 6)}-${digits.slice(6)}`
}

function formatPhone(value: string) {
  const digits = getDigits(value, 11)

  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function formatFieldValue(name: keyof LogisticsFormValues, value: string) {
  if (name === 'businessNumber') return formatBusinessNumber(value)
  if (name === 'corporateRegistrationNumber') {
    return formatCorporateRegistrationNumber(value)
  }
  if (name === 'managerPhone') return formatPhone(value)
  if (name === 'accountNumber') return getDigits(value)

  return value
}

function createInitialValues(initialValues?: LogisticsFormValues) {
  if (!initialValues) return emptyValues

  return Object.fromEntries(
    Object.entries(initialValues).map(([name, value]) => [
      name,
      formatFieldValue(name as keyof LogisticsFormValues, value),
    ]),
  ) as LogisticsFormValues
}

function validateField(field: LogisticsField, value: string) {
  if (!value.trim()) return field.placeholder

  if (field.name === 'businessNumber' && !/^\d{3}-\d{2}-\d{5}$/.test(value)) {
    return '사업자번호를 XXX-XX-XXXXX 형식으로 입력해주세요.'
  }

  if (
    field.name === 'corporateRegistrationNumber' &&
    !/^\d{6}-\d{7}$/.test(value)
  ) {
    return '법인등록번호를 XXXXXX-XXXXXXX 형식으로 입력해주세요.'
  }

  if (
    field.name === 'businessAddress' &&
    !/[가-힣]+(?:시|군|구)(?:\s|$)/.test(value.trim())
  ) {
    return '시/군/구가 포함된 사업장소재지를 입력해주세요.'
  }

  if (field.name === 'managerPhone' && !/^010-\d{4}-\d{4}$/.test(value)) {
    return '담당자연락처를 010-XXXX-XXXX 형식으로 입력해주세요.'
  }

  if (field.name === 'accountNumber' && !/^\d+$/.test(value)) {
    return '계좌번호는 숫자만 입력해주세요.'
  }

  return undefined
}

function getFormErrors(values: LogisticsFormValues) {
  return fields.reduce<LogisticsErrors>((errors, field) => {
    const error = validateField(field, values[field.name])

    if (error) errors[field.name] = error

    return errors
  }, {})
}

/** 물류사 데이터의 신규 등록과 기존 데이터 수정을 같은 필드 규칙으로 처리한다. */
export function LogisticsForm({ actionLabel, initialValues, save }: LogisticsFormProps) {
  const isEditForm = initialValues !== undefined
  const [initialFormValues] = useState(() => createInitialValues(initialValues))
  const [values, setValues] = useState(initialFormValues)
  const [errors, setErrors] = useState<LogisticsErrors>({})
  const [submitError, setSubmitError] = useState('')

  const hasAllValues = fields.every(({ name }) => Boolean(values[name].trim()))
  const hasChanges = fields.some(({ name }) => values[name] !== initialFormValues[name])
  const canSubmit = isEditForm ? hasChanges : hasAllValues

  const updateField = (name: keyof LogisticsFormValues, nextValue: string) => {
    setValues((currentValues) => ({
      ...currentValues,
      [name]: formatFieldValue(name, nextValue),
    }))
    setErrors((currentErrors) => {
      if (!currentErrors[name]) return currentErrors

      return {
        ...currentErrors,
        [name]: undefined,
      }
    })
    setSubmitError('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors = getFormErrors(values)
    setErrors(nextErrors)
    setSubmitError('')

    if (Object.keys(nextErrors).length > 0) return

    if (!save) {
      setSubmitError('물류사 데이터 저장 서버 연동이 필요합니다.')
      return
    }

    try {
      const result = await save(values)

      if (!result.ok) {
        setSubmitError(result.message ?? '물류사 데이터를 저장하지 못했습니다.')
        return
      }

      window.location.hash = '/settlements'
    } catch {
      setSubmitError('물류사 데이터 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  return (
    <form className="logistics-form" onSubmit={handleSubmit} noValidate>
      <div className="form-fields">
        {fields.map((field) => {
          const error = errors[field.name]
          const errorId = `logistics-${field.name}-error`

          return (
            <div className="form-control" key={field.name}>
              {field.type === 'select' ? (
                <div className="logistics-form__select-field">
                  <select
                    aria-describedby={error ? errorId : undefined}
                    aria-invalid={Boolean(error)}
                    aria-label={field.label}
                    className="form-field logistics-form__select"
                    name={field.name}
                    onBlur={() => {
                      const nextError = validateField(field, values[field.name])
                      setErrors((currentErrors) => ({
                        ...currentErrors,
                        [field.name]: nextError,
                      }))
                    }}
                    onChange={(event) => updateField(field.name, event.target.value)}
                    required
                    value={values[field.name]}
                  >
                    <option disabled value="">
                      {field.placeholder}
                    </option>
                    {bankOptions.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </select>
                  <span className="logistics-form__select-icon" aria-hidden="true">
                    <img src={chevronDownIcon} alt="" />
                  </span>
                </div>
              ) : (
                <TextField
                  aria-describedby={error ? errorId : undefined}
                  aria-invalid={Boolean(error)}
                  aria-label={field.label}
                  inputMode={field.inputMode}
                  name={field.name}
                  onBlur={() => {
                    const nextError = validateField(field, values[field.name])
                    setErrors((currentErrors) => ({
                      ...currentErrors,
                      [field.name]: nextError,
                    }))
                  }}
                  onChange={(event) => updateField(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  required
                  value={values[field.name]}
                />
              )}
              {error ? (
                <p className="form-field-error" id={errorId} role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
      <PrimaryButton disabled={!canSubmit} type="submit">
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
