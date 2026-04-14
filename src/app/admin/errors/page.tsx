"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface ErrorPattern {
  id: string;
  fingerprint: string;
  pattern: string;
  category: string;
  layer: string;
  bad_pattern: string;
  fix_hint: string;
  frequency: number;
  applicable_context: string | null;
  last_seen_at: string;
  created_at: string;
}

interface PromotionCandidate {
  id: string;
  pattern: string;
  category: string;
  currentLayer: string;
  targetLayer: string;
  frequency: number;
  badPattern: string;
  fixHint: string;
}

interface ErrorStats {
  total: number;
  byLayer: Record<string, number>;
  byCategory: Record<string, number>;
  promotionCandidates: number;
}

const LAYER_COLORS: Record<string, string> = {
  prompt: "bg-yellow-100 text-yellow-800",
  guardrail: "bg-blue-100 text-blue-800",
  template: "bg-green-100 text-green-800",
};

const CAT_COLORS: Record<string, string> = {
  jsx: "bg-orange-100 text-orange-700",
  import: "bg-purple-100 text-purple-700",
  typescript: "bg-blue-100 text-blue-700",
  css: "bg-pink-100 text-pink-700",
  runtime: "bg-red-100 text-red-700",
  build: "bg-gray-100 text-gray-700",
};

export default function AdminErrorPatternsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [patterns, setPatterns] = useState<ErrorPattern[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [candidates, setCandidates] = useState<PromotionCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/error-patterns");
      if (!res.ok) {
        if (res.status === 401) router.push("/dashboard");
        return;
      }
      const data = await res.json();
      setPatterns(data.patterns || []);
      setStats(data.stats || null);
      setCandidates(data.candidates || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePromote = async (patternId: string, targetLayer: string) => {
    try {
      await fetch("/api/admin/error-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patternId, targetLayer }),
      });
      loadData();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Error Patterns</h1>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-500">Total Patterns</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-2xl font-bold text-yellow-600">{stats.byLayer.prompt || 0}</div>
              <div className="text-xs text-gray-500">Prompt Layer</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-2xl font-bold text-blue-600">{stats.byLayer.guardrail || 0}</div>
              <div className="text-xs text-gray-500">Guardrail Layer</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-2xl font-bold text-orange-600">{stats.promotionCandidates}</div>
              <div className="text-xs text-gray-500">Promotion Candidates</div>
            </div>
          </div>
        )}

        {/* Promotion candidates */}
        {candidates.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
            <h2 className="text-sm font-semibold text-orange-800 mb-3">
              Promotion Candidates ({candidates.length})
            </h2>
            <div className="space-y-2">
              {candidates.map((c) => (
                <div key={c.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-orange-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CAT_COLORS[c.category] || "bg-gray-100 text-gray-600"}`}>
                        {c.category}
                      </span>
                      <span className="text-xs font-mono text-gray-700">{c.pattern}</span>
                      <span className="text-[10px] text-gray-400">({c.frequency}x)</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{c.badPattern}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${LAYER_COLORS[c.currentLayer]}`}>
                      {c.currentLayer}
                    </span>
                    <span className="text-gray-300">{"-->"}</span>
                    <button
                      onClick={() => handlePromote(c.id, c.targetLayer)}
                      className={`text-[10px] px-2 py-1 rounded-full font-medium ${LAYER_COLORS[c.targetLayer]} hover:opacity-80 transition-opacity cursor-pointer`}
                    >
                      {c.targetLayer}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All patterns */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">All Patterns</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {patterns.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                No error patterns recorded yet. Build some sites first!
              </div>
            ) : (
              patterns.map((p) => (
                <div key={p.id} className="px-4 py-3 hover:bg-gray-50/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${LAYER_COLORS[p.layer] || "bg-gray-100 text-gray-600"}`}>
                      {p.layer}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CAT_COLORS[p.category] || "bg-gray-100 text-gray-600"}`}>
                      {p.category}
                    </span>
                    <span className="text-xs font-mono text-gray-700">{p.pattern}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 ml-auto">
                      {p.frequency}x
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{p.bad_pattern}</p>
                  <p className="text-xs text-green-700 mt-0.5">{p.fix_hint}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
