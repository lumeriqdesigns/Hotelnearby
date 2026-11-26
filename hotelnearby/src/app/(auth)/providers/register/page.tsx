import { Heading, Text } from "@/components/ui/typography";
import { RegisterForm } from "@/features/auth/auth-forms";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";

export default function Page() {
  return <AuthSplitLayout eyebrow="HOTELNEARBY · PARTNER PORTAL" title="Bring your hospitality business closer to every traveller."><p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-accent-text">For accommodation providers</p><Heading as="h2" size="display">Create your provider account</Heading><Text size="body-lg" tone="muted" className="mt-4">Register your accommodation business as the owner. You can manage listings after signing in and completing provider setup.</Text><div className="hotel-glass-panel mt-8 rounded-2xl p-6 sm:p-8"><RegisterForm defaultAccountType="provider_owner" /></div></AuthSplitLayout>;
}
