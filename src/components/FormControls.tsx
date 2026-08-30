import type { ButtonHTMLAttributes, InputHTMLAttributes } from 'react'

export function TextField({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`form-field ${className}`.trim()} {...props} />
}

export function PrimaryButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`primary-button ${className}`.trim()} {...props} />
}
