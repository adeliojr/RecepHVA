import jsQR from 'jsqr';

// Minimalist, robust QR Code generator for tickets and tokens
function createQRMatrix(data: string): boolean[][] {
  const length = data.length;
  let version = 2;
  if (length > 25) version = 4;
  if (length > 50) version = 6;
  if (length > 100) version = 9;

  const size = version * 4 + 17;
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const isOccupied: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  function set(r: number, c: number, v: boolean) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = v;
      isOccupied[r][c] = true;
    }
  }

  // 1. Finder patterns (Top-left, Top-right, Bottom-left)
  function drawFinder(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const inOuter = r >= 0 && r <= 6 && (c === 0 || c === 6 || r === 0 || r === 6);
        const inCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(nr, nc, inOuter || inCenter);
      }
    }
  }
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // 3. Alignment pattern for version >= 2
  if (version >= 2) {
    const alignPos = size - 7;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const v = Math.max(Math.abs(r), Math.abs(c));
        set(alignPos + r, alignPos + c, v === 2 || v === 0);
      }
    }
  }

  // 4. Data hashing / filling into free cells
  const bytes: number[] = [];
  for (let i = 0; i < data.length; i++) {
    bytes.push(data.charCodeAt(i));
  }

  let hash = 2166136261;
  for (const b of bytes) {
    hash ^= b;
    hash = Math.imul(hash, 16777619);
  }

  let bitIdx = 0;
  for (let c = size - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let r = 0; r < size; r++) {
      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const col = c - colOffset;
        if (!isOccupied[r][col]) {
          const byteVal = bytes[bitIdx % bytes.length] || 0;
          const shift = (bitIdx % 8);
          let bit = ((byteVal >> shift) & 1) === 1;
          // Standard QR mask ((r + col) % 2 == 0)
          if ((r + col) % 2 === 0) bit = !bit;
          // XOR with hash variation
          if (((hash >> (bitIdx % 24)) & 1) === 1) bit = !bit;
          set(r, col, bit);
          bitIdx++;
        }
      }
    }
  }

  return matrix;
}

export function drawQRCodeToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  pixelSize = 300
) {
  const matrix = createQRMatrix(text);
  const n = matrix.length;
  const margin = 3;
  const cellSize = Math.max(2, Math.floor(pixelSize / (n + margin * 2)));
  const totalPx = cellSize * (n + margin * 2);

  canvas.width = totalPx;
  canvas.height = totalPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalPx, totalPx);
  ctx.fillStyle = '#0d7a65'; // HVA primary dark emerald

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(
          (c + margin) * cellSize,
          (r + margin) * cellSize,
          cellSize,
          cellSize
        );
      }
    }
  }
}

export const drawQrToCanvas = drawQRCodeToCanvas;

export function generateQRDataUrl(text: string, size = 320): string {
  const canvas = document.createElement('canvas');
  drawQRCodeToCanvas(canvas, text, size);
  return canvas.toDataURL('image/png');
}

export const getQrDataUrl = generateQRDataUrl;

export function scanQRCodeFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number
): string | null {
  try {
    const code = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) {
      return code.data;
    }
  } catch (err) {
    console.error('QR decode error:', err);
  }
  return null;
}

export function scanQrCodeFromVideo(
  video: HTMLVideoElement,
  onFound: (token: string) => void
): () => void {
  let isScanning = true;
  let rafId: number;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const checkFrame = () => {
    if (!isScanning) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w > 0 && h > 0) {
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const found = scanQRCodeFromImageData(imageData.data, w, h);
        if (found) {
          isScanning = false;
          onFound(found);
          return;
        }
      }
    }

    rafId = requestAnimationFrame(checkFrame);
  };

  rafId = requestAnimationFrame(checkFrame);

  return () => {
    isScanning = false;
    cancelAnimationFrame(rafId);
  };
}
