import { useEffect } from 'react';
import type { OcrWebViewProps } from './OcrWebView';

/** Web build stub — react-native-webview has no web support; report unavailable. */
export function OcrWebView({ onError }: OcrWebViewProps) {
  useEffect(() => {
    onError('unavailable on web');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
