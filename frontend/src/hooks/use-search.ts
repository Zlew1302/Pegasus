"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { SearchResult, SearchResults } from "@/types";

export function useSearch(debounceMs = 250) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const search = useCallback(
    async (q: string, type: string | null, status: string | null, priority: string | null) => {
      if (!q.trim() && !type && !status && !priority) {
        setResults([]);
        setTotal(0);
        return;
      }
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (type) params.set("type", type);
        if (status) params.set("status", status);
        if (priority) params.set("priority", priority);
        params.set("limit", "20");
        const data = await apiFetch<SearchResults>(
          `/search?${params.toString()}`
        );
        setResults(data.results);
        setTotal(data.total);
      } catch {
        setResults([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(
      () => search(query, typeFilter, statusFilter, priorityFilter),
      debounceMs
    );
    return () => clearTimeout(timer);
  }, [query, typeFilter, statusFilter, priorityFilter, debounceMs, search]);

  return {
    query,
    setQuery,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    results,
    isLoading,
    total,
  };
}
