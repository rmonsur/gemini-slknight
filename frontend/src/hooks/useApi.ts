'use client';

import { useState, useEffect } from 'react';

type FetchState<T> = {
    data: T | null;
    loading: boolean;
    error: Error | null;
};

/**
 * Hook for fetching data from API with loading and error states
 */
export function useApi<T>(
    fetcher: () => Promise<T>,
    deps: unknown[] = []
): FetchState<T> & { refetch: () => void } {
    const [state, setState] = useState<FetchState<T>>({
        data: null,
        loading: true,
        error: null,
    });

    const fetchData = async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            const data = await fetcher();
            setState({ data, loading: false, error: null });
        } catch (error) {
            setState({ data: null, loading: false, error: error as Error });
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { ...state, refetch: fetchData };
}

/**
 * Hook for demo mode detection
 */
export function useDemoMode(): boolean {
    return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}
