export interface CopyDashboardOptions {
  scale?: number;
  backgroundColor?: string;
  headerTitle?: string;
  headerSubtitle?: string;
}

export interface CopyDashboardResult {
  success: boolean;
  blob?: Blob;
  dataUrl?: string;
  error?: string;
}

/**
 * Capture an HTMLElement and write it as PNG directly into the system clipboard.
 */
export async function copyDashboardToClipboard(
  element: HTMLElement,
  options: CopyDashboardOptions = {}
): Promise<CopyDashboardResult> {
  try {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Hanya dapat dijalankan di browser' };
    }

    const html2canvas = (await import('html2canvas-pro')).default;

    const scale = options.scale ?? (window.devicePixelRatio > 1 ? 2 : 1.5);
    const backgroundColor = options.backgroundColor ?? '#f8fafc';

    const canvas = await html2canvas(element, {
      scale,
      backgroundColor,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth: document.documentElement.offsetWidth,
      imageSmoothing: true,
      imageSmoothingQuality: 'high',
      onclone: (clonedDoc, clonedElement) => {
        if (options.headerTitle) {
          const header = clonedDoc.createElement('div');
          header.style.padding = '18px 24px';
          header.style.backgroundColor = '#ffffff';
          header.style.border = '1px solid #e2e8f0';
          header.style.marginBottom = '20px';
          header.style.borderRadius = '16px';
          header.style.display = 'flex';
          header.style.justifyContent = 'space-between';
          header.style.alignItems = 'center';
          header.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.05)';

          const nowStr = new Date().toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short',
          });

          header.innerHTML = `
            <div>
              <div style="font-size: 10px; font-weight: 700; color: #0284c7; letter-spacing: 0.06em; text-transform: uppercase;">
                PT STEEL PIPE INDUSTRY OF INDONESIA TBK
              </div>
              <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 2px;">
                ${options.headerTitle}
              </div>
              ${
                options.headerSubtitle
                  ? `<div style="font-size: 11px; font-weight: 500; color: #64748b; margin-top: 2px;">${options.headerSubtitle}</div>`
                  : ''
              }
            </div>
            <div style="text-align: right; font-size: 10px; color: #94a3b8; font-weight: 500;">
              <div>Waktu Salin:</div>
              <div style="font-weight: 700; color: #334155; font-size: 11px; margin-top: 1px;">${nowStr}</div>
            </div>
          `;
          clonedElement.insertBefore(header, clonedElement.firstChild);
        }
      },
    });

    const dataUrl = canvas.toDataURL('image/png');

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png', 0.95);
    });

    if (!blob) {
      return { success: false, dataUrl, error: 'Gagal membuat gambar PNG dari grafik' };
    }

    if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ]);
        return { success: true, blob, dataUrl };
      } catch (clipErr: any) {
        console.warn('Direct clipboard write failed, returning image data:', clipErr);
        return {
          success: false,
          blob,
          dataUrl,
          error: clipErr?.message || 'Izin clipboard browser ditolak',
        };
      }
    }

    return {
      success: false,
      blob,
      dataUrl,
      error: 'Browser tidak mendukung direct clipboard write API',
    };
  } catch (err: any) {
    console.error('Clipboard capture error:', err);
    return {
      success: false,
      error: err?.message || 'Terjadi kesalahan saat memproses gambar dashboard',
    };
  }
}
