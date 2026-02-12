/**
 * Type declarations for rrweb-player.
 *
 * rrweb-player is a Svelte component that works with vanilla JS
 * by passing a target DOM element and props.
 */
declare module "rrweb-player" {
  interface RRWebPlayerOptions {
    target: HTMLElement;
    props: {
      events: unknown[];
      width?: number;
      height?: number;
      autoPlay?: boolean;
      showController?: boolean;
      speed?: number;
      speedOption?: number[];
      skipInactive?: boolean;
      tags?: Record<string, string>;
    };
  }

  class RRWebPlayer {
    constructor(options: RRWebPlayerOptions);
    play(): void;
    pause(): void;
    toggle(): void;
    setSpeed(speed: number): void;
    toggleSkipInactive(): void;
    triggerResize(): void;
    getReplayer(): unknown;
    getMirror(): unknown;
    getMetaData(): { startTime: number; endTime: number; totalTime: number };
    addEventListener(event: string, handler: (params: unknown) => void): void;
    addEvent(event: unknown): void;
    $destroy(): void;
  }

  export default RRWebPlayer;
}

declare module "rrweb-player/dist/style.css" {
  const content: string;
  export default content;
}
