'use client';
import React from 'react';

/**
 * A hook to memoize Firebase query or document references.
 * This is crucial to prevent infinite loops when using `useCollection` or `useDoc`.
 * It adds a `__memo` property to the returned object, which is checked by the hooks.
 * @template T The type of the value to memoize.
 * @param factory A function that returns the value to be memoized.
 * @param deps An array of dependencies for the `useMemo` hook.
 * @returns The memoized value, or null/undefined if the factory returns it.
 */
export const useMemoFirebase = <T extends {}>(
    factory: () => T | null | undefined, 
    deps: React.DependencyList
): (T & { __memo?: boolean }) | null | undefined => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memoized = React.useMemo(factory, deps);
    
    // Add a non-enumerable property to mark the object as memoized.
    if (memoized) {
        Object.defineProperty(memoized, '__memo', {
            value: true,
            writable: false,
            enumerable: false,
            configurable: false,
        });
    }
    
    return memoized as (T & { __memo?: boolean }) | null | undefined;
};
