import { PillarLogoWithName } from "@/components/marketing/LandingPage/PillarLogoWithName";
import { Spinner } from "@/components/ui/spinner";

export default function SignupLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <PillarLogoWithName className="h-10" />
          </div>
          <div className="flex justify-center">
            <Spinner size="lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
