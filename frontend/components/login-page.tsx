'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { APP_TITLE, APP_TAGLINE } from '@/lib/branding'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@/components/ui/primitives'
import { Loader2, Truck } from 'lucide-react'

export default function LoginPage() {
  const { login, isLoading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials')
    } finally {
      setSubmitting(false)
    }
  }

  const busy = isLoading || submitting

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/15 ring-1 ring-secondary/30">
            <Truck className="h-7 w-7 text-secondary" />
          </div>
          <h1 className="font-serif-display text-3xl font-semibold text-foreground">{APP_TITLE}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{APP_TAGLINE}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? (
                <div className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">{error}</div>
              ) : null}
              <div>
                <Label>Email or Username</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} required disabled={busy} />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={busy} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
