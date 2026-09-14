import { useRef, useState, type FormEvent } from 'react'
import logo from '../assets/hayan100-logo.png'
import { Footer } from '../components/Footer'
import { PrimaryButton, TextField } from '../components/FormControls'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s]).{8,}$/

const AUTHENTICATION_ERROR = '이메일 또는 비밀번호가 올바르지 않습니다.'
const LOGIN_REQUEST_ERROR = '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'

export type AdminLoginCredentials = {
  email: string
  password: string
}

export type AdminLoginResult = { ok: true } | { ok: false }

type LoginPageProps = {
  requestFailed?: boolean
  authenticate: (credentials: AdminLoginCredentials) => Promise<AdminLoginResult>
}

type FieldErrors = {
  email?: string
  password?: string
}

function validateEmail(value: string) {
  if (!value.trim()) return '이메일을 입력해주세요.'
  if (!EMAIL_PATTERN.test(value.trim())) return '올바른 이메일 형식을 입력해주세요.'
  return undefined
}

function validatePassword(value: string) {
  if (!value) return '비밀번호를 입력해주세요.'
  if (!PASSWORD_PATTERN.test(value)) {
    return '영문, 숫자, 특수문자를 포함하여 8자 이상 입력해주세요.'
  }
  return undefined
}

export function LoginPage({ authenticate, requestFailed = false }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState(requestFailed ? LOGIN_REQUEST_ERROR : '')
  const inFlight = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = Boolean(email.trim() && password) && !isSubmitting

  function handleEmailChange(value: string) {
    setEmail(value)
    setFieldErrors((current) => (current.email ? { ...current, email: undefined } : current))
    setSubmitError('')
  }

  function handlePasswordChange(value: string) {
    setPassword(value)
    setFieldErrors((current) => (current.password ? { ...current, password: undefined } : current))
    setSubmitError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return

    const nextErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    }
    setFieldErrors(nextErrors)
    setSubmitError('')

    if (nextErrors.email || nextErrors.password) return

    inFlight.current = true
    setIsSubmitting(true)

    try {
      const result = await authenticate({ email: email.trim(), password })

      if (!result.ok) {
        setSubmitError(AUTHENTICATION_ERROR)
        return
      }

      window.location.hash = '/dashboard'
    } catch {
      setSubmitError(LOGIN_REQUEST_ERROR)
    } finally {
      inFlight.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <main className="login-content">
        <div className="login-panel">
          <div className="login-brand">
            <img src={logo} alt="HAYAN100" />
            <p>하얀100 관리자 로그인</p>
          </div>
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="form-fields">
              <div className="form-control">
                <label className="form-field-label" htmlFor="admin-email">
                  이메일
                </label>
                <div className="form-field-feedback">
                  <TextField
                    id="admin-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="이메일을 입력해주세요."
                    value={email}
                    required
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'admin-email-error' : undefined}
                    onChange={(event) => handleEmailChange(event.target.value)}
                    onBlur={() =>
                      setFieldErrors((current) => ({ ...current, email: validateEmail(email) }))
                    }
                  />
                  {fieldErrors.email ? (
                    <p className="form-field-error" id="admin-email-error" role="alert">
                      {fieldErrors.email}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="form-control">
                <label className="form-field-label" htmlFor="admin-password">
                  비밀번호
                </label>
                <div className="form-field-feedback">
                  <TextField
                    id="admin-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="비밀번호를 입력해주세요."
                    value={password}
                    required
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? 'admin-password-error' : undefined}
                    onChange={(event) => handlePasswordChange(event.target.value)}
                    onBlur={() =>
                      setFieldErrors((current) => ({
                        ...current,
                        password: validatePassword(password),
                      }))
                    }
                  />
                  {fieldErrors.password ? (
                    <p className="form-field-error" id="admin-password-error" role="alert">
                      {fieldErrors.password}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <PrimaryButton type="submit" disabled={!canSubmit}>
              {isSubmitting ? '로그인 중...' : '로그인'}
            </PrimaryButton>
            {submitError ? (
              <p className="login-form__error" role="alert">
                {submitError}
              </p>
            ) : null}
          </form>
        </div>
      </main>
      <Footer />
    </div>
  )
}
