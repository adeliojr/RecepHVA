import QRCode from 'qrcode';
import jsQR from 'jsqr';

/**
 * Draws an ISO-compliant, standard QR code to a canvas element using `qrcode`
 */
export async function drawQRCodeToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  pixelSize = 300
): Promise<void> {
  try {
    await QRCode.toCanvas(canvas, text, {
      width: pixelSize,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000', // Pure black provides maximum contrast for optical camera sensors
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error drawing QR to canvas:', err);
  }
}

export const drawQrToCanvas = drawQRCodeToCanvas;

/**
 * Generates a standard PNG Data URL for a QR Code
 */
export async function generateQRDataUrl(text: string, size = 320): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error generating QR DataURL:', err);
    return '';
  }
}

export const getQrDataUrl = generateQRDataUrl;

/**
 * Decodes QR code from ImageData using jsQR
 */
export function scanQRCodeFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number
): string | null {
  try {
    const code = jsQR(data, width, height, {
      inversionAttempts: 'attemptBoth',
    });
    if (code && code.data && code.data.trim()) {
      return code.data.trim();
    }
  } catch (err) {
    console.error('jsQR decode error:', err);
  }
  return null;
}

/**
 * High-performance, robust scanner for video elements.
 * Uses native BarcodeDetector API when available (hardware-accelerated in Chrome/Android),
 * and falls back to jsQR with throttled frame capture.
 */
export function scanQrCodeFromVideo(
  video: HTMLVideoElement,
  onFound: (token: string) => void
): () => void {
  let isScanning = true;
  let rafId: number;
  let lastScanTime = 0;
  const SCAN_INTERVAL_MS = 100; // Scan 10 times per second to prevent CPU overload

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Native BarcodeDetector support check
  const hasNativeDetector =
    typeof window !== 'undefined' &&
    'BarcodeDetector' in window &&
    typeof (window as unknown as { BarcodeDetector: any }).BarcodeDetector === 'function';

  let nativeDetector: any = null;
  if (hasNativeDetector) {
    try {
      nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    } catch {
      nativeDetector = null;
    }
  }

  const loop = async (time: number) => {
    if (!isScanning) return;

    // Throttle checks
    if (time - lastScanTime >= SCAN_INTERVAL_MS) {
      lastScanTime = time;

      if (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        // 1. Try native BarcodeDetector if available (instant & handles rotation/angles)
        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              const raw = barcodes[0].rawValue.trim();
              if (raw && isScanning) {
                isScanning = false;
                onFound(raw);
                return;
              }
            }
          } catch {
            // Fall through to jsQR
          }
        }

        // 2. jsQR fallback
        if (ctx && isScanning) {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          // Scale down high-res video if too large to speed up jsQR detection
          const maxDim = 640;
          let cw = vw;
          let ch = vh;
          if (vw > maxDim || vh > maxDim) {
            const scale = maxDim / Math.max(vw, vh);
            cw = Math.floor(vw * scale);
            ch = Math.floor(vh * scale);
          }

          canvas.width = cw;
          canvas.height = ch;
          ctx.drawImage(video, 0, 0, cw, ch);

          const imgData = ctx.getImageData(0, 0, cw, ch);
          let token = scanQRCodeFromImageData(imgData.data, cw, ch);

          // If not found, try horizontal flip in case of mirrored camera feed
          if (!token) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -cw, 0, cw, ch);
            ctx.restore();
            const flippedData = ctx.getImageData(0, 0, cw, ch);
            token = scanQRCodeFromImageData(flippedData.data, cw, ch);
          }

          if (token && isScanning) {
            isScanning = false;
            onFound(token);
            return;
          }
        }
      }
    }

    if (isScanning) {
      rafId = requestAnimationFrame(loop);
    }
  };

  rafId = requestAnimationFrame(loop);

  return () => {
    isScanning = false;
    cancelAnimationFrame(rafId);
  };
}
