import Link from "next/link";

import { signUpWithEmail } from "@/app/(auth)/signup/actions";
import { SignupForm } from "@/app/(auth)/signup/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";

export default function SignupPage() {
  const configured = isSupabaseConfigured();

  return (
    <Card className="glass w-full max-w-md border-border/60 shadow-2xl shadow-primary/5">
      <CardHeader className="space-y-1">
        <CardTitle className="font-heading text-2xl tracking-tight">
          Create account
        </CardTitle>
        <CardDescription>
          Spin up your workspace. You will create or join an agency after
          sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!configured ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            Configure Supabase in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              .env.local
            </code>{" "}
            before registering.
          </p>
        ) : (
          <SignupForm action={signUpWithEmail} />
        )}
      </CardContent>
      <CardFooter className="text-sm">
        <p className="text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
