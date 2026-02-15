/**
 * Public API client for Agent Readiness Score.
 * No authentication — these are public endpoints.
 */

import axios from "axios";
import type { AgentScoreReport, ScanResponse } from "@/components/AgentScore/AgentScore.types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_PILLAR_API_URL || "http://localhost:8003";

const publicClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const agentScoreAPI = {
  /**
   * Start a scan for a URL. Returns existing report if domain was scanned recently.
   */
  scan: async (
    url: string,
    email?: string,
    testSignup: boolean = true,
    testOpenclaw: boolean = false,
    forceRescan: boolean = false,
  ): Promise<ScanResponse> => {
    const { data } = await publicClient.post<ScanResponse>(
      "/api/public/agent-score/scan/",
      { url, email, test_signup: testSignup, test_openclaw: testOpenclaw, force_rescan: forceRescan }
    );
    return data;
  },

  /**
   * Look up the latest completed report for a domain.
   * Returns the full report if one exists, or null if not found.
   */
  lookupByDomain: async (domain: string): Promise<AgentScoreReport | null> => {
    try {
      const { data } = await publicClient.get<AgentScoreReport>(
        "/api/public/agent-score/lookup-by-domain/",
        { params: { domain } }
      );
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get a report by ID. Poll this while status is pending/running.
   */
  getReport: async (reportId: string): Promise<AgentScoreReport> => {
    const { data } = await publicClient.get<AgentScoreReport>(
      `/api/public/agent-score/${reportId}/report/`
    );
    return data;
  },

  /**
   * Get the rrweb session recording for a report's signup test.
   * Returns an array of rrweb events for replay.
   */
  getRecording: async (reportId: string): Promise<unknown[]> => {
    const { data } = await publicClient.get<unknown[]>(
      `/api/public/agent-score/${reportId}/recording/`
    );
    return data;
  },
};
