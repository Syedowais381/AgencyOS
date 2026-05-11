import Link from "next/link";

import { signInWithEmail, signInWithGoogle } from "@/app/(auth)/login/actions";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ setup?: string; error?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const params = searchParams ? await searchParams : undefined;

  return (
    <Card className="glass w-full max-w-md border-border/60 shadow-2xl shadow-primary/5">
      <CardHeader className="space-y-1">
        <CardTitle className="font-heading text-2xl tracking-tight">
          Sign in
        </CardTitle>
        <CardDescription>
          Agency Operating System — intelligence dashboard for your team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {params?.setup === "1" ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Dashboard routes require Supabase environment variables. Add them to{" "}
            <code className="text-xs">.env.local</code> and restart the dev server.
          </p>
        ) : null}
        {params?.error === "oauth" || params?.error === "auth" ? (
          <p className="text-destructive text-sm" role="alert">
            Authentication failed. Try again or use email sign-in.
          </p>
        ) : null}
        {!configured ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            Copy{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              .env.example
            </code>{" "}
            to{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>{" "}
            and add your Supabase URL and anon key, then restart the dev server.
          </p>
        ) : (
          <>
            <LoginForm action={signInWithEmail} />
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="border-border w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card text-muted-foreground px-2">Or</span>
              </div>
            </div>
            <form action={signInWithGoogle}>
              <Button type="submit" variant="outline" className="w-full">
                Continue with Google
              </Button>
            </form>
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">
          New here?{" "}
          <Link
            href="/signup"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
