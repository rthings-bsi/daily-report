'use client';

import React, { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Terminal, Download, AlertTriangle, Database, Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

function pad2(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function weekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// ─── VBS TEMPLATE (parameter diganti via JS replace) ───
const VBS_TEMPLATE = `' ============================================================
' SAP Auto Import: __TCODE__ — __TCODE_NAME__
' ============================================================

' ─── KONFIGURASI ───
TransactionCode = "__TCODE__"
DateFrom = "__DATE_FROM__"
DateTo = "__DATE_TO__"
Material = ""
Plant = "__PLANT__"
StorageLoc = ""
MovementType = ""

' ─── FILE SYSTEM ───
Dim FSO : Set FSO = CreateObject("Scripting.FileSystemObject")
Dim Desktop : Desktop = FSO.GetSpecialFolder(2)
Dim DownloadDir : DownloadDir = Desktop & "\\SAP_AUTO"
If Not FSO.FolderExists(DownloadDir) Then FSO.CreateFolder DownloadDir

Dim LogFile : LogFile = DownloadDir & "\\sap_auto_log.txt"
Sub Log(msg)
    Dim ts
    On Error Resume Next
    Set ts = FSO.OpenTextFile(LogFile, 8, True)
    If Not ts Is Nothing Then ts.WriteLine "[" & Now & "] " & msg : ts.Close
    On Error Goto 0
    WScript.Echo msg
End Sub

Log "=== SAP AUTO IMPORT: __TCODE__ ==="
Log "Date: __DATE_FROM__ - __DATE_TO__"
Log "Plant: __PLANT__"

' ─── KONEK KE SAP GUI ───
Dim SapGui, Engine, Connection, Session
Set SapGui = GetObject("SAPGUI")
If SapGui Is Nothing Then
    Log "ERROR: SAP GUI tidak ditemukan. Pastikan SAP Logon sudah berjalan."
    MsgBox "SAP GUI tidak ditemukan! Pastikan SAP Logon sudah berjalan dan scripting diaktifkan.", vbCritical, "Error"
    WScript.Quit 1
End If
Set Engine = SapGui.GetScriptingEngine()
If Engine.Connections.Count = 0 Then
    Log "ERROR: Tidak ada koneksi SAP aktif"
    MsgBox "Tidak ada koneksi SAP aktif. Login ke sistem P23 dulu.", vbCritical, "Error"
    WScript.Quit 1
End If
Set Connection = Engine.Connections(0)

Dim sessIdx, testSess, testName
Set Session = Nothing
For sessIdx = 0 To Connection.Sessions.Count - 1
    On Error Resume Next
    Set testSess = Connection.Sessions(sessIdx)
    If Err.Number = 0 Then
        On Error Goto 0
        testName = testSess.Name
        If Len(testName) > 0 Then
            Set Session = testSess
            Log "Session " & sessIdx & ": " & testSess.Info.UserName & " (" & testName & ")"
            Exit For
        End If
    End If
    On Error Goto 0
Next
If Session Is Nothing Then
    Log "ERROR: Tidak bisa mengakses session SAP"
    MsgBox "Tidak bisa mengakses session SAP." & vbCrLf & "Coba tutup SAP GUI, buka ulang, login ke P23, lalu jalankan ulang.", vbCritical, "Error"
    WScript.Quit 1
End If
Log "User: " & Session.Info.UserName

' ─── TUTUP POPUP ───
Sub TutupPopup()
    Dim i, w, bPaths, j
    For i = 1 To 5
        On Error Resume Next
        w = "wnd[" & i & "]"
        Dim p : Set p = Session.findById(w)
        If Err.Number = 0 Then
            bPaths = Array(w & "/tbar[0]/btn[0]", w & "/tbar[0]/btn[1]", w & "/usr/btnSPB_YES", w & "/usr/btnSPB_NO")
            For j = 0 To UBound(bPaths)
                On Error Resume Next
                Session.findById(bPaths(j)).press()
                If Err.Number = 0 Then Log "  Popup closed: " & bPaths(j) : Exit For
                On Error Goto 0
            Next
        End If
        On Error Goto 0
    Next
End Sub
TutupPopup

' ─── NAVIGASI KE T-CODE ───
Log "Navigating to /n" & TransactionCode & " ..."
On Error Resume Next
Session.findById("wnd[0]/tbar[0]/okcd").text = "/n" & TransactionCode
If Err.Number = 0 Then
    Log "  OK code set"
    On Error Resume Next
    Session.findById("wnd[0]/tbar[0]/btn[0]").press()
    If Err.Number = 0 Then Log "  Enter pressed" Else Session.findById("wnd[0]/tbar[0]/btn[12]").press()
Else
    Log "  WARN: Cannot set transaction: " & Err.Description
    Err.Clear
End If
On Error Goto 0
WScript.Sleep 3000
TutupPopup

' ─── SET PARAMETER ───
Sub SetField(patterns, value)
    If Len(value) = 0 Then Exit Sub
    Dim k
    For k = 0 To UBound(patterns)
        On Error Resume Next
        Session.findById(patterns(k)).text = value
        If Err.Number = 0 Then Log "  " & patterns(k) & " = " & value : Exit For
        On Error Goto 0
    Next
End Sub

SetField Array("wnd[0]/usr/ctxtS_BUDAT-LOW", "wnd[0]/usr/ctxtS_DATE-LOW", "wnd[0]/usr/ctxtSO_DATE-LOW", "wnd[0]/usr/ctxtP_DATE-LOW", "wnd[0]/usr/ctxtS_DATUM-LOW", "wnd[0]/usr/ctxtP_DATUM-LOW", "wnd[0]/usr/ctxtSO_DATUM-LOW"), DateFrom
SetField Array("wnd[0]/usr/ctxtS_BUDAT-HIGH", "wnd[0]/usr/ctxtS_DATE-HIGH", "wnd[0]/usr/ctxtSO_DATE-HIGH", "wnd[0]/usr/ctxtP_DATE-HIGH", "wnd[0]/usr/ctxtS_DATUM-HIGH", "wnd[0]/usr/ctxtP_DATUM-HIGH", "wnd[0]/usr/ctxtSO_DATUM-HIGH"), DateTo
SetField Array("wnd[0]/usr/ctxtS_WERKS-LOW", "wnd[0]/usr/ctxtS_WERK-LOW", "wnd[0]/usr/ctxtP_WERKS-LOW", "wnd[0]/usr/ctxtS_WERKS_S-LOW"), Plant
SetField Array("wnd[0]/usr/ctxtS_MATNR-LOW", "wnd[0]/usr/ctxtS_MAT-LOW", "wnd[0]/usr/ctxtRMMG1-MATNR"), Material
SetField Array("wnd[0]/usr/ctxtS_LGORT-LOW", "wnd[0]/usr/ctxtS_LGOBE-LOW"), StorageLoc
SetField Array("wnd[0]/usr/ctxtS_BWART-LOW", "wnd[0]/usr/ctxtSO_BWART-LOW"), MovementType

WScript.Sleep 1000

' ─── EXECUTE (F8) ───
Log "Executing report (F8)..."
On Error Resume Next
Session.findById("wnd[0]/tbar[0]/btn[8]").press()
If Err.Number = 0 Then Log "  F8 executed" Else Err.Clear : Session.findById("wnd[0]").sendVKey 8
On Error Goto 0
WScript.Sleep 5000
TutupPopup

' ─── EXPORT KE EXCEL ───
Log "Exporting to Excel..."
Dim exported : exported = False
On Error Resume Next
Session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").pressButton("&MYXLS")
If Err.Number = 0 Then exported = True : Log "  Export: spreadsheet button"
If Not exported Then
    Err.Clear
    Session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").pressToolbarContextButton("&MYXLS")
    If Err.Number = 0 Then exported = True : Log "  Export: context button"
End If
If Not exported Then
    Dim menuItems, mi
    menuItems = Array("wnd[0]/mbar/menu[0]/menu[4]/menu[1]", "wnd[0]/mbar/menu[4]/menu[2]", "wnd[0]/mbar/menu[0]/menu[5]/menu[2]")
    For Each mi In menuItems
        If Not exported Then
            On Error Resume Next
            Session.findById(mi).select()
            If Err.Number = 0 Then exported = True : Log "  Export: menu"
            On Error Goto 0
        End If
    Next
End If
If Not exported Then Log "  WARN: Auto export failed — save manually"
On Error Goto 0
WScript.Sleep 3000
TutupPopup

' ─── SAVE DIALOG ───
Log "Looking for save dialog..."
Dim saved : saved = False
Dim timestamp : timestamp = Year(Now) & Right("0" & Month(Now), 2) & Right("0" & Day(Now), 2) & "_" & Right("0" & Hour(Now), 2) & Right("0" & Minute(Now), 2) & Right("0" & Second(Now), 2)
Dim fName : fName = "__TCODE___" & timestamp & ".xlsx"
Dim winIdx
For winIdx = 1 To 5
    On Error Resume Next
    Dim tf : Set tf = Session.findById("wnd[" & winIdx & "]/usr/ctxtDY_PATH")
    If Err.Number = 0 Then
        Session.findById("wnd[" & winIdx & "]/usr/ctxtDY_PATH").text = DownloadDir
        Session.findById("wnd[" & winIdx & "]/usr/ctxtDY_FILENAME").text = fName
        WScript.Sleep 500
        Session.findById("wnd[" & winIdx & "]/tbar[0]/btn[0]").press()
        saved = True : Log "  Saved: " & DownloadDir & "\\" & fName : Exit For
    End If
    On Error Goto 0
Next
If saved Then
    Log "=== SUCCESS ==="
    WScript.Echo "RESULTFILE=" & DownloadDir & "\\" & fName
Else
    Log "=== MANUAL SAVE ==="
    WScript.Echo "PENDINGMANUAL=" & DownloadDir
End If
Log "=== SCRIPT ENDED ==="`;

function generateVbs(params: { tcode: string; tcodeName: string; dateFrom: string; dateTo: string; plant: string }): string {
  return VBS_TEMPLATE
    .replace(/__TCODE__/g, params.tcode)
    .replace(/__TCODE_NAME__/g, params.tcodeName)
    .replace(/__DATE_FROM__/g, params.dateFrom)
    .replace(/__DATE_TO__/g, params.dateTo)
    .replace(/__PLANT__/g, params.plant);
}

// ─── UTF-8 → base64 (browser-safe untuk non-Latin1) ───
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ─── Generate .bat dengan VBS di-base64 ───
function generateBat(params: {
  tcode: string; tcodeName: string; dateFrom: string; dateTo: string;
  plant: string; apiUrl: string;
}): string {
  const vbsContent = generateVbs(params);
  const b64 = utf8ToBase64(vbsContent);
  const now = new Date();
  const ts = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;

  return `@echo off
chcp 65001 >nul
title SAP Auto Import - ${params.tcode}
color 0A
echo ============================================
echo   SAP Auto Import: ${params.tcode}
echo   ${params.tcodeName}
echo   SPINDO Warehouse Daily Report
echo ============================================
echo.
echo Parameters:
echo   TCode:  ${params.tcode}
echo   Date:   ${params.dateFrom} - ${params.dateTo}
echo   Plant:  ${params.plant}
echo   Time:   ${ts}
echo.
echo ------------------------------------------------------------
echo Step 1/3: Menyiapkan script VBS...
echo ------------------------------------------------------------
echo.

:: Decode base64 ke temp VBS file
powershell -Command "$c=[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')); Set-Content -Path \"$env:TEMP\\sap_auto_import.vbs\" -Value $c -Encoding ASCII" >nul 2>&1

if %ERRORLEVEL% NEQ 0 (
    echo Gagal membuat script VBS! ^(%ERRORLEVEL%^)
    pause
    exit /b 1
)
echo   OK - VBS script siap.

echo.
echo ------------------------------------------------------------
echo Step 2/3: Menjalankan SAP GUI automation...
echo ------------------------------------------------------------
echo   Pastikan SAP Logon sudah jalan dan login ke P23.
echo   JANGAN sentuh mouse/keyboard selama script berjalan!
echo.
cscript //NoLogo "%TEMP%\\sap_auto_import.vbs"
echo.

echo ------------------------------------------------------------
echo Step 3/3: Upload hasil ke dashboard...
echo ------------------------------------------------------------
echo.

powershell -Command "& {
    $$dir = Join-Path $$env:USERPROFILE 'Desktop\\SAP_AUTO'
    if (-not (Test-Path $$dir)) { $$dir = $$env:TEMP }
    $$latest = Get-ChildItem $$dir -Filter '${params.tcode}_*.xlsx' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($$latest) {
        Write-Host ('Uploading: ' + $$latest.FullName)
        try {
            $$r = Invoke-WebRequest '${params.apiUrl}' -Method POST -Form @{ file = (Get-Item $$latest.FullName); label = '${params.tcode} ${params.dateFrom} - ${params.dateTo}' } -UseBasicParsing -ErrorAction Stop
            $$res = $$r.Content | ConvertFrom-Json
            Write-Host ''
            Write-Host ('============================================')
            Write-Host ('  UPLOAD BERHASIL!')
            Write-Host ('  Session : ' + $$res.reportSessionId)
            Write-Host ('  Data    : ' + $$res.movementCount + ' transaksi')
            Write-Host ('  Label   : ' + $$res.label)
            Write-Host ('============================================')
        } catch {
            Write-Host ''
            Write-Host ('============================================')
            Write-Host ('  UPLOAD GAGAL')
            Write-Host ('  ' + $$_.Exception.Message)
            Write-Host ('============================================')
            Write-Host ''
            Write-Host 'Upload manual buka Dashboard -^> Upload -^> Pilih File'
            Write-Host ('  File: ' + $$latest.FullName)
        }
    } else {
        Write-Host 'Tidak ada file export ditemukan.'
        Write-Host 'Coba export manual dari SAP GUI.'
    }
}"
echo.
echo Selesai! Tekan sembarang tombol...
pause >nul`;
}

// ─── T-CODE DEFINITIONS ───
const TCODE_LIST = [
  {
    id: 'ZMMSMB51',
    name: 'Material Movement Report',
    desc: 'Download data transaksi material movement (setara MB51)',
    icon: Truck,
    apiEndpoint: '/api/sap/mb51-auto-import',
    color: 'emerald' as const,
  },
  {
    id: 'ZPPSHSTOCK',
    name: 'Daily Stock Report',
    desc: 'Download data stock per hari',
    icon: Database,
    apiEndpoint: '/api/sap/mb51-auto-import',
    color: 'blue' as const,
  },
];

export default function SAPAutoImportPage() {
  const router = useRouter();
  const [selectedTcode, setSelectedTcode] = useState(TCODE_LIST[0].id);
  const [dateFrom, setDateFrom] = useState(weekAgoStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [plant, setPlant] = useState('P001');

  const currentTcode = TCODE_LIST.find(t => t.id === selectedTcode)!;

  const handleDownload = () => {
    const batContent = generateBat({
      tcode: currentTcode.id,
      tcodeName: currentTcode.name,
      dateFrom,
      dateTo,
      plant,
      apiUrl: `http://localhost:3000${currentTcode.apiEndpoint}`,
    });

    const blob = new Blob([batContent], { type: 'application/bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAP_AUTO_${currentTcode.id}_${dateFrom.replace(/\./g, '')}-${dateTo.replace(/\./g, '')}.bat`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#C4E2F5]/20 via-white to-[#C4E2F5]/20 selection:bg-[#4BB8FA]/25 selection:text-[#2C5EAD]">
      <PageHeader icon={Terminal} iconBg="bg-gradient-to-br from-emerald-500 to-emerald-700" title="SAP Auto Import" subtitle="Download script — double klik — data otomatis masuk dashboard" className="print:hidden">
        <button onClick={() => router.push('/')}
          className="h-7 px-3 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 bg-white border border-[#C4E2F5]/60 text-[#1591DC] shadow-sm hover:bg-[#C4E2F5]/20"
        >Kembali</button>
      </PageHeader>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl shadow-[#1591DC]/5 border border-[#C4E2F5]/40 overflow-hidden">
          <div className="p-6 border-b border-[#C4E2F5]/30 bg-gradient-to-r from-emerald-50/50 to-white">
            <h2 className="text-lg font-bold text-[#2C5EAD] flex items-center gap-2">
              <Terminal size={18} className="text-emerald-500" />
              Pilih Jenis Data
            </h2>
          </div>
          <div className="p-6 space-y-5">
            {/* T-Code Cards */}
            <div className="grid grid-cols-2 gap-3">
              {TCODE_LIST.map(tc => {
                const isActive = selectedTcode === tc.id;
                const Icon = tc.icon;
                const c = isActive
                  ? tc.color === 'emerald'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-500';
                return (
                  <button key={tc.id} onClick={() => setSelectedTcode(tc.id)}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${c} ${isActive ? 'shadow-md' : 'hover:border-slate-300 hover:shadow-sm'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                      isActive ? (tc.color === 'emerald' ? 'bg-emerald-100' : 'bg-blue-100') : 'bg-slate-100'
                    }`}>
                      <Icon size={20} className={isActive ? (tc.color === 'emerald' ? 'text-emerald-600' : 'text-blue-600') : 'text-slate-400'} />
                    </div>
                    <p className={`text-sm font-bold ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>{tc.id}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{tc.name}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{tc.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Parameters */}
            <div className="border-t border-slate-100 pt-5">
              <p className="text-[11px] font-bold text-[#2C5EAD]/70 mb-3 uppercase tracking-wider">Parameter</p>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-[#2C5EAD]/60 mb-1 block">Date From</label>
                  <input type="text" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full h-10 text-sm font-bold text-[#2C5EAD] bg-slate-50/50 border border-[#C4E2F5]/50 rounded-xl px-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-[#2C5EAD]/60 mb-1 block">Date To</label>
                  <input type="text" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full h-10 text-sm font-bold text-[#2C5EAD] bg-slate-50/50 border border-[#C4E2F5]/50 rounded-xl px-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono" />
                </div>
                <div className="w-28">
                  <label className="text-[10px] font-semibold text-[#2C5EAD]/60 mb-1 block">Plant</label>
                  <input type="text" value={plant} onChange={e => setPlant(e.target.value)}
                    className="w-full h-10 text-sm font-bold text-[#2C5EAD] bg-slate-50/50 border border-[#C4E2F5]/50 rounded-xl px-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono" />
                </div>
              </div>
            </div>

            {/* Download Button */}
            <button onClick={handleDownload}
              className="w-full h-14 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white font-bold text-sm flex items-center justify-center gap-3 shadow-lg shadow-emerald-200/50 active:scale-[0.98] transition-all">
              <Download size={18} />
              Download Script — Klik 2x Langsung Jalan
            </button>

            {/* Cara Pakai */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800 text-sm">
              <AlertTriangle size={20} className="shrink-0 text-amber-500" />
              <div>
                <p className="font-bold mb-1">⚠️ Cara Pakai:</p>
                <ol className="list-decimal ml-5 space-y-1">
                  <li>Klik tombol di atas — download file <strong>.bat</strong></li>
                  <li>Login SAP GUI ke P23 (jangan ditutup)</li>
                  <li><strong>Double klik</strong> file .bat yang sudah di-download</li>
                  <li>Script otomatis: buka transaksi → set tgl → export Excel → upload ke web!</li>
                  <li>Buka dashboard — data langsung muncul 🎉</li>
                </ol>
                <p className="mt-2 text-xs text-amber-600">Jangan sentuh keyboard/mouse selama script VBS jalan di SAP.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
