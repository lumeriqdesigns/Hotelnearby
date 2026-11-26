import { StatePanel } from "@/components/feedback/state-panel";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <StatePanel
      title="We could not find that page"
      actions={<ButtonLink href="/">Go to the homepage</ButtonLink>}
    >
      <p>The link may be old or mistyped.</p>
    </StatePanel>
  );
}
