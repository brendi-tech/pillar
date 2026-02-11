"use client";

import { Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";

// UI Component: Session Card with scroll animation
const SessionCard = () => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [seconds, setSeconds] = useState(1);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setIsVisible(true);
          setHasAnimated(true);
        }
      },
      { threshold: 0.5 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [hasAnimated]);

  // Animate the counter from 1 to 23
  useEffect(() => {
    if (!isVisible) return;

    const duration = 2000; // 2 seconds for full animation
    const targetSeconds = 23;
    const startTime = Date.now();
    let animationFrameId: number;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentSeconds = Math.floor(1 + progress * (targetSeconds - 1));
      setSeconds(currentSeconds);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isVisible]);

  return (
    <div ref={cardRef} className="bg-[#F9F7F2] rounded-lg border border-[#DCDDDD] w-[260px] h-[150px] overflow-hidden shadow-[0_3px_5px_rgba(0,0,0,0.08)]">
      <div className="text-sm text-gray-400 px-3 py-2">GET /user_data</div>
      <div className="bg-white border-t border-[#DCDDDD] p-3 h-full rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-gray-700">Your Session started</span>
          <span className="text-sm font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded">{seconds}s</span>
        </div>
        <div className="space-y-2">
          <div 
            className="h-2.5 bg-[#E8E0D5] rounded-full transition-all duration-[2000ms] ease-out"
            style={{ width: isVisible ? "100%" : "0%" }}
          />
          <div 
            className="h-2.5 bg-[#E8E0D5] rounded-full transition-all duration-[2000ms] ease-out"
            style={{ width: isVisible ? "70%" : "0%", transitionDelay: "200ms" }}
          />
          <div 
            className="h-2.5 bg-[#E8E0D5] rounded-full transition-all duration-[2000ms] ease-out"
            style={{ width: isVisible ? "45%" : "0%", transitionDelay: "400ms" }}
          />
        </div>
      </div>
    </div>
  );
};

// UI Component: Form Card
const FormCard = () => {
  const [isToggled, setIsToggled] = useState(true);
  const [firstName, setFirstName] = useState("Jonathan");
  const [lastName, setLastName] = useState("Smith");
  
  return (
    <div className="relative">
      <div className="flex gap-4 items-start -mt-2">
        {/* Form fields */}
        <div className="bg-white rounded-lg border border-[#DCDDDD] p-3 w-[200px] shadow-[0_3px_5px_rgba(0,0,0,0.08)]">
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-black/40 block mb-1">First Name</label>
              <input 
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="border border-gray-300 rounded-[6px] px-3 py-2 text-[14px] w-full outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-black/40 block mb-1">Last Name</label>
              <input 
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="border border-gray-300 rounded-[6px] px-3 py-2 text-[14px] w-full outline-none focus:border-gray-400"
              />
            </div>
          </div>
        </div>
        {/* Remember toggle */}
        <div className="bg-white rounded-lg border border-[#DCDDDD] p-4 ml-2 shadow-[0_3px_5px_rgba(0,0,0,0.08)] relative">
          <span className="text-[11px] font-bold text-gray-800 block mb-2">Remember?</span>
          <button 
            onClick={() => setIsToggled(!isToggled)}
            className={`w-14 h-7 rounded-full relative transition-colors duration-200 ${isToggled ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <div 
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${isToggled ? 'right-1' : 'left-1'}`} 
            />
          </button>
        </div>
      </div>
      {/* Code as background */}
      <div className="absolute top-1/2 right-[45px] -translate-y-1/2 text-[11px] text-black/10 font-mono whitespace-nowrap leading-relaxed -z-10">
        <div>3EE;</div>
        <div>1EBE3;</div>
        <div>#FFFFFF;</div>
        <div>B1B1B;</div>
        <div>--MUTED:#6B6B6B;</div>
      </div>
    </div>
  );
};

// UI Component: Speed Card (matches SessionCard style)
const SpeedCard = () => (
  <div className="bg-[#F9F7F2] rounded-lg border border-[#DCDDDD] w-[200px] h-[102px] overflow-hidden shadow-[0_3px_5px_rgba(0,0,0,0.08)]">
    <div className="text-sm text-gray-400 px-4 py-2">Positive response</div>
    <div className="bg-white border-t border-[#DCDDDD] px-4 py-3 h-full rounded-lg">
      <div className="h-2.5 bg-[#E8E0D5] rounded-full mb-2" />
      <div className="text-[11px] text-black/40">623kb in 1ms</div>
    </div>
  </div>
);

// UI Component: Infrastructure Card
const InfraCard = () => (
  <div className="relative">
    <div className="bg-white rounded-lg border border-[#DCDDDD] p-[10px] w-[260px] font-mono text-[11px] leading-[11px] shadow-[0_3px_5px_rgba(0,0,0,0.08)]">
      <div className="text-black">
        fetch(&apos;/api/orders/289/status&apos;, {"{"}
      </div>
      <div className="pl-3 text-[#1F7651]">
        method: &apos;GET&apos;,
      </div>
      <div className="pl-3 text-[#1F7651]">
        &apos;Authorization &lt;token&gt;&apos;,
      </div>
      <div className="pl-3">
        <span className="text-[#1F7651]">&apos;ContentType:</span>
        <span className="text-[#9D410E]"> application/json&apos;</span>
      </div>
      <div className="text-black">{"}"});</div>
      <div className="text-black">.then(response =&gt; response.json())</div>
      <div className="text-black">.then(data =&gt; console.log(data));</div>
    </div>
    <div className="absolute bottom-[-21px] right-3 bg-white rounded-[8px] border border-[#DCDDDD] pl-1 py-1 pr-[18px] flex items-center gap-2 whitespace-nowrap">
      <div className="w-6 h-5 rounded-[6px] bg-[#298F27]/10 flex items-center justify-center shrink-0">
        <Check className="w-3.5 h-3.5 text-[#298F27]" />
      </div>
      <span className="text-[11px] font-bold text-black">Data saved successfully!</span>
    </div>
  </div>
);

const ClientSideFeatures = () => {
  return (
    <div className="relative">
      {/* Desktop: UI components row */}
      <div className="absolute h-50 top-4 left-6 right-6 flex items-start justify-between isolate z-2 max-1300:hidden">
        {/* Session Card with connector */}
        <div className="shrink-0 translate-x-[-5px] relative">
          <SessionCard />
        </div>
        
        {/* Form Card */}
        <div className="shrink-0 relative z-2 translate-y-[10px] translate-x-[-15px]">
          <FormCard />
        </div>
        
        {/* Speed Card */}
        <div className="shrink-0 relative translate-y-[20px] translate-x-[-30px]">
          <SpeedCard />
        </div>
        
        {/* Infra Card */}
        <div className="shrink-0 translate-y-[20px] translate-x-[-15px]">
          <InfraCard />
        </div>
      </div>
      <div className="h-[1px] w-full bg-[#D4D4D4]" />
      <div className="grid grid-cols-4 *:border-r *:last:border-r-0 *:border-marketing relative max-1300:grid-cols-2 max-600:grid-cols-1">
        <div
          className="p-5 pt-50 max-1300:pt-5"
          style={{
            background: "linear-gradient(180deg, #F3EFE8 0%, #FFF 100%)",
          }}
        >
          {/* Mobile: show UI component */}
          <div className="h-[220px] items-center justify-center hidden max-1300:flex">
            <SessionCard />
          </div>
          <h3 className="font-semibold mb-2">Same Session = Real Power</h3>
          <p className="font-normal">
            Pillar runs in the user&apos;s browser with their session—and
            registers actions as WebMCP tools. No proxy servers, no token
            forwarding. When <code className="text-xs bg-black/5 px-1 py-0.5 rounded">navigator.modelContext</code> ships,
            your app is already wired.
          </p>
        </div>
        <div
          className="p-5 pt-50 max-1300:pt-5"
          style={{
            background: "linear-gradient(180deg, #F3EFE8 0%, #FFF 100%)",
          }}
        >
          <div className="h-[220px] items-center justify-center hidden max-1300:flex">
            <FormCard />
          </div>
          <h3 className="font-semibold mb-2">Full Control</h3>
          <p className="font-normal">
            Your actions are client defined. Re-use patterns, forms, and CSS
            that already exist. Inline in chat or directly as modals.
          </p>
        </div>
        <div
          className="p-5 pt-50 max-1300:pt-0"
          style={{
            background: "linear-gradient(180deg, #F3EFE8 0%, #FFF 100%)",
          }}
        >
          <div className="h-[220px] items-center justify-center hidden max-1300:flex">
            <SpeedCard />
          </div>
          <h3 className="font-semibold mb-2">Native Speed</h3>
          <p className="font-normal">
            UI actions happen locally, instantly. No round-trip to external
            servers. Feels native because it is native.
          </p>
        </div>
        <div
          className="p-5 pt-50 max-1300:pt-0"
          style={{
            background: "linear-gradient(180deg, #F3EFE8 0%, #FFF 100%)",
          }}
        >
          <div className="h-[220px] items-center justify-center hidden max-1300:flex pb-6">
            <InfraCard />
          </div>
          <h3 className="font-semibold mb-2">Your Infrastructure</h3>
          <p className="font-normal">
            Actions call your APIs with the user's existing auth. You control
            what's possible. Pillar just orchestrates.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClientSideFeatures;
