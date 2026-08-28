/**
 * React hooks for VoteMash API integration
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

interface Battle {
  id: string;
  leagueId: string;
  participantA: {
    id: string;
    name: string;
    slug: string;
    logo: string;
    description: string;
  };
  participantB: {
    id: string;
    name: string;
    slug: string;
    logo: string;
    description: string;
  };
  votesA: number;
  votesB: number;
  totalVotes: number;
  percentageA: number;
  percentageB: number;
  leagueEndAt: string;
}

interface VoteResult {
  winner: string;
  votesA: number;
  votesB: number;
  percentageA: number;
  percentageB: number;
  totalVotes: number;
}

interface LeaderboardEntry {
  rank: number;
  participant: {
    id: string;
    name: string;
    slug: string;
    logo: string;
    description: string;
    type: string;
  };
  rating: number;
  wins: number;
  losses: number;
  battleCount: number;
  votesReceived: number;
  winRate: number;
  movement: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  total: number;
  leagueEndsAt: string;
}

/**
 * Hook to fetch the next eligible battle
 */
export function useNextBattle(categoryId?: string) {
  const [battle, setBattle] = useState<Battle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categoryId) params.append('categoryId', categoryId);

      const response = await fetch(`/api/battles/next?${params}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setBattle(data.data);
      } else {
        setBattle(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch battle');
      setBattle(null);
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    const fetchBattle = window.setTimeout(() => {
      void refetch();
    }, 0);

    return () => window.clearTimeout(fetchBattle);
    // refetch is intentionally recreated on each render; categoryId controls this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  return { battle, loading, error, refetch };
}

/**
 * Hook to submit a vote
 */
export function useVote(battleId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VoteResult | null>(null);

  const vote = async (participantId: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/battles/${battleId}/vote`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }

      if (data.success && data.data) {
        setResult(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const reset = window.setTimeout(() => {
      setResult(null);
      setError(null);
    }, 0);

    return () => window.clearTimeout(reset);
  }, [battleId]);

  return { vote, loading, error, result };
}

/**
 * Hook to fetch the leaderboard
 */
export function useLeaderboard(categoryId?: string, limit: number = 50) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categoryId) params.append('categoryId', categoryId);
      params.append('limit', String(limit));

      const response = await fetch(`/api/leaderboard?${params}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const responseData = await response.json();

      if (responseData.success && responseData.data) {
        setData(responseData.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [categoryId, limit]);

  useEffect(() => {
    const fetchLeaderboard = window.setTimeout(() => {
      void refetch();
    }, 0);

    return () => window.clearTimeout(fetchLeaderboard);
    // refetch is intentionally recreated on each render; these inputs control this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, limit]);

  return { data, loading, error, refetch };
}
