import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { clearItalianValidity, setItalianValidity } from '@/lib/form-validity-it'

export function SignIn() {
  const { signIn, resetPasswordForEmail } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    if (resetMode) {
      const res = await resetPasswordForEmail(email)
      setLoading(false)
      if (res.error) setError(res.error)
      else {
        setInfo(
          'Se esiste un account con questa email, riceverai un link per impostare una nuova password. Controlla anche lo spam.',
        )
      }
      return
    }
    const res = await signIn(email, password)
    setLoading(false)
    if (res.error) setError(res.error)
    else navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            MyHealthy<span className="text-primary">Life</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {resetMode
              ? 'Recupera l’accesso al tuo companion.'
              : 'Accedi al tuo companion benessere.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" lang="it">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                clearItalianValidity(e.currentTarget)
              }}
              onInvalid={(e) => setItalianValidity(e.currentTarget)}
            />
          </div>
          {!resetMode && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setResetMode(true)
                    setError(null)
                    setInfo(null)
                  }}
                >
                  Password dimenticata?
                </button>
              </div>
              <Input
                ref={passwordRef}
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  clearItalianValidity(e.currentTarget)
                }}
                onInvalid={(e) => setItalianValidity(e.currentTarget)}
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-muted-foreground">{info}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? resetMode
                ? 'Invio in corso…'
                : 'Accesso in corso…'
              : resetMode
                ? 'Invia link di recupero'
                : 'Accedi'}
          </Button>
          {resetMode && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setResetMode(false)
                setError(null)
                setInfo(null)
              }}
            >
              Torna all’accesso
            </Button>
          )}
        </form>
        {!resetMode && (
          <>
            <p className="text-center text-sm text-muted-foreground">
              Non hai ancora un account?{' '}
              <Link to="/auth/signup" className="text-primary hover:underline">
                Registrati
              </Link>
            </p>
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              Uso personale: salva la password in iCloud Keychain / Gestore
              password Google. Se il link email non arriva, puoi anche resettare
              da Supabase → Authentication → Users.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
