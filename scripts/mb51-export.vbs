' ============================================================
' MB51 EXPORT — Material Document List (Material Movements)
' ============================================================
' CARA PAKAI (dari SAP GUI):
'   SAP GUI -> Script -> Load Script -> pilih file ini -> Execute
'
' CARA PAKAI (dari command line / auto):
'   C:\Windows\SysWOW64\cscript //NoLogo path\to\mb51-export.vbs
'
' PARAMETER (edit bagian KONFIGURASI di bawah):
'   TransactionCode = transaksi SAP (default: MB51)
'   DateFrom/DateTo  = range tanggal (DD.MM.YYYY)
'   Plant            = plant code (P001 dll)
'   Material         = material number (opsional)
'   StorageLoc       = storage location (opsional)
'   MovementType     = movement type (opsional)
'
' OUTPUT: Desktop\SAP_MB51\MB51_Export_YYYYMMDD_HHMMSS.xlsx
' ============================================================

' ─── FILE SYSTEM ───
Dim FSO : Set FSO = CreateObject("Scripting.FileSystemObject")
Dim Desktop : Desktop = FSO.GetSpecialFolder(2)
Dim DownloadDir : DownloadDir = Desktop & "\SAP_MB51"
If Not FSO.FolderExists(DownloadDir) Then FSO.CreateFolder DownloadDir
Dim LogFile : LogFile = DownloadDir & "\mb51_script_log.txt"

Sub Log(msg)
    Dim ts
    On Error Resume Next
    Set ts = FSO.OpenTextFile(LogFile, 8, True)
    If Not ts Is Nothing Then ts.WriteLine "[" & Now & "] " & msg : ts.Close
    On Error Goto 0
    WScript.Echo msg
End Sub

' ─── TIMEOUT HELPER ───
' VBScript doesn't have native timeout — we use a retry approach instead
Dim MAX_RETRIES : MAX_RETRIES = 30 ' ~30 seconds

Function WaitForSap(seconds)
    Dim i
    For i = 1 To seconds
        WScript.Sleep 1000
    Next
    WaitForSap = True
End Function

' ════════════════════════════════════════════
'   K O N F I G U R A S I
' ════════════════════════════════════════════

TransactionCode = "MB51"
DateFrom = ""          ' Format: DD.MM.YYYY
DateTo = ""            ' Format: DD.MM.YYYY
Material = ""          ' Kosongkan untuk semua
Plant = "P001"         ' Plant code
StorageLoc = ""        ' Kosongkan untuk semua SLoc
MovementType = ""      ' Kosongkan untuk semua movement type

' ════════════════════════════════════════════

Log "=== MB51 EXPORT STARTED ==="
Log "Transaction: " & TransactionCode
Log "Date: " & DateFrom & " - " & DateTo
Log "Plant: " & Plant

' ─── Konek ke SAP GUI ───
Dim SapGui, Engine, Connection, Session, sessIdx
Set SapGui = GetObject("SAPGUI")
If SapGui Is Nothing Then
    Log "ERROR: SAP GUI tidak ditemukan. Pastikan SAP GUI sudah berjalan."
    MsgBox "SAP GUI tidak ditemukan! Pastikan SAP GUI sudah berjalan dan scripting diaktifkan.", vbCritical, "Error"
    WScript.Quit 1
End If

Set Engine = SapGui.GetScriptingEngine()
If Engine.Connections.Count = 0 Then
    Log "ERROR: Tidak ada koneksi SAP aktif. Login ke P23 dulu."
    MsgBox "Tidak ada koneksi SAP. Login ke P23 dulu.", vbCritical, "Error"
    WScript.Quit 1
End If

Set Connection = Engine.Connections(0)
Log "Connection: " & Connection.Description & " (" & Connection.Sessions.Count & " session(s))"

' ─── Cari session yang tersedia ───
Set Session = Nothing
For sessIdx = 0 To Connection.Sessions.Count - 1
    On Error Resume Next
    Dim testSess : Set testSess = Connection.Sessions(sessIdx)
    If Err.Number = 0 Then
        On Error Goto 0
        ' Test if session is responsive by reading a simple property
        On Error Resume Next
        Dim testName : testName = testSess.Name
        If Err.Number = 0 Then
            Set Session = testSess
            Log "Using session " & sessIdx & ": " & testSess.Name
            Err.Clear
            Exit For
        End If
    End If
    On Error Goto 0
Next

If Session Is Nothing Then
    Log "ERROR: Tidak bisa mengakses session SAP. Mungkin sesi SAP sedang sibuk."
    Log "Coba tutup semua jendela SAP, buka ulang login ke P23, lalu jalankan ulang script."
    MsgBox "Tidak bisa mengakses session SAP." & vbCrLf & _
           "Coba: tutup SAP GUI, buka ulang, login P23, lalu jalankan ulang script.", _
           vbCritical, "Error"
    WScript.Quit 1
End If

Log "User: " & Session.Info.UserName

' ─── Tutup popup ───
Dim i, w
For i = 1 To 5
    On Error Resume Next
    w = "wnd[" & i & "]"
    Dim p : Set p = Session.findById(w)
    If Err.Number = 0 Then
        Dim bPaths, j
        bPaths = Array(w & "/tbar[0]/btn[0]", w & "/tbar[0]/btn[1]", w & "/tbar[0]/btn[2]", w & "/usr/btnSPB_YES")
        For j = 0 To UBound(bPaths)
            On Error Resume Next
            Session.findById(bPaths(j)).press()
            If Err.Number = 0 Then Log "Popup closed: " & bPaths(j) : Exit For
            On Error Goto 0
        Next
    End If
    On Error Goto 0
Next

' ─── Cek screen title ───
On Error Resume Next
Dim screenTitle : screenTitle = Session.findById("wnd[0]/titl").text
If Err.Number = 0 And Len(screenTitle) > 0 Then Log "Screen: " & screenTitle
On Error Goto 0

' ─── Cek status bar ───
On Error Resume Next
Dim sbar : sbar = Session.findById("wnd[0]/sbar").text
If Err.Number = 0 And Len(sbar) > 0 Then Log "Status: " & sbar
On Error Goto 0

' ─── Navigasi ───
If Len(TransactionCode) > 0 Then
    On Error Resume Next
    Session.findById("wnd[0]/tbar[0]/okcd").text = "/n" & TransactionCode
    If Err.Number = 0 Then
        Log "OK code: /n" & TransactionCode
        Err.Clear
        ' Try Enter button (don't use sendVKey — not always enabled)
        On Error Resume Next
        Session.findById("wnd[0]/tbar[0]/btn[0]").press()
        If Err.Number = 0 Then
            Log "  Enter pressed"
            WaitForSap 3
        Else
            Log "  Note: Enter button unavailable: " & Err.Description
        End If
    Else
        Log "  OK code field error: " & Err.Description
    End If
    On Error Goto 0
End If

' ─── Set parameter ───
Sub TrySetField(fieldIds, value)
    If Len(value) = 0 Then Exit Sub
    Dim k
    For k = 0 To UBound(fieldIds)
        On Error Resume Next
        Session.findById(fieldIds(k)).text = value
        If Err.Number = 0 Then
            Log "  " & fieldIds(k) & " = " & value
            Exit For
        End If
        On Error Goto 0
    Next
End Sub

' Posting Date (BUDAT or standard date fields)
TrySetField Array("wnd[0]/usr/ctxtS_BUDAT-LOW", "wnd[0]/usr/ctxtS_DATE-LOW", "wnd[0]/usr/ctxtSO_DATE-LOW", "wnd[0]/usr/ctxtP_DATE-LOW", "wnd[0]/usr/ctxtS_DATUM-LOW", "wnd[0]/usr/ctxtSO_DATUM-LOW"), DateFrom
TrySetField Array("wnd[0]/usr/ctxtS_BUDAT-HIGH", "wnd[0]/usr/ctxtS_DATE-HIGH", "wnd[0]/usr/ctxtSO_DATE-HIGH", "wnd[0]/usr/ctxtP_DATE-HIGH", "wnd[0]/usr/ctxtS_DATUM-HIGH", "wnd[0]/usr/ctxtSO_DATUM-HIGH"), DateTo
' Material
TrySetField Array("wnd[0]/usr/ctxtS_MATNR-LOW", "wnd[0]/usr/ctxtS_MAT-LOW"), Material
' Plant
TrySetField Array("wnd[0]/usr/ctxtS_WERKS-LOW", "wnd[0]/usr/ctxtS_WERK-LOW", "wnd[0]/usr/ctxtP_WERKS-LOW"), Plant
' Storage Location
TrySetField Array("wnd[0]/usr/ctxtS_LGORT-LOW", "wnd[0]/usr/ctxtS_LGOBE-LOW"), StorageLoc
' Movement Type
TrySetField Array("wnd[0]/usr/ctxtS_BWART-LOW", "wnd[0]/usr/ctxtSO_BWART-LOW"), MovementType

' ─── Execute ───
' Use toolbar button instead of sendVKey
Log "Executing..."
On Error Resume Next
' Try btn[8] = Execute (F8 equivalent as button)
Dim execBtn : Set execBtn = Session.findById("wnd[0]/tbar[0]/btn[8]")
If Err.Number = 0 Then
    execBtn.press()
    Log "  Execute via btn[8]"
Else
    Err.Clear
    ' Try any button that looks like execute
    On Error Resume Next
    Session.findById("wnd[0]/tbar[0]/btn[23]").press() ' Some SAP versions
    If Err.Number = 0 Then
        Log "  Execute via btn[23]"
    Else
        Log "  WARN: No execute button found — script may need manual F8"
    End If
End If
On Error Goto 0

WaitForSap 5

' Tutup popup setelah execute
For i = 1 To 5
    On Error Resume Next
    w = "wnd[" & i & "]"
    Set p = Session.findById(w)
    If Err.Number = 0 Then
        Dim bp, j2
        bp = Array(w & "/tbar[0]/btn[0]", w & "/tbar[0]/btn[1]", w & "/usr/btnSPB_YES")
        For j2 = 0 To UBound(bp)
            On Error Resume Next
            Session.findById(bp(j2)).press()
            If Err.Number = 0 Then Log "Popup: " & bp(j2) : Exit For
            On Error Goto 0
        Next
    End If
    On Error Goto 0
Next

' ─── Export ───
Log "Exporting..."
Dim exported : exported = False

On Error Resume Next
' Method 1: ALV Grid spreadsheet button
Session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").pressButton("&MYXLS")
If Err.Number = 0 Then exported = True : Log "  Method 1: ALV button OK"
On Error Goto 0

If Not exported Then
    On Error Resume Next
    Session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").pressToolbarContextButton("&MYXLS")
    If Err.Number = 0 Then exported = True : Log "  Method 2: ALV context OK"
    On Error Goto 0
End If

' Method 3: Menu
Dim menuPath
If Not exported Then
    Dim menuItems : menuItems = Array( _
        "wnd[0]/mbar/menu[0]/menu[4]/menu[1]", _
        "wnd[0]/mbar/menu[4]/menu[2]", _
        "wnd[0]/mbar/menu[0]/menu[5]/menu[2]")
    For Each menuPath In menuItems
        If Not exported Then
            On Error Resume Next
            Session.findById(menuPath).select()
            If Err.Number = 0 Then exported = True : Log "  Method 3: Menu OK"
            On Error Goto 0
        End If
    Next
End If

If Not exported Then
    Log "  WARN: Export otomatis gagal — perlu manual"
End If

WaitForSap 3

' ─── Save ───
Dim saved : saved = False
Dim timestamp : timestamp = Year(Now) & Right("0" & Month(Now), 2) & Right("0" & Day(Now), 2) & "_" & Right("0" & Hour(Now), 2) & Right("0" & Minute(Now), 2) & Right("0" & Second(Now), 2)
Dim fName : fName = "MB51_Export_" & timestamp & ".xlsx"
Dim wIdx

For wIdx = 1 To 5
    On Error Resume Next
    Dim tf : Set tf = Session.findById("wnd[" & wIdx & "]/usr/ctxtDY_PATH")
    If Err.Number = 0 Then
        Session.findById("wnd[" & wIdx & "]/usr/ctxtDY_PATH").text = DownloadDir
        Session.findById("wnd[" & wIdx & "]/usr/ctxtDY_FILENAME").text = fName
        WScript.Sleep 300
        Session.findById("wnd[" & wIdx & "]/tbar[0]/btn[0]").press()
        saved = True
        Log "  Saved: " & DownloadDir & "\" & fName
        Exit For
    End If
    On Error Goto 0
Next

If saved Then
    Log "=== SUCCESS ==="
    WScript.Echo "RESULTFILE=" & DownloadDir & "\" & fName
Else
    Log "=== MANUAL SAVE ==="
    WScript.Echo "PENDINGMANUAL=" & DownloadDir
End If

Log "=== MB51 EXPORT ENDED ==="
