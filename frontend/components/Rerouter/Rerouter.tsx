"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface Props {
  route: string;
}

/**
 * Component that performs a client-side redirect on mount.
 * Use this for soft navigation instead of window.location.href.
 */
export const Rerouter = ({ route }: Props) => {
  const router = useRouter();
  useEffect(() => {
    router.push(route);
  }, [router, route]);
  return null;
};

