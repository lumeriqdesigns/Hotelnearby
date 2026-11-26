import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState, Skeleton } from "@/components/feedback/loading-state";
import { StatePanel } from "@/components/feedback/state-panel";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardTitle } from "@/components/ui/card";
import { Container, Section } from "@/components/ui/container";
import { EditorialAccent } from "@/components/ui/editorial-accent";
import {
  CheckboxField,
  RadioGroup,
  SelectField,
  TextareaField,
  TextField,
} from "@/components/ui/form-fields";
import { ImageIcon } from "@/components/ui/icons";
import { NavLink } from "@/components/ui/nav-link";
import { Price } from "@/components/ui/price";
import { Heading, Prose, Text } from "@/components/ui/typography";
import { Wordmark } from "@/components/layout/wordmark";
import { getPublicEnv } from "@/lib/env/public";
import { SITE } from "@/lib/site";

import { DialogDemo, DropdownDemo, LoadingButtonDemo, MobileNavDemo } from "./demos";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const brandPalette = [
  { name: "Midnight Navy", hex: "#172B46", className: "bg-brand-navy", dark: true },
  { name: "Warm Ivory", hex: "#F5F2EB", className: "bg-brand-ivory", dark: false },
  { name: "Champagne Gold", hex: "#C9A66B", className: "bg-brand-champagne", dark: false },
  { name: "Charcoal", hex: "#252C35", className: "bg-brand-charcoal", dark: true },
  { name: "White", hex: "#FFFFFF", className: "bg-brand-white", dark: false },
  { name: "Mist Blue", hex: "#E9EDF2", className: "bg-brand-mist", dark: false },
];

const semantic = [
  { name: "background", className: "bg-background" },
  { name: "surface", className: "bg-surface" },
  { name: "surface-muted", className: "bg-surface-muted" },
  { name: "foreground", className: "bg-foreground" },
  { name: "muted-foreground", className: "bg-muted-foreground" },
  { name: "border", className: "bg-border" },
  { name: "input-border", className: "bg-input-border" },
  { name: "primary", className: "bg-primary" },
  { name: "accent", className: "bg-accent" },
  { name: "brand-surface", className: "bg-brand-surface" },
  { name: "success-bg", className: "bg-success-bg" },
  { name: "warning-bg", className: "bg-warning-bg" },
  { name: "danger-bg", className: "bg-danger-bg" },
  { name: "info-bg", className: "bg-info-bg" },
];

const typeScale = [
  { token: "display", sample: "Find places worth staying", cls: "text-display" },
  { token: "h1", sample: "Hotels and apartments in Ilorin", cls: "text-h1" },
  { token: "h2", sample: "Choose where to stay", cls: "text-h2" },
  { token: "h3", sample: "Facilities and house rules", cls: "text-h3" },
  { token: "h4", sample: "Nearby places", cls: "text-h4" },
];

const toc = [
  ["colour", "Colour"],
  ["typography", "Typography"],
  ["buttons", "Buttons"],
  ["forms", "Forms"],
  ["cards", "Cards, badges, price"],
  ["alerts", "Alerts"],
  ["overlays", "Dialog and menu"],
  ["navigation", "Navigation"],
  ["states", "Loading, empty, error"],
  ["layout", "Containers"],
] as const;

function Block({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="border-t py-12">
      <Heading as="h2" id={`${id}-title`}>
        {title}
      </Heading>
      {intro ? (
        <Text tone="muted" className="mt-2 max-w-prose">
          {intro}
        </Text>
      ) : null}
      <div className="mt-8 flex flex-col gap-8">{children}</div>
    </section>
  );
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <Heading as="h3" size="h4">
        {title}
      </Heading>
      {children}
    </div>
  );
}

export default function DesignSystemPage() {
  // Internal reference only. Not served on the live site.
  if (getPublicEnv().appEnv === "production") notFound();

  return (
    <>
      <Section tone="brand" spacing="md">
        <Container className="flex flex-col gap-4">
          <Heading as="h1" size="h1">
            Hotelnearby design system
          </Heading>
          <Text size="body-lg" className="max-w-2xl text-brand-surface-muted">
            Tokens and components for a modern, welcoming and trustworthy hospitality brand. Use the
            theme control in the header to check both themes. This page is internal and is not shown
            on the live site.
          </Text>
        </Container>
      </Section>

      <Container className="pb-20">
        <nav aria-label="On this page" className="py-6">
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {toc.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="text-small font-semibold text-primary underline underline-offset-4"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Block
          id="colour"
          title="Colour"
          intro="Six approved brand colours. Components use semantic tokens. The initial product experience uses a light theme only, with text and interface contrast checked against WCAG guidance."
        >
          <Sub title="Approved brand palette">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {brandPalette.map((c) => (
                <li key={c.hex} className="overflow-hidden rounded-md border">
                  <div className={`${c.className} h-20`} aria-hidden="true" />
                  <div className="bg-surface p-3">
                    <p className="text-small font-bold">{c.name}</p>
                    <p className="text-caption text-muted-foreground tabular-nums">{c.hex}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Sub>
          <Sub title="Semantic interface tokens">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {semantic.map((c) => (
                <li key={c.name} className="overflow-hidden rounded-md border">
                  <div className={`${c.className} h-12`} aria-hidden="true" />
                  <p className="bg-surface p-2 text-caption font-semibold">{c.name}</p>
                </li>
              ))}
            </ul>
          </Sub>
          <Sub title="Contrast rules">
            <Prose>
              <Text size="small" tone="muted">
                Champagne Gold is an accent and fill colour, never small text on a light background.
                Use the darker accent-text token for readable links and labels. Midnight Navy is the
                primary action and focus colour. The initial product experience is light-theme only.
              </Text>
            </Prose>
          </Sub>
        </Block>

        <Block
          id="typography"
          title="Typography"
          intro="Manrope is the primary face. DM Serif Display is reserved for rare editorial accents."
        >
          <Sub title="Scale">
            <div className="flex flex-col gap-5">
              {typeScale.map((t) => (
                <div key={t.token} className="flex flex-col gap-1 border-b pb-4">
                  <p className="text-caption font-semibold text-muted-foreground">text-{t.token}</p>
                  <p className={t.cls}>{t.sample}</p>
                </div>
              ))}
              <div className="flex flex-col gap-2">
                <Text size="body-lg">Body large. For introductions and key summaries.</Text>
                <Text>Body. The default for reading: 16px with a 1.65 line height.</Text>
                <Text size="small" tone="muted">
                  Small. Supporting text, hints and metadata.
                </Text>
                <Text size="caption" tone="muted">
                  Caption. The smallest size, never below 13px.
                </Text>
              </div>
            </div>
          </Sub>
          <Sub title="Editorial accent (DM Serif Display, sparingly)">
            <EditorialAccent
              as="blockquote"
              className="max-w-prose border-l-4 border-accent pl-5 italic"
            >
              A good stay starts long before you arrive.
            </EditorialAccent>
          </Sub>
          <Sub title="Naira and numerals">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardBody>
                  <p className="text-caption font-semibold text-muted-foreground">
                    Manrope (primary)
                  </p>
                  <p className="text-h2 font-extrabold tabular-nums" data-testid="naira-primary">
                    ₦6,000 ₦60,000 ₦100,000
                  </p>
                  <Text size="small" tone="muted">
                    Manrope has no Naira sign, so the browser borrows that one character from Plus
                    Jakarta Sans. Everything else stays in Manrope.
                  </Text>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <p className="text-caption font-semibold text-muted-foreground">
                    Plus Jakarta Sans (evaluated)
                  </p>
                  <p
                    className="text-h2 font-extrabold tabular-nums"
                    style={{ fontFamily: '"Plus Jakarta Sans Variable", sans-serif' }}
                  >
                    ₦6,000 ₦60,000 ₦100,000
                  </p>
                  <Text size="small" tone="muted">
                    Slightly wider and rounder. Good as a fallback, but Manrope stays primary.
                  </Text>
                </CardBody>
              </Card>
            </div>
          </Sub>
        </Block>

        <Block
          id="buttons"
          title="Buttons"
          intro="Use Button for actions and ButtonLink for navigation. Minimum touch height is 44px (36px for small)."
        >
          <Sub title="Variants">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <ButtonLink href="#buttons" variant="secondary">
                Link styled as button
              </ButtonLink>
            </div>
          </Sub>
          <Sub title="Sizes and states">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Disabled</Button>
              <LoadingButtonDemo />
            </div>
          </Sub>
        </Block>

        <Block
          id="forms"
          title="Forms"
          intro="Every control has a visible label, optional hint, and an error that is linked to it and announced. Inputs are 16px to avoid zoom on iPhones."
        >
          <div className="grid gap-6 md:grid-cols-2">
            <TextField
              label="Property name"
              hint="As guests know it."
              placeholder="Sample property"
              required
            />
            <TextField
              label="Email address"
              type="email"
              defaultValue="not-an-email"
              error="Enter an email address like name@example.com."
            />
            <SelectField label="Property type" defaultValue="">
              <option value="" disabled>
                Choose a type
              </option>
              <option>Hotel</option>
              <option>Serviced apartment</option>
              <option>Shortlet</option>
              <option>Guest house</option>
            </SelectField>
            <TextField label="Disabled field" disabled defaultValue="Cannot be edited" />
            <div className="md:col-span-2">
              <TextareaField label="Description" hint="Describe the property in your own words." />
            </div>
            <CheckboxField
              label="Show my WhatsApp number"
              hint="Visitors can message you directly."
            />
            <RadioGroup
              legend="Price basis"
              name="basis"
              defaultValue="night"
              options={[
                { value: "night", label: "Per night" },
                { value: "month", label: "Per month", hint: "For longer stays." },
              ]}
            />
          </div>
        </Block>

        <Block
          id="cards"
          title="Cards, badges and price"
          intro="Sample content for layout only. These are not listings."
        >
          <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card interactive>
              <div
                className="flex aspect-[4/3] items-center justify-center bg-surface-muted text-muted-foreground"
                role="img"
                aria-label="Image placeholder"
              >
                <ImageIcon size={32} />
              </div>
              <CardBody>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="featured">Sponsored</Badge>
                  <Badge variant="neutral">Shortlet</Badge>
                </div>
                <CardTitle>
                  <a href="#cards" className="after:absolute after:inset-0">
                    Sample property name
                  </a>
                </CardTitle>
                <Text size="small" tone="muted">
                  Sample area, Ilorin
                </Text>
                <Price kobo={1500000} basis="per night" />
              </CardBody>
              <CardFooter>
                <Text size="caption" tone="muted">
                  {SITE.priceDisclaimer}
                </Text>
              </CardFooter>
            </Card>
            <Card>
              <CardBody>
                <CardTitle>Plain card</CardTitle>
                <Text size="small" tone="muted">
                  Cards group related content. Use a stretched link in the title when the whole card
                  is clickable, so it remains a single tab stop.
                </Text>
              </CardBody>
            </Card>
          </div>
          <Sub title="Badges">
            <div className="flex flex-wrap gap-2">
              <Badge>Neutral</Badge>
              <Badge variant="brand">Brand</Badge>
              <Badge variant="featured">Sponsored</Badge>
              <Badge variant="success">Verified</Badge>
              <Badge variant="warning">Pending review</Badge>
              <Badge variant="danger">Rejected</Badge>
              <Badge variant="info">New</Badge>
            </div>
            <Text size="small" tone="muted">
              Meaning always comes from the words. A paid plan never earns the Verified badge.
            </Text>
          </Sub>
        </Block>

        <Block
          id="alerts"
          title="Alerts"
          intro="Warnings and errors are announced immediately. Information and success are announced politely."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Alert variant="info" title="Information">
              Prices may change. Contact the property to confirm.
            </Alert>
            <Alert variant="success" title="Saved">
              Your changes have been saved.
            </Alert>
            <Alert variant="warning" title="Needs attention">
              Your plan allows 8 photos. Remove one to add another.
            </Alert>
            <Alert variant="danger" title="Could not save">
              Check the highlighted fields and try again.
            </Alert>
          </div>
        </Block>

        <Block
          id="overlays"
          title="Dialog and dropdown menu"
          intro="Both are keyboard accessible. Try Tab, Arrow keys, Home, End, typing a letter and Escape."
        >
          <div className="flex flex-wrap items-start gap-6">
            <DialogDemo />
            <DropdownDemo />
          </div>
        </Block>

        <Block
          id="navigation"
          title="Navigation"
          intro="The current page is marked for assistive technology and shown with a filled background."
        >
          <Sub title="Links with current-page state">
            <nav aria-label="Design system demo" className="flex flex-wrap gap-1">
              <NavLink href="/design-system" exact>
                Design system
              </NavLink>
              <NavLink href="/">Home</NavLink>
            </nav>
          </Sub>
          <Sub title="Breadcrumbs">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Design system", href: "/design-system" },
                { label: "Navigation" },
              ]}
            />
          </Sub>
          <Sub title="Mobile menu">
            <MobileNavDemo />
          </Sub>
          <Sub title="Wordmark (temporary)">
            <div className="flex items-center gap-4">
              <Wordmark asLink={false} className="text-3xl" />
              <Text size="small" tone="muted">
                Temporary text-based wordmark. The approved rising-horizon logo has not been
                supplied, so no logo has been invented.
              </Text>
            </div>
          </Sub>
        </Block>

        <Block id="states" title="Loading, empty and error states">
          <Sub title="Loading">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border bg-surface">
                <LoadingState label="Loading properties" />
              </div>
              <div className="flex flex-col gap-3" aria-hidden="true">
                <Skeleton className="h-32" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            </div>
          </Sub>
          <Sub title="Empty">
            <EmptyState
              title="No properties yet"
              action={
                <ButtonLink href="#cards" variant="secondary">
                  Back to cards
                </ButtonLink>
              }
            >
              Properties appear here once providers register and are approved.
            </EmptyState>
          </Sub>
          <Sub title="Error panel (shared layout for error and not-found pages)">
            <div className="rounded-lg border bg-surface">
              <StatePanel
                title="Something went wrong"
                className="py-10"
                actions={<Button>Try again</Button>}
              >
                <p>We could not load this page. Try again in a moment.</p>
              </StatePanel>
            </div>
          </Sub>
        </Block>

        <Block
          id="layout"
          title="Containers"
          intro="Container sets the width and gutters: narrow (44rem) for reading, default (72rem) for pages, wide (84rem) for dashboards. Section adds vertical rhythm and a tone: default, muted or brand."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {(["default", "muted", "brand"] as const).map((tone) => (
              <Section key={tone} tone={tone} spacing="sm" className="rounded-lg border">
                <p className="px-4 font-bold">Section tone: {tone}</p>
              </Section>
            ))}
          </div>
        </Block>
      </Container>
    </>
  );
}
