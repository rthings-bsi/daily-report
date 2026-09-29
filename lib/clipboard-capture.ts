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
    const backgroundColor = options.backgroundColor ?? '#f1f5f9';
    const targetWidth = 1600;

    const canvas = await html2canvas(element, {
      scale,
      backgroundColor,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth: Math.max(targetWidth, document.documentElement.offsetWidth),
      imageSmoothing: true,
      imageSmoothingQuality: 'high',
      onclone: (clonedDoc, clonedElement) => {
        // Enforce wide landscape desktop layout during capture
        clonedElement.style.width = `${targetWidth}px`;
        clonedElement.style.maxWidth = `${targetWidth}px`;
        clonedElement.style.minWidth = `${targetWidth}px`;
        clonedElement.style.boxSizing = 'border-box';

        // Inject high-contrast capture styles so card boundaries, borders, and grid lines don't wash out in html2canvas
        const styleTag = clonedDoc.createElement('style');
        styleTag.textContent = `
          /* html2canvas doesn't support backdrop-filter: blur, so render cards with crisp solid backgrounds and visible borders */
          .glass-card {
            background-color: #ffffff !important;
            border: 1.5px solid #cbd5e1 !important;
            box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04) !important;
            backdrop-filter: none !important;
          }
          .glass-pill {
            background-color: #ffffff !important;
            border: 1.5px solid #cbd5e1 !important;
            box-shadow: 0 2px 8px -1px rgba(15, 23, 42, 0.06) !important;
            backdrop-filter: none !important;
          }
          /* Replace invisible white borders with clear slate boundaries */
          [class*="border-white"] {
            border-color: #cbd5e1 !important;
          }
          /* Inner containers and sub-cards */
          [class*="bg-white/60"], [class*="bg-white/70"], [class*="bg-white/80"] {
            background-color: #f8fafc !important;
            border-color: #e2e8f0 !important;
          }
          /* Make chart grid lines crisp and visible */
          .recharts-cartesian-grid line,
          .recharts-cartesian-grid-horizontal line {
            stroke: #cbd5e1 !important;
            stroke-dasharray: 4 4 !important;
            stroke-opacity: 1 !important;
          }
          /* Make divider lines clean and clear */
          [class*="border-slate-200"], [class*="border-slate-100"] {
            border-color: #cbd5e1 !important;
          }
          [class*="border-apple-gray-200"] {
            border-color: #cbd5e1 !important;
          }
        `;
        clonedDoc.head.appendChild(styleTag);

        if (options.headerTitle) {
          // Check if clonedElement already has a hero header to avoid duplicate headers
          const hasHeroHeader = clonedElement.querySelector('[data-purpose="dashboard-hero-header"]');
          if (!hasHeroHeader) {
            const header = clonedDoc.createElement('div');
            header.style.padding = '16px 24px';
            header.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.95))';
            header.style.border = '1px solid rgba(226, 232, 240, 0.9)';
            header.style.marginBottom = '20px';
            header.style.borderRadius = '20px';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.boxShadow = '0 4px 16px -2px rgba(0, 0, 0, 0.05)';

            const nowStr = new Date().toLocaleString('id-ID', {
              dateStyle: 'medium',
              timeStyle: 'short',
            });

            header.innerHTML = `
              <div style="display: flex; align-items: center; gap: 14px;">
                <div style="width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #007AFF, #59ADC4); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; box-shadow: 0 4px 12px rgba(0, 122, 255, 0.25);">
                  SP
                </div>
                <div>
                  <div style="font-size: 10px; font-weight: 700; color: #007AFF; letter-spacing: 0.06em; text-transform: uppercase;">
                    PT STEEL PIPE INDUSTRY OF INDONESIA TBK
                  </div>
                  <div style="font-size: 18px; font-weight: 800; color: #1e293b; margin-top: 1px;">
                    ${options.headerTitle}
                  </div>
                  ${
                    options.headerSubtitle
                      ? `<div style="font-size: 11px; font-weight: 500; color: #64748b; margin-top: 1px;">${options.headerSubtitle}</div>`
                      : ''
                  }
                </div>
              </div>
              <div style="text-align: right; font-size: 10px; color: #94a3b8; font-weight: 500;">
                <div style="text-transform: uppercase; letter-spacing: 0.05em;">Waktu Salin:</div>
                <div style="font-weight: 700; color: #334155; font-size: 12px; margin-top: 2px;">${nowStr}</div>
              </div>
            `;
            clonedElement.insertBefore(header, clonedElement.firstChild);
          }
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
