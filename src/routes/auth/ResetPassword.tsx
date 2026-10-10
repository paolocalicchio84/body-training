import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { clearItalianValidity, setItalianValidity } from '@/lib/form-validity-it'

export function ResetPassword() {
  const { session, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  // Supabase puts the recovery session in the URL hash; AuthProvider
  // picks it up via onAuthStateChange / getSession.
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 400)
    return () => window.clearTimeout(t)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('La password deve avere almeno 8 caratteri.')
      return
    }
    if (password !== confirm) {
      setError('Le password non coincidono.')
      return
    }
    setLoading(true)
    const res = await updatePassword(password)
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
            Imposta una nuova password.
          </p>
        </div>

        {ready && !session ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">
              Link di recupero non valido o scaduto. Richiedine uno nuovo dalla
              pagina di accesso.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth/signin">Torna all'accesso</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" lang="it">
            <div className="space-y-2">
              <Label htmlFor="password">Nuova password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  clearItalianValidity(e.currentTarget)
                }}
                onInvalid={(e) => setItalianValidity(e.currentTarget)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Conferma password</Label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value)
                  clearItalianValidity(e.currentTarget)
                }}
                onInvalid={(e) => setItalianValidity(e.currentTarget)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !session}>
              {loading ? 'Salvataggio…' : 'Salva nuova password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
