'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  FileCode,
  Building2,
  Calendar,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Terminal,
  ChevronDown,
  ChevronUp,
  Info,
  Download,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DebugLog {
  text: string;
  time: string;
}

export const SapGuiImport: React.FC = () => {
  const [transactionCode, setTransactionCode] = useState('');
  const [plant, setPlant] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [mvtType, setMvtType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloaded' | 'syncing' | 'success' | 'error'>('idle');
  const [downloadRunId, setDownloadRunId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    sessionId?: string;
    movements?: number;
    stocks?: number;
    stockCards?: number;
    message?: string;
  } | null>(null);
  const [syncMessage, setSyncMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = (runId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/sap/import-file?runId=${runId}`);
        const data = await res.json();
        if (data.status === 'success' && data.sessionId) {
          setSyncResult(data);
          setDownloadStatus('success');
          setSyncMessage(data.message || 'Data berhasil di-import!');
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === 'error') {
          setDownloadStatus('error');
          setSyncMessage(data.message || 'Gagal meng-import data');
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === 'pending') {
          setSyncMessage(data.message || 'Menunggu file...');
        } else {
          setSyncMessage('Menunggu script SAP GUI dijalankan...');
        }
      } catch {
        // silent
      }
    }, 3000);
  };

  const generateRunId = () => {
    return 'run_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
  };

  const downloadInternalScript = () => {
    const fmt = (d: string) => d ? d.split('-').reverse().join('.') : '';
    const df = fmt(dateFrom);
    const dt = fmt(dateTo);
    const runId = generateRunId();
    const timestamp = new Date().toISOString().replace(/[:.TZ-]/g, '').slice(0, 14);
    const fileName = `SAP_Export_${timestamp}.xlsx`;

    const content = `' ============================================================
' SCRIPT EXPORT DATA DARI SAP GUI (FULL AUTOMATION)
' Generated: ${new Date().toLocaleString('id-ID')}
' ============================================================
' CARA PAKAI:
' 1. Buka SAP GUI, login ke P23
' 2. Klik menu: Script -> Load Script
' 3. Pilih file ini -> Open
' 4. Klik Execute/Play
' 5. TUNGGU hingga muncul pesan selesai
' ============================================================

Dim FSO : Set FSO = CreateObject("Scripting.FileSystemObject")
Dim WshShell : Set WshShell = CreateObject("WScript.Shell")
Dim Desktop : Desktop = FSO.GetSpecialFolder(2)
Dim DownloadDir : DownloadDir = Desktop & "\\SAP_Export"
If Not FSO.FolderExists(DownloadDir) Then FSO.CreateFolder DownloadDir

Dim ExportFile : ExportFile = DownloadDir & "\\${fileName}"
Dim LogFile : LogFile = DownloadDir & "\\script_log.txt"

Sub Log(msg)
    Dim ts
    On Error Resume Next
    Set ts = FSO.OpenTextFile(LogFile, 8, True)
    If Not ts Is Nothing Then
        ts.WriteLine "[" & Now & "] " & msg
        ts.Close
    End If
    On Error Goto 0
End Sub

Sub Wait(sec)
    WScript.Sleep sec * 1000
End Sub

Sub ClosePopups()
    Dim i, w, btnPaths, j
    For i = 1 To 5
        On Error Resume Next
        w = "wnd[" & i & "]"
        Dim popup : Set popup = Session.findById(w)
        If Err.Number = 0 Then
            btnPaths = Array(w & "/tbar[0]/btn[0]", w & "/tbar[0]/btn[1]", w & "/usr/btnSPB_SAVE", w & "/usr/btnSPB_YES")
            For j = 0 To UBound(btnPaths)
                On Error Resume Next
                Session.findById(btnPaths(j)).press
                If Err.Number = 0 Then Wait 0.5 : Exit For
                On Error Goto 0
            Next
        End If
        On Error Goto 0
    Next
End Sub

Sub TrySetField(patterns, value)
    Dim k
    For k = 0 To UBound(patterns)
        On Error Resume Next
        Session.findById(patterns(k)).text = value
        If Err.Number = 0 Then
            Log "  Set: " & patterns(k) & " = " & value
            Exit For
        End If
        On Error Goto 0
    Next
End Sub

Function TryExport()
    Dim exported : exported = False
    ' Method 1: ALV Spreadsheet
    On Error Resume Next
    Session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").pressButton "&MYXLS"
    If Err.Number = 0 Then exported = True
    On Error Goto 0
    If exported Then Log "  Export Method 1: ALV Spreadsheet" : TryExport = True : Exit Function

    ' Method 2: ALV context button
    On Error Resume Next
    Session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").pressToolbarContextButton "&MYXLS"
    If Err.Number = 0 Then exported = True
    On Error Goto 0
    If exported Then Log "  Export Method 2: ALV Context" : TryExport = True : Exit Function

    ' Method 3: Menu path
    Dim m, menuPaths
    menuPaths = Array("wnd[0]/mbar/menu[0]/menu[4]/menu[1]", "wnd[0]/mbar/menu[4]/menu[2]", "wnd[0]/mbar/menu[0]/menu[5]/menu[2]")
    For m = 0 To UBound(menuPaths)
        On Error Resume Next
        Session.findById(menuPaths(m)).select
        If Err.Number = 0 Then exported = True : Log "  Export Method 3: Menu" : Exit For
        On Error Goto 0
    Next
    If exported Then TryExport = True : Exit Function

    ' Method 4: try to press any available toolbar button
    On Error Resume Next
    Dim subShell : Set subShell = Session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell")
    If Err.Number = 0 Then
        subShell.pressToolbarContextButton "&PRINT"
        If Err.Number = 0 Then Log "  Export Method 4: PRINT button" : exported = True
        Err.Clear
    End If
    On Error Goto 0
    If Not exported Then
        On Error Resume Next
        Session.findById("wnd[0]/mbar/menu[0]/menu[2]").select
        Wait 1
        Session.findById("wnd[0]/mbar/menu[0]/menu[2]/menu[6]").select
        If Err.Number = 0 Then Log "  Export Method 4: List->Save->File" : exported = True
        On Error Goto 0
    End If
    TryExport = exported
End Function

Function TrySaveDialog()
    Dim winIdx, saved
    saved = False
    For winIdx = 1 To 5
        On Error Resume Next
        Dim tf : Set tf = Session.findById("wnd[" & winIdx & "]/usr/ctxtDY_PATH")
        If Err.Number = 0 Then
            Log "  Save dialog at wnd[" & winIdx & "]"
            Session.findById("wnd[" & winIdx & "]/usr/ctxtDY_PATH").text = DownloadDir
            Session.findById("wnd[" & winIdx & "]/usr/ctxtDY_FILENAME").text = "${fileName}"
            Wait 0.5
            Session.findById("wnd[" & winIdx & "]/tbar[0]/btn[0]").press
            Log "  File save pressed"
            saved = True
            Exit For
        End If
        On Error Goto 0
    Next
    TrySaveDialog = saved
End Function

Sub NotifyWebApp(status, msg)
    On Error Resume Next
    Dim http
    Set http = CreateObject("MSXML2.XMLHTTP")
    If http Is Nothing Then Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    If Not http Is Nothing Then
        Dim payload : payload = "{""runId"":""${runId}"",""status"":""" & status & """,""message"":""" & msg & """,""filePath"":""" & ExportFile & """}"
        http.Open "POST", "http://localhost:3000/api/sap/import-file", False
        http.SetRequestHeader "Content-Type", "application/json"
        http.Send payload
        Log "WebApp response: " & http.Status
    Else
        Log "WebApp: HTTP object not available"
    End If
    On Error Goto 0
End Sub

' Scan untuk field yang ada di screen SAP (diagnostic)
Sub ScanFieldIds(prefix, names, suffix)
    Dim n, id
    For Each n In names
        id = prefix & n & suffix
        On Error Resume Next
        Dim e : Set e = Session.findById(id)
        If Err.Number = 0 Then
            Log "  EXISTS: " & id
        End If
        On Error Goto 0
    Next
End Sub

' ==================== MAIN ====================

Log "=== SCRIPT STARTED ==="

' --- Connect to SAP GUI ---
Dim SapGui, Engine, Connection, Session
Set SapGui = GetObject("SAPGUI")
If SapGui Is Nothing Then
    MsgBox "SAP GUI tidak ditemukan! Pastikan SAP GUI sudah terbuka dan login.", vbCritical, "Error"
    Log "ERROR: GetObject SAPGUI failed"
    NotifyWebApp "error", "GetObject SAPGUI failed"
    WScript.Quit 1
End If

Set Engine = SapGui.GetScriptingEngine()
If Engine.Connections.Count = 0 Then
    MsgBox "Tidak ada koneksi SAP aktif! Pastikan sudah login ke P23.", vbCritical, "Error"
    Log "ERROR: No connections"
    NotifyWebApp "error", "No connections"
    WScript.Quit 1
End If

Set Connection = Engine.Connections(0)
Set Session = Connection.Sessions(0)
Log "Connected: " & Connection.Description
Log "Session: " & Session.Name
NotifyWebApp "running", "Connected to SAP GUI"

' --- Navigate to Transaction ---
Dim tc : tc = "${transactionCode}"
Log "Navigating to: " & tc
On Error Resume Next
Session.StartTransaction tc
If Err.Number <> 0 Then
    Log "StartTransaction failed: " & Err.Description
    Err.Clear
    Session.findById("wnd[0]/tbar[0]/okcd").text = "/n" & tc
    Session.findById("wnd[0]").sendVKey 0
End If
On Error Goto 0
Wait 3
ClosePopups
Log "Transaction: " & tc
NotifyWebApp "running", "Navigated to " & tc

' --- DIAGNOSE SCREEN FIELDS ---
Log "=== SCREEN DIAGNOSTIC ==="
Log "-- Scanning ctxt (text fields) --"
ScanFieldIds "wnd[0]/usr/ctxt", Array("S_DATE-LOW","S_DATE-HIGH","SO_DATE-LOW","SO_DATE-HIGH","P_DATE","P_DATE-LOW","P_DATE-HIGH","P_DATUM","S_DATUM-LOW","S_DATUM-HIGH","P_BUDAT","S_BUDAT-LOW","S_BUDAT-HIGH","S_CPUDT-LOW","S_CPUDT-HIGH","P_CPUDT","S_BEDAT-LOW","S_BEDAT-HIGH","P_BEDAT","S_ERDAT-LOW","S_ERDAT-HIGH","P_ERDAT"), ""
ScanFieldIds "wnd[0]/usr/ctxt", Array("S_WERKS-LOW","S_WERKS-HIGH","P_WERKS","S_WERK-LOW","P_WERK","SO_WERKS-LOW","SO_WERKS-HIGH"), ""
ScanFieldIds "wnd[0]/usr/ctxt", Array("S_LGORT-LOW","S_LGORT-HIGH","P_LGORT","SO_LGORT-LOW","SO_LGORT-HIGH","S_LGORT-LOW","S_LGORT-HIGH","P_LGORT","SO_LGORT-LOW","SO_LGORT-HIGH"), ""
ScanFieldIds "wnd[0]/usr/ctxt", Array("S_BWART-LOW","S_BWART-HIGH","P_BWART","SO_BWART-LOW","SO_BWART-HIGH","S_BWART-LOW","S_BWART-HIGH","P_BWART","SO_BWART-LOW","SO_BWART-HIGH","S_MVGR-LOW","S_MVGR-HIGH","P_MVGR"), ""
ScanFieldIds "wnd[0]/usr/ctxt", Array("S_MATNR-LOW","S_MATNR-HIGH","P_MATNR","SO_MATNR-LOW","SO_MATNR-HIGH","S_MATERIAL-LOW","S_MATERIAL-HIGH","P_MATERIAL","S_CHARG-LOW","S_CHARG-HIGH","P_CHARG"), ""
Log "-- Scanning all ctxt fields (generic) --"
Dim gi
For gi = 1 To 20
    On Error Resume Next
    Dim gf : Set gf = Session.findById("wnd[0]/usr/ctxtP_D" & Right("0" & gi, 2))
    If Err.Number = 0 Then Log "  EXISTS: wnd[0]/usr/ctxtP_D" & Right("0" & gi, 2)
    On Error Goto 0
Next
Log "=== END DIAGNOSTIC ==="

' --- Fill Parameters ---
Dim df_val : df_val = "${df}"
Dim dt_val : dt_val = "${dt}"
Dim pt_val : pt_val = "${plant}"
Dim sl_val : sl_val = "${storageLocation}"
Dim mv_val : mv_val = "${mvtType}"

If Len(df_val) > 0 Then
    TrySetField Array("wnd[0]/usr/ctxtS_DATE-LOW","wnd[0]/usr/ctxtSO_DATE-LOW","wnd[0]/usr/ctxtP_DATE","wnd[0]/usr/ctxtP_DATUM","wnd[0]/usr/ctxtS_DATUM-LOW","wnd[0]/usr/ctxtP_BUDAT","wnd[0]/usr/ctxtS_BUDAT-LOW","wnd[0]/usr/ctxtS_CPUDT-LOW","wnd[0]/usr/ctxtP_CPUDT","wnd[0]/usr/ctxtS_BEDAT-LOW","wnd[0]/usr/ctxtP_BEDAT","wnd[0]/usr/ctxtS_ERDAT-LOW","wnd[0]/usr/ctxtP_ERDAT"), df_val
End If
If Len(dt_val) > 0 Then
    TrySetField Array("wnd[0]/usr/ctxtS_DATE-HIGH","wnd[0]/usr/ctxtSO_DATE-HIGH","wnd[0]/usr/ctxtS_DATUM-HIGH","wnd[0]/usr/ctxtS_BUDAT-HIGH","wnd[0]/usr/ctxtS_CPUDT-HIGH","wnd[0]/usr/ctxtS_BEDAT-HIGH","wnd[0]/usr/ctxtS_ERDAT-HIGH"), dt_val
End If
If Len(pt_val) > 0 Then
    TrySetField Array("wnd[0]/usr/ctxtS_WERKS-LOW","wnd[0]/usr/ctxtP_WERKS","wnd[0]/usr/ctxtS_WERK-LOW","wnd[0]/usr/ctxtP_WERK","wnd[0]/usr/ctxtSO_WERKS-LOW"), pt_val
End If
If Len(sl_val) > 0 Then
    TrySetField Array("wnd[0]/usr/ctxtS_LGORT-LOW","wnd[0]/usr/ctxtP_LGORT","wnd[0]/usr/ctxtSO_LGORT-LOW","wnd[0]/usr/ctxtS_LGORT-HIGH","wnd[0]/usr/ctxtSO_LGORT-HIGH"), sl_val
End If
If Len(mv_val) > 0 Then
    TrySetField Array("wnd[0]/usr/ctxtS_BWART-LOW","wnd[0]/usr/ctxtP_BWART","wnd[0]/usr/ctxtSO_BWART-LOW","wnd[0]/usr/ctxtS_BWART-HIGH","wnd[0]/usr/ctxtSO_BWART-HIGH","wnd[0]/usr/ctxtS_MVGR-LOW","wnd[0]/usr/ctxtP_MVGR"), mv_val
End If
NotifyWebApp "running", "Parameters filled"

' --- Execute ---
Log "Executing..."
On Error Resume Next
Session.findById("wnd[0]").sendVKey 8
If Err.Number <> 0 Then
    Log "sendVKey 8 failed: " & Err.Description
    ' Try Enter key instead
    Err.Clear
    Session.findById("wnd[0]").sendVKey 0
End If
On Error Goto 0
Wait 8
ClosePopups
Log "Execute done"
NotifyWebApp "running", "Executed, waiting for data"

' --- Export to Excel ---
Log "Exporting..."
Dim exportedOK : exportedOK = TryExport()
If exportedOK Then
    Log "Export initiated"
Else
    Log "Export methods failed"
End If
NotifyWebApp "running", "Exporting to Excel"

' --- Wait for save dialog ---
Wait 5

' --- Handle Save Dialog ---
Dim savedOK : savedOK = TrySaveDialog()
If savedOK Then
    Log "File saved: " & ExportFile
Else
    Log "Save dialog not found after export"
End If

' Wait for file to be written
Wait 3

' --- Verify file ---
Dim fileExists : fileExists = FSO.FileExists(ExportFile)
If fileExists Then
    Log "SUCCESS: File verified"
    NotifyWebApp "success", "Export completed"
    MsgBox "EXPORT BERHASIL!" & vbCrLf & vbCrLf & "File: " & ExportFile & vbCrLf & vbCrLf & "Data sedang disinkron ke web app...", vbInformation, "Sukses"
Else
    Log "File not found after save"
    NotifyWebApp "pending", "Manual save needed"
    MsgBox "Export selesai, tapi file tidak terdeteksi." & vbCrLf & vbCrLf & "Silakan simpan file Excel ke:" & vbCrLf & DownloadDir & vbCrLf & "dengan nama: ${fileName}", vbInformation, "Simpan Manual"
End If

Log "=== SCRIPT ENDED ==="
`;
    const blob = new Blob([content], { type: 'text/vbscript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export-${transactionCode || 'SAP'}-${new Date().toISOString().split('T')[0]}.vbs`;
    a.click();
    URL.revokeObjectURL(url);

    setDownloadRunId(runId);
    setDownloadStatus('downloaded');
    setSyncMessage('Script didownload! Jalankan di SAP GUI (Script → Load Script → Execute).');
    setSyncResult(null);
    startPolling(runId);
  };

  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [resultData, setResultData] = useState<{
    sessionId?: string;
    movementsCount?: number;
    stocksCount?: number;
    stockCardsCount?: number;
    pendingManual?: boolean;
    downloadDir?: string;
  } | null>(null);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const addLog = (text: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDebugLogs(prev => [...prev, { text, time }]);
  };

  const handleStart = async () => {
    if (!transactionCode) return;

    setStatus('running');
    setStatusMessage('Menjalankan SAP GUI Scripting...');
    setResultData(null);
    setDebugLogs([]);
    addLog('Memulai SAP GUI Scripting...');
    addLog(`Transaksi: ${transactionCode}`);

    try {
      const res = await fetch('/api/sap/gui-scripting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionCode,
          plant: plant || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
      });

      const result = await res.json();

      if (result.debugLogs && Array.isArray(result.debugLogs)) {
        result.debugLogs.forEach((log: string) => addLog(log));
      }

      if (result.success && result.sessionId) {
        setStatus('success');
        setStatusMessage(result.message || 'Data berhasil di-import dari SAP!');
        setResultData({
          sessionId: result.sessionId,
          movementsCount: result.movementsCount,
          stocksCount: result.stocksCount,
          stockCardsCount: result.stockCardsCount,
        });
        addLog(`SUCCESS: Session ID = ${result.sessionId}`);
      } else if (result.success && result.pendingManual) {
        setStatus('success');
        setStatusMessage(result.message || 'Silakan simpan file Excel dari SAP GUI');
        setResultData({
          pendingManual: true,
          downloadDir: result.downloadDir,
        });
        addLog('PENDING: Menunggu export manual dari SAP GUI');
      } else {
        setStatus('error');
        setStatusMessage(result.message || result.error || 'Gagal menjalankan SAP GUI Scripting');
        addLog(`ERROR: ${result.message || result.error || 'Unknown error'}`);
        addLog('TIP: Pastikan: (1) SAP GUI sudah login, (2) Scripting diaktifkan, (3) Tidak ada popup/dialog');
      }
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(err.message || 'Gagal terhubung ke server');
      addLog(`FETCH ERROR: ${err.message}`);
    }
  };

  const resetForm = () => {
    setStatus('idle');
    setStatusMessage('');
    setResultData(null);
    setDebugLogs([]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-sm">
            <Monitor size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">SAP GUI Scripting</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Otomatisasi via aplikasi SAP GUI desktop
            </p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mx-6 mt-4 space-y-2">
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800 space-y-1">
              <p className="font-medium">Syarat Auto (TOMOL DI BAWAH):</p>
              <ol className="list-decimal pl-4 space-y-0.5 text-amber-700">
                <li>SAP GUI harus <strong>sudah login</strong> ke P23</li>
                <li>SAP GUI Scripting harus <strong>diaktifkan</strong>:
                  SAP GUI &rarr; Options &rarr; Scripting &rarr; centang "Enable scripting"</li>
                <li>Tutup semua popup/dialog SAP sebelum menjalankan</li>
              </ol>
            </div>
          </div>
        </div>
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-start gap-2">
            <Terminal size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-800 space-y-1">
              <p className="font-medium">Alternatif: Jalankan script dari DALAM SAP GUI</p>
              <ol className="list-decimal pl-4 space-y-0.5 text-blue-700">
                <li>Download script: <button onClick={downloadInternalScript} className="underline font-medium hover:text-blue-900 cursor-pointer">export-dari-sap-gui.vbs ↗</button></li>
                <li>Buka SAP GUI, login ke P23, buka transaksi yang diinginkan</li>
                <li>Klik menu SAP GUI: <strong>Script &rarr; Load Script</strong></li>
                <li>Pilih file yang didownload, klik Open</li>
                <li>Klik Execute/Play</li>
                <li>File akan tersimpan di <code>Desktop\SAP_Export\SAP_Export.xlsx</code></li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <AnimatePresence mode="wait">
        {status === 'idle' || status === 'error' ? (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 space-y-4"
          >
            {/* Transaction Code */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                <FileCode size={12} />
                Transaction Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={transactionCode}
                onChange={e => setTransactionCode(e.target.value.toUpperCase())}
                placeholder="ZMMR001, MB5B, ..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white/50"
              />
            </div>

            {/* Plant & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                  <Building2 size={12} />
                  Plant (opsional)
                </label>
                <input
                  type="text"
                  value={plant}
                  onChange={e => setPlant(e.target.value.toUpperCase())}
                  placeholder="SPINDO"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white/50"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                  <Building2 size={12} />
                  Sloc (opsional)
                </label>
                <input
                  type="text"
                  value={storageLocation}
                  onChange={e => setStorageLocation(e.target.value.toUpperCase())}
                  placeholder="S001"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white/50"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                  <FileCode size={12} />
                  Mvt Type (opsional)
                </label>
                <input
                  type="text"
                  value={mvtType}
                  onChange={e => setMvtType(e.target.value.toUpperCase())}
                  placeholder="101, 102, 311"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white/50"
                />
              </div>
            </div>
            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                  <Calendar size={12} />
                  Dari
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white/50"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                  <Calendar size={12} />
                  Sampai
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white/50"
                />
              </div>
            </div>

            {/* Error */}
            {status === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 rounded-lg"
              >
                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <div className="text-xs text-red-700 leading-relaxed">{statusMessage}</div>
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center gap-2">
              <button
                onClick={handleStart}
                disabled={!transactionCode}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl shadow-lg active:scale-[0.97] transition-all',
                  transactionCode
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-emerald-500/30 hover:shadow-emerald-600/40'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                )}
              >
                <Play size={15} />
                Jalankan Scripting
              </button>
              <button
                onClick={async () => {
                  setStatus('running');
                  setStatusMessage('Menjalankan test koneksi SAP GUI (max 30 detik)...');
                  setDebugLogs([]);
                  addLog('Memulai test koneksi SAP GUI...');
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => {
                    controller.abort();
                    addLog('TIMEOUT: Request terlalu lama (30 detik)');
                  }, 30000);
                  try {
                    const res = await fetch('/api/sap/gui-test', { signal: controller.signal });
                    clearTimeout(timeoutId);
                    const result = await res.json();
                    if (result.output) {
                      result.output.forEach((l: string) => addLog(l));
                    }
                    if (result.stderr && result.stderr.length > 0) {
                      result.stderr.forEach((l: string) => addLog('STDERR: ' + l));
                    }
                    if (result.success) {
                      setStatus('idle');
                      setStatusMessage('Test selesai. Lihat log di bawah.');
                    } else {
                      setStatus('error');
                      setStatusMessage(result.error || 'Test gagal');
                    }
                  } catch (err: any) {
                    clearTimeout(timeoutId);
                    addLog('ERROR: ' + (err.name === 'AbortError' ? 'Request timeout (30 detik)' : err.message));
                    setStatus('error');
                    setStatusMessage(err.name === 'AbortError' ? 'Request timeout. Script SAP GUI mungkin hang.' : err.message || 'Gagal test');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
                title="Test koneksi SAP GUI tanpa menjalankan transaksi"
              >
                <Terminal size={13} />
                Test Connection
              </button>
              </div>
              {status === 'error' && (
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                >
                  Reset
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Script akan mengontrol SAP GUI yang sedang terbuka. Jangan menggunakan SAP GUI selama proses berjalan.
            </p>
          </motion.div>
        ) : null}

        {/* Download / Sync Status */}
        <AnimatePresence mode="wait">
          {downloadStatus !== 'idle' && (
            <motion.div
              key="sync"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-6 space-y-4"
            >
              {downloadStatus === 'downloaded' || downloadStatus === 'syncing' ? (
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <Loader2 size={20} className="text-blue-600 animate-spin shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-800">Menunggu script dijalankan...</p>
                    <p className="text-xs text-blue-600">{syncMessage}</p>
                    <button
                      onClick={() => {
                        if (downloadRunId) {
                          setDownloadStatus('syncing');
                          setSyncMessage('Memeriksa status...');
                          startPolling(downloadRunId);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
                    >
                      <RefreshCw size={11} />
                      Cek status
                    </button>
                  </div>
                </div>
              ) : downloadStatus === 'success' ? (
                <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-emerald-800">Import Berhasil!</h4>
                    <p className="text-xs text-emerald-700 mt-1">{syncMessage}</p>
                    {syncResult && (
                      <div className="flex gap-3 mt-3">
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-center min-w-[60px]">
                          <p className="text-lg font-bold text-emerald-700">{syncResult.movements ?? 0}</p>
                          <p className="text-[10px] text-emerald-600">Movements</p>
                        </div>
                        <div className="p-2 bg-teal-50 border border-teal-200 rounded-lg text-center min-w-[60px]">
                          <p className="text-lg font-bold text-teal-700">{syncResult.stocks ?? 0}</p>
                          <p className="text-[10px] text-teal-600">Stocks</p>
                        </div>
                      </div>
                    )}
                    {syncResult?.sessionId && (
                      <button
                        onClick={() => { window.location.href = `/?session=${syncResult.sessionId}`; }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 mt-3 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all"
                      >
                        <ExternalLink size={12} />
                        Lihat Report
                      </button>
                    )}
                  </div>
                </div>
              ) : downloadStatus === 'error' ? (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                  <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-800">Import Gagal</h4>
                    <p className="text-xs text-red-700 mt-1">{syncMessage}</p>
                  </div>
                </div>
              ) : null}

              {(downloadStatus === 'success' || downloadStatus === 'error') && (
                <button
                  onClick={() => setDownloadStatus('idle')}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                >
                  Tutup
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Running */}
        {status === 'running' && (
          <motion.div
            key="running"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 space-y-4"
          >
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <Loader2 size={20} className="text-emerald-600 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Menjalankan SAP GUI Scripting...</p>
                <p className="text-xs text-emerald-600/70 mt-0.5">
                  Jangan gunakan SAP GUI selama proses. Perhatikan SAP GUI — mungkin ada popup yang perlu ditutup.
                </p>
              </div>
            </div>

            {/* Debug */}
            <div>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                <Terminal size={12} />
                {showDebug ? 'Sembunyikan' : 'Lihat'} log detail
                {showDebug ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              <AnimatePresence>
                {showDebug && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2"
                  >
                    <div className="bg-slate-900 text-green-400 rounded-lg p-3 font-mono text-[11px] max-h-40 overflow-y-auto space-y-1">
                      {debugLogs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-slate-500 shrink-0">[{log.time}]</span>
                          <span>{log.text}</span>
                        </div>
                      ))}
                      {debugLogs.length === 0 && (
                        <span className="text-slate-500 italic">Menunggu log...</span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Success */}
        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 space-y-4"
          >
            {resultData?.pendingManual ? (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <Info size={24} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-800">Export Manual Diperlukan</h4>
                  <p className="text-sm text-amber-700 mt-1">{statusMessage}</p>
                  <p className="text-xs text-amber-600 mt-2">
                    Di SAP GUI: klik menu <strong>System &rarr; List &rarr; Save &rarr; Local File &rarr; Spreadsheet</strong>, 
                    atau klik tombol <strong>Excel/Spreadsheet</strong> di toolbar. Simpan file <strong>SAP_Export.xlsx</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <CheckCircle2 size={24} className="text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-emerald-800">Import Berhasil!</h4>
                    <p className="text-sm text-emerald-700 mt-1">{statusMessage}</p>
                  </div>
                </div>

                {resultData && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-center">
                      <p className="text-2xl font-bold text-emerald-700">{resultData.movementsCount ?? 0}</p>
                      <p className="text-[11px] text-emerald-600">Movements</p>
                    </div>
                    <div className="p-3 bg-teal-50 border border-teal-100 rounded-lg text-center">
                      <p className="text-2xl font-bold text-teal-700">{resultData.stocksCount ?? 0}</p>
                      <p className="text-[11px] text-teal-600">Stocks</p>
                    </div>
                    <div className="p-3 bg-cyan-50 border border-cyan-100 rounded-lg text-center">
                      <p className="text-2xl font-bold text-cyan-700">{resultData.stockCardsCount ?? 0}</p>
                      <p className="text-[11px] text-cyan-600">Stock Cards</p>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center gap-3">
              {resultData?.sessionId && (
                <button
                  onClick={() => { window.location.href = `/?session=${resultData.sessionId}`; }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-medium rounded-xl hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-500/30 active:scale-[0.97] transition-all"
                >
                  <CheckCircle2 size={15} />
                  Lihat Report
                </button>
              )}
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
              >
                {resultData?.pendingManual ? 'Cek Ulang' : 'Import Lagi'}
              </button>
            </div>

            {/* Debug */}
            <div>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                <Terminal size={12} />
                {showDebug ? 'Sembunyikan' : 'Lihat'} log detail
                {showDebug ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              <AnimatePresence>
                {showDebug && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2"
                  >
                    <div className="bg-slate-900 text-green-400 rounded-lg p-3 font-mono text-[11px] max-h-40 overflow-y-auto space-y-1">
                      {debugLogs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-slate-500 shrink-0">[{log.time}]</span>
                          <span>{log.text}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
