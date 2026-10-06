import { useState, type FormEvent } from "react"

import { BrandMark } from "@/components/brand-mark"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"

import { useLogin } from "./api"

export function LoginPage() {
  const login = useLogin()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  const error = !login.error
    ? null
    : login.error instanceof ApiError && login.error.isUnauthorized
      ? "That username and password don't match."
      : login.error instanceof ApiError && login.error.status < 500
        ? login.error.message
        : "Couldn't reach the server. Try again."

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    login.mutate({ username, password })
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-muted/30 p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <Card className="relative w-full max-w-sm shadow-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <CardHeader className="justify-items-center text-center">
            <BrandMark className="mb-2 size-11 rounded-xl [&_svg]:size-5" />
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to see what's been released.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  aria-invalid={error ? true : undefined}
                  autoFocus
                  required
                />
              </Field>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={error ? true : undefined}
                  required
                />
                {error && <FieldError>{error}</FieldError>}
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending && <Spinner data-icon="inline-start" />}
              Sign in
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
