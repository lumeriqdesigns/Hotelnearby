import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { requireAuthenticatedUser } from "@/features/auth/authorization";
import { MfaSetup } from "@/features/auth/mfa-setup";

export default async function Page() {
  const { supabase, profile } = await requireAuthenticatedUser();
  const [{ data: factorData }, { data: assurance }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const factors = (factorData?.totp ?? []).map((factor) => ({ id: factor.id, factor_type: factor.factor_type, status: factor.status, friendly_name: factor.friendly_name }));
  return <Section spacing="lg"><Container size="narrow">
    <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-accent-text">Account security</p>
    <Heading as="h1" size="display">Security settings</Heading>
    <Text size="body-lg" tone="muted" className="mt-4">Optional multi-factor authentication adds another verification step when signing in.</Text>
    <div className="mt-7 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <div className="mb-6 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-surface-muted p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Email verification</p><p className="mt-1 font-bold">{profile.email_verified_at ? "Verified" : "Not verified"}</p></div><div className="rounded-lg bg-surface-muted p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Current session assurance</p><p className="mt-1 font-bold">{assurance?.currentLevel === "aal2" ? "AAL2 · MFA verified" : "AAL1 · Password/session"}</p></div></div>
      <h2 className="mb-2 text-lg font-extrabold">Authenticator app</h2>
      <MfaSetup initialFactors={factors}/>
      <p className="mt-5 text-xs leading-5 text-muted-foreground">Keep your authenticator device secure. Removing your only factor reduces account protection. Recovery and email verification still depend on your Supabase project’s Auth settings.</p>
    </div>
  </Container></Section>;
}
