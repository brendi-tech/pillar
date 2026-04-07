"use client";

import ClientSideFeatures from "./ClientSideFeatures";
import { GridBackground } from "./GridBackground";
import { NumberedHeading } from "./NumberedHeading";

export const ClientSideSection = () => {
  return (
    <div>
      <section className=" border-x border-marketing max-w-marketingSection mx-auto bg-white">
        <div className="flex justify-center">
          <NumberedHeading className="bg-[#14314B] text-[#00CCFF]">
            [03] EVERY CHANNEL
          </NumberedHeading>
        </div>
        <div className="pt-8 pb-12">
<h2 className="font-editorial text-3xl md:text-5xl lg:text-[3.875rem] lg:leading-[62px] text-center">
            One brain, every surface
          </h2>
          <p className="text-center text-base sm:text-lg md:text-xl max-w-4xl mx-auto px-4 md:px-0 mt-4">
            In-app copilot runs in the user&apos;s browser. Slack and Discord
            call your backend APIs. MCP exposes tools to any client.
            One agent brain powers all of them.
          </p>
        </div>
        <ClientSideFeatures />
      </section>
      <div className="relative">
        <div
          className="h-[1px] w-full"
          style={{
            background: "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
          }}
        />
        <div className="relative max-w-marketingSection mx-auto bg-white h-[71px] border-x border-marketing">
          <GridBackground
            className="w-full h-full absolute top-0 left-0"
            gradients={[
              {
                x: "50%",
                y: "30%",
                radius: "45%",
                color: "white",
              },
            ]}
          />
        </div>
        <div
          className="h-[1px] w-full"
          style={{
            background: "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
          }}
        />
      </div>
    </div>
  );
};
