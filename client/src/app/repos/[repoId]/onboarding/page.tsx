/* /repos/:repoId/onboarding — Onboarding Tour. Thin page wrapper, mirrors
   /repos/:repoId/conventions/page.tsx. NOT the same route as /onboarding
   (no :repoId) — the pre-existing add-repository screen, left untouched. */
import { OnboardingTourView } from "./_components/OnboardingTourView";

export default function OnboardingTourPage() {
  return <OnboardingTourView />;
}
