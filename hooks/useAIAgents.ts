'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { useOfficeStore } from '../stores/useOfficeStore';

// ─── Types ───────────────────────────────────────────────────────
export interface AIAgent {
    id: string;
    org_id: string;
    name: string;
    display_name?: string;
    role: string;
    personality?: string;
    capabilities: string[];
    system_prompt?: string;
    avatar_url?: string;
    is_active: boolean;
    provider: 'openai' | 'anthropic' | 'google' | 'custom';
    model: string;
    type: 'assistant' | 'reviewer' | 'sdr' | 'support' | 'custom';
    current_room_id?: string;
    status: 'idle' | 'working' | 'responding' | 'offline';
    config: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface AIMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    agent_id: string;
    timestamp: string;
}

// ─── Store additions ─────────────────────────────────────────────
// We'll store AI state in the hook itself since Zustand store doesn't have it yet.
// This keeps the hook self-contained.

/**
 * useAIAgents — Manages AI agent lifecycle, chat, and room assignment
 *
 * - Fetches active agents for the workspace from Supabase
 * - Subscribes to realtime updates on ai_agents table
 * - Provides `sendMessage(agentId, message)` for chat
 * - Provides `assignToRoom(agentId, roomId)` for room assignment
 * - Falls back to a mock AI response if no Edge Function is configured
 */
export function useAIAgents() {
    const supabase = createClient();
    const { activeSpaceId } = useOfficeStore();

    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [messages, setMessages] = useState<Record<string, AIMessage[]>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

    const channelRef = useRef<any>(null);

    // ─── Fetch agents for this workspace ─────────────────────
    const fetchAgents = useCallback(async () => {
        if (!activeSpaceId) return;

        try {
            // Get org_id from the active space
            const { data: space } = await supabase
                .from('spaces')
                .select('org_id')
                .eq('id', activeSpaceId)
                .single();

            if (!space) return;

            const { data, error } = await supabase
                .from('ai_agents')
                .select('*')
                .eq('org_id', space.org_id)
                .eq('is_active', true)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('[AI Agents] Failed to fetch:', error);
                return;
            }

            setAgents(data || []);

            // Auto-select first agent if none selected
            if (data && data.length > 0 && !activeAgentId) {
                setActiveAgentId(data[0].id);
            }
        } catch (err) {
            console.error('[AI Agents] Error:', err);
        }
    }, [supabase, activeSpaceId, activeAgentId]);

    // ─── Realtime subscription ───────────────────────────────
    useEffect(() => {
        if (!activeSpaceId) return;

        fetchAgents();

        // Subscribe to realtime changes
        const channel = supabase
            .channel('ai_agents_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ai_agents',
                },
                (payload) => {
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        setAgents((prev) => {
                            const existing = prev.findIndex((a) => a.id === payload.new.id);
                            if (existing >= 0) {
                                const updated = [...prev];
                                updated[existing] = payload.new as AIAgent;
                                return updated;
                            }
                            return [...prev, payload.new as AIAgent];
                        });
                    }
                    if (payload.eventType === 'DELETE') {
                        setAgents((prev) => prev.filter((a) => a.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, activeSpaceId, fetchAgents]);

    // ─── Send message to agent ───────────────────────────────
    const sendMessage = useCallback(
        async (agentId: string, content: string) => {
            if (!content.trim()) return;

            const agent = agents.find((a) => a.id === agentId);
            if (!agent) return;

            // Add user message
            const userMessage: AIMessage = {
                id: `msg-${Date.now()}-user`,
                role: 'user',
                content,
                agent_id: agentId,
                timestamp: new Date().toISOString(),
            };

            setMessages((prev) => ({
                ...prev,
                [agentId]: [...(prev[agentId] || []), userMessage],
            }));

            // Mark agent as responding
            setAgents((prev) =>
                prev.map((a) => (a.id === agentId ? { ...a, status: 'responding' as const } : a))
            );

            setIsLoading(true);

            try {
                // Try Edge Function first, fall back to local mock
                let response: string;

                try {
                    const { data, error } = await supabase.functions.invoke('ai-chat', {
                        body: {
                            agentId,
                            message: content,
                            systemPrompt: agent.system_prompt,
                            provider: agent.provider,
                            model: agent.model,
                            history: (messages[agentId] || []).slice(-10),
                        },
                    });

                    if (error) throw error;
                    response = data?.response || 'No response received.';
                } catch {
                    // Fallback: mock intelligent response based on agent role
                    response = generateMockResponse(agent, content);
                }

                const assistantMessage: AIMessage = {
                    id: `msg-${Date.now()}-ai`,
                    role: 'assistant',
                    content: response,
                    agent_id: agentId,
                    timestamp: new Date().toISOString(),
                };

                setMessages((prev) => ({
                    ...prev,
                    [agentId]: [...(prev[agentId] || []), assistantMessage],
                }));
            } catch (err) {
                console.error('[AI Agents] Send message failed:', err);

                const errorMessage: AIMessage = {
                    id: `msg-${Date.now()}-error`,
                    role: 'assistant',
                    content: '⚠️ Sorry, I encountered an error. Please try again.',
                    agent_id: agentId,
                    timestamp: new Date().toISOString(),
                };

                setMessages((prev) => ({
                    ...prev,
                    [agentId]: [...(prev[agentId] || []), errorMessage],
                }));
            } finally {
                setIsLoading(false);
                setAgents((prev) =>
                    prev.map((a) => (a.id === agentId ? { ...a, status: 'idle' as const } : a))
                );
            }
        },
        [agents, messages, supabase]
    );

    // ─── Assign agent to room ────────────────────────────────
    const assignToRoom = useCallback(
        async (agentId: string, roomId: string | null) => {
            try {
                const { error } = await supabase
                    .from('ai_agents')
                    .update({ current_room_id: roomId })
                    .eq('id', agentId);

                if (error) throw error;

                setAgents((prev) =>
                    prev.map((a) =>
                        a.id === agentId
                            ? { ...a, current_room_id: roomId || undefined }
                            : a
                    )
                );
            } catch (err) {
                console.error('[AI Agents] Assign to room failed:', err);
            }
        },
        [supabase]
    );

    // ─── Update agent status ─────────────────────────────────
    const setAgentStatus = useCallback(
        async (agentId: string, status: AIAgent['status']) => {
            try {
                await supabase
                    .from('ai_agents')
                    .update({ status })
                    .eq('id', agentId);
            } catch (err) {
                console.error('[AI Agents] Update status failed:', err);
            }
        },
        [supabase]
    );

    return {
        agents,
        activeAgentId,
        setActiveAgentId,
        messages,
        isLoading,
        sendMessage,
        assignToRoom,
        setAgentStatus,
        refreshAgents: fetchAgents,
    };
}

// ─── Mock response generator ─────────────────────────────────
function generateMockResponse(agent: AIAgent, userMessage: string): string {
    const msg = userMessage.toLowerCase();

    // Agent-specific responses based on type
    const responses: Record<string, string[]> = {
        assistant: [
            `Based on my analysis, here's what I'd suggest: Let me break this down step by step.`,
            `Great question! I've reviewed the context and here's my recommendation.`,
            `I've processed your request. Here are the key points to consider.`,
        ],
        reviewer: [
            `I've reviewed the content. Here are my observations and suggestions for improvement.`,
            `Code review complete. I found a few areas that could be optimized.`,
            `After careful analysis, here are my recommendations for better quality.`,
        ],
        sdr: [
            `I've drafted a personalized outreach message based on the prospect profile.`,
            `Here's a follow-up strategy based on the engagement signals I've detected.`,
            `I've compiled a lead scoring analysis. Here are the top opportunities.`,
        ],
        support: [
            `I understand the issue. Here's a step-by-step solution to resolve it.`,
            `Thank you for reporting this. I've identified the root cause and a fix.`,
            `I've checked our knowledge base and found the most relevant solution.`,
        ],
        custom: [
            `I've processed your request according to my configured parameters.`,
            `Here's my analysis based on the context provided.`,
        ],
    };

    // Check for specific intents
    if (msg.includes('summary') || msg.includes('summarize')) {
        return `📋 **Meeting Summary**\n\nHere's a summary of the key discussion points:\n\n1. **Main Topic**: ${userMessage.slice(0, 50)}...\n2. **Decisions Made**: Pending review\n3. **Next Steps**: Follow up with team\n\n_Generated by ${agent.name} (${agent.role})_`;
    }

    if (msg.includes('action item') || msg.includes('task') || msg.includes('todo')) {
        return `✅ **Action Items Extracted**\n\n- [ ] Review the discussed changes\n- [ ] Follow up with stakeholders\n- [ ] Update project documentation\n- [ ] Schedule next sync meeting\n\n_${agent.name} will track these items._`;
    }

    const typeResponses = responses[agent.type] || responses.assistant;
    const baseResponse = typeResponses[Math.floor(Math.random() * typeResponses.length)];

    return `${baseResponse}\n\n_— ${agent.name} (${agent.role}) • ${agent.provider}/${agent.model}_`;
}
