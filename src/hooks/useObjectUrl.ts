import { useRef, useEffect, useCallback } from 'react';

/**
 * Safely manages an Object URL, revoking previously allocated URLs
 * when replaced or when the component unmounts.
 */
export function useObjectUrl() {
  const currentUrlRef = useRef<string | null>(null);

  const createUrl = useCallback((blobOrFile: Blob | MediaSource | null): string | null => {
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }

    if (!blobOrFile) {
      return null;
    }

    const url = URL.createObjectURL(blobOrFile);
    currentUrlRef.current = url;
    return url;
  }, []);

  const revokeUrl = useCallback(() => {
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }
    };
  }, []);

  return {
    createUrl,
    revokeUrl,
    currentUrlRef
  };
}
