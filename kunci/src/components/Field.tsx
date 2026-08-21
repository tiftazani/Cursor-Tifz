import { useId, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { IconCopy, IconEye, IconEyeOff, IconSpark } from './Icons'

const SHIELD_ATTRS = {
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
} as const

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

export function TextInput({
  shieldAutofill = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { shieldAutofill?: boolean }) {
  const [readOnly, setReadOnly] = useState(shieldAutofill)
  const [acceptInput, setAcceptInput] = useState(!shieldAutofill)
  return (
    <input
      {...props}
      className={`input ${props.className ?? ''}`}
      autoComplete={shieldAutofill ? 'off' : props.autoComplete}
      readOnly={shieldAutofill ? readOnly : props.readOnly}
      {...(shieldAutofill ? SHIELD_ATTRS : {})}
      onFocus={(e) => {
        if (shieldAutofill) setReadOnly(false)
        props.onFocus?.(e)
      }}
      onKeyDown={(e) => {
        if (shieldAutofill) setAcceptInput(true)
        props.onKeyDown?.(e)
      }}
      onPaste={(e) => {
        if (shieldAutofill) setAcceptInput(true)
        props.onPaste?.(e)
      }}
      onChange={(e) => {
        if (shieldAutofill && !acceptInput) return
        props.onChange?.(e)
      }}
    />
  )
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input textarea ${props.className ?? ''}`} />
}

export function SecretInput({
  value,
  onChange,
  placeholder,
  onGenerate,
  onCopy,
  autoComplete = 'off',
  protectFromAutofill = true,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onGenerate?: () => void
  onCopy?: () => void
  autoComplete?: string
  protectFromAutofill?: boolean
}) {
  const [shown, setShown] = useState(false)
  const [readOnly, setReadOnly] = useState(protectFromAutofill)
  const [acceptInput, setAcceptInput] = useState(!protectFromAutofill)
  const id = useId()
  return (
    <div className="secret">
      <input
        id={id}
        name={`kunci-secret-${id.replace(/:/g, '')}`}
        className="input secret-input"
        type={shown ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        autoComplete={protectFromAutofill ? 'new-password' : autoComplete}
        readOnly={readOnly}
        {...SHIELD_ATTRS}
        onFocus={() => setReadOnly(false)}
        onKeyDown={() => setAcceptInput(true)}
        onPaste={() => setAcceptInput(true)}
        onChange={(e) => {
          if (protectFromAutofill && !acceptInput) return
          onChange(e.target.value)
        }}
      />
      <div className="secret-actions">
        {onGenerate ? (
          <button
            type="button"
            className="icon-btn"
            title="Buat password"
            onClick={() => {
              setReadOnly(false)
              setAcceptInput(true)
              onGenerate()
            }}
          >
            <IconSpark size={16} />
          </button>
        ) : null}
        <button type="button" className="icon-btn" title={shown ? 'Sembunyikan' : 'Tampilkan'} onClick={() => setShown((s) => !s)}>
          {shown ? <IconEyeOff size={16} /> : <IconEye size={16} />}
        </button>
        {onCopy ? (
          <button type="button" className="icon-btn" title="Salin" onClick={onCopy}>
            <IconCopy size={16} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: readonly { id: T; label: string }[]
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          className={`segmented-btn ${value === option.id ? 'active' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function StrengthBar({ score, label }: { score: number; label: string }) {
  return (
    <div className="strength">
      <div className="strength-track">
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} className={i <= score && score > 0 ? `on s${score}` : ''} />
        ))}
      </div>
      <span>{label}</span>
    </div>
  )
}
