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
 * Replaces CSS `box-shadow: inset ...` in the capture clone because html2canvas-pro
 * rasterizes inset shadows as thick solid opaque bezels.
 */
export async function copyDashboardToClipboard(
  element: HTMLElement,
  options: CopyDashboardOptions = {}
): Promise<CopyDashboardResult> {
  try {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Hanya dapat dijalankan di browser' };
    }

    // Ensure web fonts are loaded so labels & KPI numbers render crisply
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const html2canvas = (await import('html2canvas-pro')).default;

    const isDark =
      document.documentElement.classList.contains('dark') ||
      document.documentElement.dataset.theme === 'dark';

    const scale = options.scale ?? 2;
    const backgroundColor = options.backgroundColor ?? (isDark ? '#1c2028' : '#e6ecf4');
    const targetWidth = 1600;

    const palette = isDark
      ? {
          bg: '#1c2028',
          surface: '#232934',
          surfaceSubtle: '#1a1f28',
          border: '#323a4b',
          borderSubtle: '#2a3140',
          bevelTop: '#141820',
          bevelBottom: '#343d4f',
          divider: '#2d3545',
          cardShadow: '0 8px 20px -4px rgba(0, 0, 0, 0.42)',
          smShadow: '0 4px 10px -2px rgba(0, 0, 0, 0.35)',
          text: '#eef3fb',
          textMuted: '#94a3b8',
          grid: 'rgba(255, 255, 255, 0.1)',
        }
      : {
          bg: '#e6ecf4',
          surface: '#f4f7fb',
          surfaceSubtle: '#e9eff7',
          border: '#cfd9e6',
          borderSubtle: '#d8e1ed',
          bevelTop: '#cbd5e1',
          bevelBottom: '#ffffff',
          divider: '#d5dfec',
          cardShadow: '0 6px 18px -4px rgba(15, 23, 42, 0.08)',
          smShadow: '0 3px 8px -2px rgba(15, 23, 42, 0.06)',
          text: '#182132',
          textMuted: '#5a6982',
          grid: '#d5dfec',
        };

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
        // Preserve active theme state on cloned document root
        clonedDoc.documentElement.dataset.theme = isDark ? 'dark' : 'light';
        if (isDark) {
          clonedDoc.documentElement.classList.add('dark');
        } else {
          clonedDoc.documentElement.classList.remove('dark');
        }

        // Enforce crisp desktop capture frame with breathing room so outer shadows never clip
        clonedElement.style.width = `${targetWidth}px`;
        clonedElement.style.maxWidth = `${targetWidth}px`;
        clonedElement.style.minWidth = `${targetWidth}px`;
        clonedElement.style.padding = '28px 32px';
        clonedElement.style.backgroundColor = palette.bg;
        clonedElement.style.boxSizing = 'border-box';

        // Inject html2canvas-safe clean Neumorphic styles (ZERO `inset` box-shadows)
        const styleTag = clonedDoc.createElement('style');
        styleTag.textContent = `
          *, *::before, *::after {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          /* Extruded cards: crisp soft surface + clean outer shadow, no fuzzy double-bezel artifacts */
          .neu-card,
          .glass-card,
          .mb-card {
            background: ${palette.surface} !important;
            border: 1px solid ${palette.border} !important;
            box-shadow: ${palette.cardShadow} !important;
          }

          .neu-card-sm,
          .neu-icon-well,
          .neu-btn,
          .glass {
            background: ${palette.surface} !important;
            border: 1px solid ${palette.borderSubtle} !important;
            box-shadow: ${palette.smShadow} !important;
          }

          /* Recessed / inset wells: NEVER use CSS inset box-shadow in html2canvas!
             Simulate clean tactile depth with subtle recessed fill + crisp 1px directional bevel borders */
          .neu-inset,
          .neu-inset-sm,
          .neu-icon-inset,
          .neu-input,
          .neu-chip,
          .glass-pill {
            background: ${palette.surfaceSubtle} !important;
            box-shadow: none !important;
            border: 1px solid ${palette.borderSubtle} !important;
            border-top-color: ${palette.bevelTop} !important;
            border-left-color: ${palette.bevelTop} !important;
            border-bottom-color: ${palette.bevelBottom} !important;
            border-right-color: ${palette.bevelBottom} !important;
          }

          /* Progress bar troughs stay razor-thin and clean without thick borders */
          .neu-inset-sm.overflow-hidden,
          .neu-inset-sm.rounded-full.p-0\\.5 {
            padding: 0 !important;
            border: 1px solid ${palette.borderSubtle} !important;
            background: ${isDark ? '#151922' : '#dce4ef'} !important;
            box-shadow: none !important;
          }

          .neu-btn-primary {
            box-shadow: ${palette.smShadow} !important;
          }

          /* Prevent tiny inline status dots from inheriting weird borders */
          .neu-inset-sm.w-2\\.5.h-2\\.5 {
            border: none !important;
            background: transparent !important;
          }

          /* Crisp chart grid lines */
          .recharts-cartesian-grid line,
          .recharts-cartesian-grid-horizontal line {
            stroke: ${palette.grid} !important;
            stroke-opacity: 1 !important;
          }
        `;
        clonedDoc.head.appendChild(styleTag);

        // Final safety pass: strip any remaining inline/computed `inset` box-shadow
        // on any descendant node so html2canvas can NEVER draw a thick solid bezel.
        const win = clonedDoc.defaultView;
        if (win) {
          const allNodes = clonedElement.querySelectorAll<HTMLElement>('*');
          allNodes.forEach((node) => {
            const computed = win.getComputedStyle(node);
            if (computed.boxShadow && computed.boxShadow.includes('inset')) {
              node.style.boxShadow = 'none';
            }
          });
        }

        if (options.headerTitle) {
          const hasHeroHeader = clonedElement.querySelector('[data-purpose="dashboard-hero-header"]');
          if (!hasHeroHeader) {
            const header = clonedDoc.createElement('div');
            header.style.padding = '18px 24px';
            header.style.background = palette.surface;
            header.style.border = `1px solid ${palette.border}`;
            header.style.marginBottom = '20px';
            header.style.borderRadius = '20px';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.boxShadow = palette.cardShadow;

            const nowStr = new Date().toLocaleString('id-ID', {
              dateStyle: 'medium',
              timeStyle: 'short',
            });

            header.innerHTML = `
              <div style="display: flex; align-items: center; gap: 14px;">
                <div style="width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px;">
                  SP
                </div>
                <div>
                  <div style="font-size: 10px; font-weight: 700; color: #3b82f6; letter-spacing: 0.06em; text-transform: uppercase;">
                    PT STEEL PIPE INDUSTRY OF INDONESIA TBK
                  </div>
                  <div style="font-size: 18px; font-weight: 800; color: ${palette.text}; margin-top: 2px;">
                    ${options.headerTitle}
                  </div>
                  ${
                    options.headerSubtitle
                      ? `<div style="font-size: 11.5px; font-weight: 500; color: ${palette.textMuted}; margin-top: 2px;">${options.headerSubtitle}</div>`
                      : ''
                  }
                </div>
              </div>
              <div style="text-align: right; font-size: 10px; color: ${palette.textMuted}; font-weight: 500;">
                <div style="text-transform: uppercase; letter-spacing: 0.05em;">Waktu Salin</div>
                <div style="font-weight: 700; color: ${palette.text}; font-size: 12px; margin-top: 2px;">${nowStr}</div>
              </div>
            `;
            clonedElement.insertBefore(header, clonedElement.firstChild);
          }
        }
      },
    });

    const dataUrl = canvas.toDataURL('image/png');

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png', 0.96);
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
