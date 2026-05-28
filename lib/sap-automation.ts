import puppeteer, { Browser, Page } from 'puppeteer-core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SapConfig {
  url: string;
  username: string;
  password: string;
  transactionCode: string;
  dateFrom?: string;
  dateTo?: string;
  plant?: string;
}

export interface SapProgress {
  stage: string;
  message: string;
}

export interface SapImportResult {
  success: boolean;
  message: string;
  filePath?: string;
  fileName?: string;
  error?: string;
  debugLogs?: string[];
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function findChromeExecutable(): string | null {
  const candidates: string[] = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

async function getPageContent(page: Page, frame?: any): Promise<string> {
  try {
    const f = frame || page.mainFrame();
    return await f.evaluate(() => document.body?.innerText || '');
  } catch {
    return '(unable to read page content)';
  }
}

export async function autoImportFromSap(
  config: SapConfig,
  onProgress?: (progress: SapProgress) => void
): Promise<SapImportResult> {
  const debugLogs: string[] = [];
  const log = (msg: string) => { debugLogs.push(msg); };

  let browser: Browser | null = null;
  let tempDir: string | null = null;

  try {
    const chromePath = findChromeExecutable();
    if (!chromePath) {
      return {
        success: false,
        message: 'Google Chrome tidak ditemukan. Silakan install Google Chrome terlebih dahulu.',
        error: 'Chrome not found',
        debugLogs,
      };
    }

    log(`Chrome ditemukan di: ${chromePath}`);

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sap-download-'));
    log(`Direktori download: ${tempDir}`);

    emitProgress(onProgress, { stage: 'browser', message: 'Meluncurkan browser...' });

    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: false,
      defaultViewport: { width: 1280, height: 900 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    const page = await browser.newPage();

    // Set download path via CDP
    try {
      const client = await page.createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: tempDir,
      });
    } catch {
      log('CDP setDownloadBehavior not available, using file watcher');
    }

    // ─── STEP 1: Navigate to SAP URL ───
    emitProgress(onProgress, { stage: 'navigate', message: 'Membuka halaman SAP...' });
    log(`Navigating to: ${config.url}`);

    await page.goto(config.url, { waitUntil: 'networkidle0', timeout: 60000 });
    log(`Page title after navigation: ${await page.title()}`);

    // Give SAP page time to fully render
    await sleep(3000);

    const pageContent = await getPageContent(page);
    log(`Page content: ${pageContent.substring(0, 500)}`);

    // ─── STEP 2: Login ───
    emitProgress(onProgress, { stage: 'login', message: 'Melakukan login ke SAP...' });

    // Try common SAP login field patterns
    const loginFields = [
      { user: '#sap-user', pass: '#sap-password', btn: '#LOGON' },
      { user: '#username', pass: '#password', btn: 'button[type="submit"]' },
      { user: 'input[name="USERNAME"]', pass: 'input[name="PASSWORD"]', btn: 'input[type="submit"]' },
      { user: 'input[name="userId"]', pass: 'input[name="password"]', btn: 'button[type="submit"]' },
      { user: 'input[type="text"]', pass: 'input[type="password"]', btn: 'button[type="submit"]' },
    ];

    let loggedIn = false;
    for (const fields of loginFields) {
      const userField = await page.$(fields.user).catch(() => null);
      if (!userField) continue;

      log(`Found login field: ${fields.user}`);
      await userField.click({ count: 3 });
      await userField.type(config.username, { delay: 50 });

      const passField = await page.$(fields.pass);
      if (passField) {
        await passField.click({ count: 3 });
        await passField.type(config.password, { delay: 50 });
      }

      // Try to find and click the login button
      const loginBtn = await page.$(fields.btn).catch(() => null);
      if (loginBtn) {
        await loginBtn.click();
      } else {
        // Try pressing Enter
        await page.keyboard.press('Enter');
      }

      await sleep(3000);
      const currentUrl = page.url();
      log(`After login attempt: ${currentUrl}`);

      // Check if login succeeded (not on login page anymore)
      const pageText = await getPageContent(page);
      if (!pageText.toLowerCase().includes('log on') && !pageText.toLowerCase().includes('sap-user') && !currentUrl.includes('logon')) {
        loggedIn = true;
        log('Login berhasil!');
        break;
      }
      log('Login attempt failed with this field set, trying next...');
    }

    if (!loggedIn) {
      // Try one more approach: wait for manual intervention
      log('Auto-login gagal. Mencoba menunggu login manual...');
      emitProgress(onProgress, { stage: 'login', message: 'Login manual diperlukan. Login di browser yang terbuka...' });

      // Wait for URL to change from login page (up to 120 seconds)
      let manualLoginDone = false;
      for (let i = 0; i < 120; i++) {
        await sleep(1000);
        const currentUrl = page.url();
        const pageText = await getPageContent(page);
        if (!pageText.toLowerCase().includes('log on') && !currentUrl.includes('logon')) {
          manualLoginDone = true;
          log('Manual login terdeteksi!');
          break;
        }
      }

      if (!manualLoginDone) {
        throw new Error('Gagal login. Periksa URL, username, dan password SAP Anda.');
      }
    }

    // ─── STEP 3: Navigate to Transaction ───
    if (config.transactionCode) {
      emitProgress(onProgress, { stage: 'transaction', message: `Menjalankan transaksi ${config.transactionCode}...` });
      log(`Navigating to transaction: ${config.transactionCode}`);

      // Wait for page to be ready after login
      await sleep(2000);

      // Try to find the OK code field
      const okCodeSelectors = [
        '#okcd',
        'input[name="okCode"]',
        'input[name="OKCODE"]',
        'input[title*="OK code"]',
        'input[title*="Command"]',
        'input[placeholder*="OK"]',
        'input[type="text"][maxlength="20"]',
      ];

      let okCodeField = null;
      for (const selector of okCodeSelectors) {
        okCodeField = await page.$(selector).catch(() => null);
        if (okCodeField) {
          log(`Found OK code field: ${selector}`);
          break;
        }
      }

      if (okCodeField) {
        await okCodeField.click({ count: 3 });
        await okCodeField.type(`/n${config.transactionCode}`, { delay: 30 });
        await page.keyboard.press('Enter');
        log(`Transaction ${config.transactionCode} executed via OK code`);
      } else {
        // Alternative: navigate via URL
        log('OK code field not found, trying URL navigation...');
        const baseUrl = new URL(config.url);
        const tcodeUrl = `${baseUrl.origin}/sap/bc/gui/sap/its/webgui?~transaction=${config.transactionCode}`;
        await page.goto(tcodeUrl, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
      }

      // Wait for transaction to load
      await sleep(5000);
      const afterTCodeContent = await getPageContent(page);
      log(`After transaction navigation: ${afterTCodeContent.substring(0, 300)}`);
    }

    // ─── STEP 4: Set Selection Parameters ───
    if (config.dateFrom || config.dateTo || config.plant) {
      emitProgress(onProgress, { stage: 'parameters', message: 'Mengatur parameter seleksi...' });
      log('Setting selection parameters...');

      // Try to find date fields and plant fields
      if (config.dateFrom) {
        const dateFromSelectors = [
          'input[name="P_DATE-LOW"]',
          'input[name="DATE-LOW"]',
          'input[title*="From"]',
          'input[title*="Date from"]',
        ];
        for (const sel of dateFromSelectors) {
          const field = await page.$(sel).catch(() => null);
          if (field) {
            await field.click({ count: 3 });
            await field.type(config.dateFrom, { delay: 20 });
            log(`Set date from: ${config.dateFrom}`);
            break;
          }
        }
      }

      if (config.dateTo) {
        const dateToSelectors = [
          'input[name="P_DATE-HIGH"]',
          'input[name="DATE-HIGH"]',
          'input[title*="To"]',
          'input[title*="Date to"]',
        ];
        for (const sel of dateToSelectors) {
          const field = await page.$(sel).catch(() => null);
          if (field) {
            await field.click({ count: 3 });
            await field.type(config.dateTo, { delay: 20 });
            log(`Set date to: ${config.dateTo}`);
            break;
          }
        }
      }

      if (config.plant) {
        const plantSelectors = [
          'input[name="P_WERKS-LOW"]',
          'input[name="WERKS-LOW"]',
          'input[title*="Plant"]',
        ];
        for (const sel of plantSelectors) {
          const field = await page.$(sel).catch(() => null);
          if (field) {
            await field.click({ count: 3 });
            await field.type(config.plant, { delay: 20 });
            log(`Set plant: ${config.plant}`);
            break;
          }
        }
      }

      // Try to execute (F8 or click Execute button)
      await page.keyboard.press('F8');
      await sleep(3000);
    }

    // ─── STEP 5: Export to Excel ───
    emitProgress(onProgress, { stage: 'export', message: 'Mengekspor data ke Excel...' });
    log('Starting Excel export...');

    // Wait for report to load
    await sleep(2000);

    // Method 1: Try Ctrl+Shift+F7 (SAP GUI standard export shortcut)
    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('F7');
    await page.keyboard.up('Control');
    await page.keyboard.up('Shift');
    log('Tried Ctrl+Shift+F7 for export');
    await sleep(3000);

    // Check if we got a download
    let downloadedFile = await waitForDownload(tempDir, 5000);
    if (!downloadedFile) {
      log('Ctrl+Shift+F7 did not work, trying alternative methods...');

      // Method 2: Look for Export/Excel buttons
      const exportButtonSelectors = [
        'button[title*="Spreadsheet"]',
        'img[title*="Spreadsheet"]',
        'button[title*="Excel"]',
        'img[title*="Excel"]',
        'button[title*="Export"]',
        'img[title*="Export"]',
        '[class*="excel"]',
        '[class*="export"]',
        'button:has-text("Excel")',
        'button:has-text("Export")',
      ];

      for (const selector of exportButtonSelectors) {
        const btn = await page.$(selector).catch(() => null);
        if (btn) {
          log(`Found export button: ${selector}`);
          await btn.click();
          await sleep(2000);
          downloadedFile = await waitForDownload(tempDir, 5000);
          if (downloadedFile) break;
        }
      }
    }

    // Method 3: Try SAP GUI menu path: System > List > Save > Local File > Spreadsheet
    if (!downloadedFile) {
      log('Trying SAP GUI menu path...');

      // Try System menu (Alt+S)
      await page.keyboard.down('Alt');
      await page.keyboard.press('s');
      await page.keyboard.up('Alt');
      await sleep(1500);

      // Try to navigate menu items
      const menuItems = await page.$$('a, button, span, div').catch(() => []);
      for (const item of menuItems) {
        try {
          const text = await item.evaluate(el => el.textContent || '').catch(() => '');
          const lower = text.toLowerCase();
          if (lower.includes('list') || lower.includes('save') || lower.includes('local') || lower.includes('spreadsheet')) {
            log(`Found menu item: ${text}`);
            await item.click().catch(() => {});
            await sleep(1000);
            downloadedFile = await waitForDownload(tempDir, 3000);
            if (downloadedFile) break;
          }
        } catch { continue; }
      }
    }

    // Method 4: Take screenshot and try using the Grid Context Menu
    if (!downloadedFile) {
      log('Trying to use SAP List Viewer toolbar...');

      // SAP List Viewer (ALV) has an export button in the toolbar
      const alvExportSelectors = [
        '[class*="sapUiBtn"]',
        '[class*="sapMIBar"] button',
        '[class*="sapMList"] button',
        'button[aria-label*="export"]',
        'button[aria-label*="Excel"]',
      ];

      for (const selector of alvExportSelectors) {
        const buttons = await page.$$(selector).catch(() => []);
        for (const btn of buttons) {
          try {
            const text = await btn.evaluate(el => el.textContent || '').catch(() => '');
            const html = await btn.evaluate(el => el.outerHTML || '').catch(() => '');
            if (text.toLowerCase().includes('excel') || text.toLowerCase().includes('export') || html.toLowerCase().includes('excel')) {
              log(`Found ALV export element: ${text || html.substring(0, 100)}`);
              await btn.click();
              await sleep(2000);
              downloadedFile = await waitForDownload(tempDir, 5000);
              if (downloadedFile) break;
            }
          } catch { continue; }
        }
        if (downloadedFile) break;
      }
    }

    if (!downloadedFile) {
      // Instead of failing, let the user manually download and save
      log('Auto-export tidak berhasil. Meminta user untuk melakukan export manual...');
      emitProgress(onProgress, {
        stage: 'manual',
        message: 'Export otomatis gagal. Silakan export manual ke Excel di browser yang terbuka, lalu simpan file-nya. Menunggu...'
      });

      // Wait for user to manually download (up to 5 minutes)
      for (let i = 0; i < 300; i++) {
        await sleep(1000);
        downloadedFile = await waitForDownload(tempDir, 0);
        if (downloadedFile) {
          log('Manual download terdeteksi!');
          break;
        }
      }
    }

    if (!downloadedFile) {
      throw new Error('Tidak dapat men-download file Excel dari SAP. Silakan coba export manual dari browser SAP.');
    }

    log(`File downloaded: ${downloadedFile}`);

    // ─── STEP 6: Close browser ───
    if (browser) {
      await browser.close();
      browser = null;
    }

    emitProgress(onProgress, { stage: 'complete', message: 'Data berhasil di-download dari SAP!' });

    const fileName = path.basename(downloadedFile);
    return {
      success: true,
      message: `Data berhasil di-download: ${fileName}`,
      filePath: downloadedFile,
      fileName,
      debugLogs,
    };

  } catch (error: any) {
    log(`Error: ${error.message}`);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return {
      success: false,
      message: error.message || 'Gagal meng-import data dari SAP',
      error: error.message,
      debugLogs,
    };
  }
}

async function waitForDownload(dir: string, timeoutMs: number): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const files = fs.readdirSync(dir);
      const xlsxFiles = files.filter(f =>
        f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv') ||
        f.endsWith('.XLSX') || f.endsWith('.XLS') || f.endsWith('.CSV')
      );

      // Filter out partial downloads (files ending in .crdownload or .tmp)
      const completedFiles = xlsxFiles.filter(f =>
        !f.endsWith('.crdownload') && !f.endsWith('.tmp') && !f.startsWith('Unconfirmed')
      );

      if (completedFiles.length > 0) {
        // Return the most recently modified file
        const fullPaths = completedFiles.map(f => path.join(dir, f));
        fullPaths.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        return fullPaths[0];
      }
    } catch { /* directory might not exist yet */ }

    if (timeoutMs === 0) break; // For instant checks
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return null;
}

function emitProgress(onProgress?: (progress: SapProgress) => void, progress?: SapProgress) {
  if (onProgress && progress) {
    onProgress(progress);
  }
}
