export interface Step {
  id: number;
  title: string;
  description: string;
  optional?: boolean;
}

export type FrameworkId = "react" | "vue" | "angular" | "vanilla";

export type SubdomainStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid";

export type StepState = "completed" | "active" | "locked";

export interface InlineOnboardingStepsProps {
  initialStep: number;
  redirectTo?: string;
}

export interface StepSectionProps {
  step: Step;
  state: StepState;
  isLast: boolean;
  onToggle: () => void;
  isExpanded: boolean;
  children: React.ReactNode;
}
