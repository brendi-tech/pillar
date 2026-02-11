import { DeployStepsAnimation } from "./DeployStepsAnimation";
import { GridBackground } from "./GridBackground";
import { NumberedHeading } from "./NumberedHeading";

export const DeploySection = () => {
  return (
    <div className="relative">
      {/* Full section background image */}
      <div 
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-full max-w-marketingSection"
        style={{
          backgroundImage: "url('/marketing/deploy-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      />
      <section className="max-w-marketingSection mx-auto border-x border-marketing relative p-6 pb-0">
        <div className="bg-white relative">
          <NumberedHeading className="bg-[#46280B] text-[#FFD446] absolute top-0 lg:left-[64px] left-1/2 -translate-x-1/2 lg:translate-x-0 z-10">
            [04] DEPLOY
          </NumberedHeading>

          <div className="relative">
            <GridBackground
              className="w-full h-full absolute top-0 left-0"
              gradients={[{ x: "0%", y: "50%", radius: "62%", color: "white" }]}
            />

            {/* Two Column Layout */}
            <div className="relative grid grid-cols-1 lg:grid-cols-2 lg:pt-0 pt-12 gap-4 px-6 md:px-12 lg:px-16">
              {/* Left Column - Text Content */}
              <div className="flex flex-col justify-center lg:items-start items-center">
                <h2 className="font-editorial text-4xl md:text-5xl lg:text-[3.5rem] xl:text-[3.875rem] lg:leading-[62px] text-[#1A1A1A]">
                  Deploy in{" "}
                  <span className="underline decoration-2 underline-offset-4">
                    minutes
                  </span>
                  ,
                  <br />
                  not days
                </h2>

                <div className="mt-8 space-y-6 text-[#1A1A1A] text-base md:text-lg leading-relaxed max-w-md">
                  <p>
                    Connect your existing content, define what users can
                    accomplish, and embed it in your product.
                  </p>
                  <p>
                    You&apos;re ready for users and agents and AI tools to build
                    off of—we handle the infrastructure complexity.
                  </p>
                </div>
              </div>

              {/* Right Column - Step Cards */}
              <DeployStepsAnimation />
            </div>
          </div>
        </div>
      </section>
      <div
        className="h-[128px] grid place-items-center max-w-marketingSection mx-auto border-x border-marketing relative"
      >
        <p className="text-center text-white text-sm bg-black/30 p-[10px] max-w-[620px] mx-auto">
          Define actions in your frontend. Same codebase, same deploy pipeline, same auth context.<br />
          Nothing new to operate.
        </p>
      </div>
    </div>
  );
};
