'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface DashboardMetrics {
  conversations: {
    total: number;
    OPEN: number;
    ASSIGNED: number;
    RESOLVED: number;
    ARCHIVED: number;
  };
  messages: {
    total: number;
    today: number;
    inboundToday: number;
    outboundToday: number;
  };
}

export interface ConversationMetrics {
  newConversationsLast7Days: number;
  newConversationsLast30Days: number;
  resolvedLast7Days: number;
  newConversationsInPeriod: number;
  resolvedInPeriod: number;
  avgFirstResponseTimeMs: number;
  avgFirstResponseTimeFormatted: string;
}

export interface AgentMetric {
  id: string;
  name: string;
  activeConversations: number;
  totalAssignments: number;
  totalMessagesSent: number;
}

export type MetricsPeriod = '1d' | '7d' | '30d' | '90d';

export function useDashboardMetrics(period: MetricsPeriod = '30d') {
  return useQuery<DashboardMetrics>({
    queryKey: ['metrics', 'dashboard', period],
    queryFn: async () => {
      const { data } = await apiClient.get('/metrics/dashboard', { params: { period } });
      return data;
    },
    refetchInterval: 30000,
  });
}

export function useConversationMetrics(period: MetricsPeriod = '30d') {
  return useQuery<ConversationMetrics>({
    queryKey: ['metrics', 'conversations', period],
    queryFn: async () => {
      const { data } = await apiClient.get('/metrics/conversations', { params: { period } });
      return data;
    },
    refetchInterval: 60000,
  });
}

export function useAgentMetrics(period: MetricsPeriod = '30d') {
  return useQuery<AgentMetric[]>({
    queryKey: ['metrics', 'agents', period],
    queryFn: async () => {
      const { data } = await apiClient.get('/metrics/agents', { params: { period } });
      return data;
    },
    refetchInterval: 30000,
  });
}
