import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { clearItalianValidity, setItalianValidity } from '@/lib/form-validity-it'

export function SignUp() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    const res = await signUp(email, password)
    setLoading(false)
    if (res.error) {
      setError(res.error)
    } else {
      setInfo(
        'Account creato. Se la conferma email è attiva, controlla la tua casella, poi accedi.',
      )
      setTimeout(() => navigate('/auth/signin'), 2500)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            MyHealthy<span className="text-primary">Life</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Crea il tuo account.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" lang="it">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
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
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearItalianValidity(e.currentTarget)
              }}
              onInvalid={(e) => setItalianValidity(e.currentTarget)}
            />
            <p className="text-xs text-muted-foreground">Minimo 6 caratteri.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-success">{info}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creazione…' : 'Crea account'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Hai già un account?{' '}
          <Link to="/auth/signin" className="text-primary hover:underline">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  )
}
