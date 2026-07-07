import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Hidden WebView that runs Tesseract OCR — this is what makes receipt
 * auto-fill work inside Expo Go, where the native ML Kit engine isn't
 * available. The reader (~2 MB) downloads on first use, then stays cached.
 */

export interface OcrWebViewProps {
  /** JPEG data URL of the (downscaled) receipt photo */
  imageDataUrl: string;
  onResult: (text: string) => void;
  onProgress: (fraction: number) => void;
  onError: (message: string) => void;
}

const OCR_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
<script>
  function post(o) { window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  window.__process = async function (dataUrl) {
    try {
      if (typeof Tesseract === 'undefined') {
        post({ type: 'error', message: 'reader failed to load (no connection?)' });
        return;
      }
      var worker = await Tesseract.createWorker('eng', 1, {
        logger: function (m) {
          if (m.status === 'recognizing text') post({ type: 'progress', value: m.progress });
        }
      });
      var res = await worker.recognize(dataUrl);
      await worker.terminate();
      post({ type: 'result', text: (res && res.data && res.data.text) || '' });
    } catch (e) {
      post({ type: 'error', message: String((e && e.message) || e) });
    }
  };
  post({ type: 'ready' });
</script></body></html>`;

const TIMEOUT_MS = 120000;

export function OcrWebView({ imageDataUrl, onResult, onProgress, onError }: OcrWebViewProps) {
  const webviewRef = useRef<WebView>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onError('timed out');
      }
    }, TIMEOUT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMessage(raw: string) {
    if (doneRef.current) return;
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'ready') {
        // Reader page is up — hand it the image
        webviewRef.current?.injectJavaScript(
          `window.__process(${JSON.stringify(imageDataUrl)}); true;`
        );
      } else if (msg.type === 'progress') {
        onProgress(Number(msg.value) || 0);
      } else if (msg.type === 'result') {
        doneRef.current = true;
        onResult(String(msg.text ?? ''));
      } else if (msg.type === 'error') {
        doneRef.current = true;
        onError(String(msg.message ?? 'unknown'));
      }
    } catch {
      // ignore malformed messages
    }
  }

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: OCR_HTML, baseUrl: 'https://localhost' }}
        onMessage={(e) => handleMessage(e.nativeEvent.data)}
        onError={() => {
          if (!doneRef.current) {
            doneRef.current = true;
            onError('webview failed');
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
