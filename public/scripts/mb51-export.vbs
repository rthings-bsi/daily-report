' ============================================================
' MB51 EXPORT — Material Document List (Material Movements)
' ============================================================
' CARA PAKAI (dari SAP GUI):
'   SAP GUI -> Script -> Load Script -> pilih file ini -> Execute
'
' CARA PAKAI (dari command line / auto):
'   cscript //NoLogo mb51-export.vbs
'
' PARAMETER (edit bagian KONFIGURASI di bawah):
'   TransactionCode = transaksi SAP
'   DateFrom/DateTo  = range tanggal (DD.MM.YYYY)
'   Plant            = plant code (P001 dll)
'   Material         = material number (opsional)
'   StorageLoc/SLoc  = storage location (opsional)
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
    If Not ts Is Nothing Then
        ts.WriteLine "[" & Now & "] " & msg
        ts.Close
    End If
    On Error Goto 0
    WScript.Echo msg
End Sub

' ════════════════════════════════════════════
'   K O N F I G U R A S I
' ════════════════════════════════════════════

TransactionCode = "MB51"
DateFrom = ""          ' Format: DD.MM.YYYY (contoh: 01.07.2026)
DateTo = ""            ' Format: DD.MM.YYYY
Material = ""          ' Kosongkan untuk semua material
Plant = "P001"         ' Plant code
StorageLoc = ""        ' Kosongkan untuk semua SLoc
MovementType = ""      ' Kosongkan untuk semua movement type

' ════════════════════════════════════════════

Log "=== MB51 EXPORT STARTED ==="
Log "Transaction: " & TransactionCode
Log "Date: " & DateFrom & " - " & DateTo
Log "Material: " & Material
Log "Plant: " & Plant
Log "SLoc: " & StorageLoc
Log "Movement Type: " & MovementType

' ─── Konek ke SAP GUI ───
Dim SapGui, Engine, Connection, Session
Set SapGui = GetObject("SAPGUI")
If SapGui Is Nothing Then
    Log "ERROR: SAP GUI tidak ditemukan"
    MsgBox "SAP GUI tidak ditemukan! Pastikan SAP GUI sudah berjalan.", vbCritical, "MB51 Error"
    WScript.Quit 1
End If

Set Engine = SapGui.GetScriptingEngine()
If Engine.Connections.Count = 0 Then
    Log "ERROR: Tidak ada koneksi SAP aktif"
    MsgBox "Tidak ada koneksi SAP. Login ke P23 dulu.", vbCritical, "MB51 Error"
    WScript.Quit 1
End If

Set Connection = Engine.Connections(0)
Set Session = Connection.Sessions(0)
Log "Connected: " & Connection.Description & " | " & Session.Name
Log "User: " & Session.Info.UserName

' ─── Tutup semua popup ───
Sub TutupPopup()
    Dim i, w
    For i = 1 To 5
        On Error Resume Next
        w = "wnd[" & i & "]"
        Dim p : Set p = Session.findById(w)
        If Err.Number = 0 Then
            Dim bPaths, j
            bPaths = Array(w & "/tbar[0]/btn[0]", w & "/tbar[0]/btn[1]", w & "/tbar[0]/btn[2]", w & "/usr/btnSPB_YES", w & "/usr/btnSPB_NO", w & "/tbar[0]/btn[12]")
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

' ─── Cek apakah kita sudah di transaksi yang benar ───
Dim currentTrans : currentTrans = ""
On Error Resume Next
currentTrans = Session.findById("wnd[0]/tbar[0]/okcd").text
On Error Goto 0
Log "Current transaction: '" & currentTrans & "'"

' ─── Navigasi ke transaksi ───
If Len(TransactionCode) > 0 Then
    Log "Navigating to /n" & TransactionCode & " ..."
    On Error Resume Next
    Session.findById("wnd[0]/tbar[0]/okcd").text = "/n" & TransactionCode
    If Err.Number = 0 Then
        Log "  OK code set"
        ' Gunakan Enter button (btn[0]) bukan sendVKey — sendVKey bisa hang/nonaktif
        On Error Resume Next
        Session.findById("wnd[0]/tbar[0]/btn[0]").press()
        If Err.Number = 0 Then
            Log "  Enter button pressed"
        Else
            Log "  WARN: btn[0] error: " & Err.Description
            ' Fallback: coba btn[12] atau sendVKey
            On Error Resume Next
            Session.findById("wnd[0]/tbar[0]/btn[12]").press()
            If Err.Number = 0 Then Log "  btn[12] pressed (Enter alt)" : Err.Clear
        End If
    Else
        Log "ERROR: Cannot set transaction: " & Err.Description
        Err.Clear
    End If
    On Error Goto 0
    
    ' Tunggu navigasi
    WScript.Sleep 3000
    TutupPopup
    
    ' Verifikasi transaksi
    On Error Resume Next
    Dim newTrans : newTrans = Session.findById("wnd[0]/tbar[0]/okcd").text
    Log "  New transaction: '" & newTrans & "'"
    On Error Goto 0
End If

' ─── Set parameter seleksi MB51 ───
' MB51 fields (try multiple possible IDs)
Log "Setting selection parameters..."

Sub SetField(patterns, value)
    If Len(value) = 0 Then Exit Sub
    Dim k
    For k = 0 To UBound(patterns)
        On Error Resume Next
        Session.findById(patterns(k)).text = value
        If Err.Number = 0 Then
            Log "  " & patterns(k) & " = " & value
            Exit For
        End If
        On Error Goto 0
    Next
End Sub

' Posting Date
Dim datePats : datePats = Array("wnd[0]/usr/ctxtS_BUDAT-LOW", "wnd[0]/usr/ctxtS_DATE-LOW", "wnd[0]/usr/ctxtSO_DATE-LOW", "wnd[0]/usr/ctxtP_DATE-LOW", "wnd[0]/usr/ctxtP_DATUM-LOW", "wnd[0]/usr/ctxtS_DATUM-LOW")
Dim datePatsH : datePatsH = Array("wnd[0]/usr/ctxtS_BUDAT-HIGH", "wnd[0]/usr/ctxtS_DATE-HIGH", "wnd[0]/usr/ctxtSO_DATE-HIGH", "wnd[0]/usr/ctxtP_DATE-HIGH", "wnd[0]/usr/ctxtP_DATUM-HIGH", "wnd[0]/usr/ctxtS_DATUM-HIGH")
SetField datePats, DateFrom
SetField datePatsH, DateTo

' Material
Dim matPats : matPats = Array("wnd[0]/usr/ctxtS_MATNR-LOW", "wnd[0]/usr/ctxtS_MAT-LOW", "wnd[0]/usr/ctxtRMMG1-MATNR")
SetField matPats, Material

' Plant
Dim plantPats : plantPats = Array("wnd[0]/usr/ctxtS_WERKS-LOW", "wnd[0]/usr/ctxtS_WERK-LOW", "wnd[0]/usr/ctxtP_WERKS-LOW")
SetField plantPats, Plant

' Storage Location
Dim slocPats : slocPats = Array("wnd[0]/usr/ctxtS_LGORT-LOW", "wnd[0]/usr/ctxtS_LGOBE-LOW")
SetField slocPats, StorageLoc

' Movement Type
Dim mvtPats : mvtPats = Array("wnd[0]/usr/ctxtS_BWART-LOW", "wnd[0]/usr/ctxtS_BWART-LOW", "wnd[0]/usr/ctxtSO_BWART-LOW")
SetField mvtPats, MovementType

WScript.Sleep 1000

' ─── Execute (F8) — gunakan toolbar button bukan sendVKey ───
Log "Executing report..."
On Error Resume Next
' F8 = btn[8] di toolbar — Execute
Session.findById("wnd[0]/tbar[0]/btn[8]").press()
If Err.Number = 0 Then
    Log "  Execute button (F8) pressed"
Else
    Log "  WARN: btn[8] error: " & Err.Description
    ' Fallback: coba sendVKey 8
    Err.Clear
    On Error Resume Next
    Session.findById("wnd[0]").sendVKey 8
    If Err.Number = 0 Then
        Log "  sendVKey 8 OK"
    Else
        Log "  sendVKey 8 FAILED: " & Err.Description
    End If
End If
On Error Goto 0

WScript.Sleep 5000
TutupPopup

' ─── Export ───
Log "Exporting data..."
Dim exported : exported = False

' Method 1: ALV Grid Spreadsheet button
On Error Resume Next
Session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").pressButton("&MYXLS")
If Err.Number = 0 Then exported = True : Log "  EXPORT: ALV spreadsheet button"
On Error Goto 0

' Method 2: ALV context menu button
If Not exported Then
    On Error Resume Next
    Session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").pressToolbarContextButton("&MYXLS")
    If Err.Number = 0 Then exported = True : Log "  EXPORT: ALV context button"
    On Error Goto 0
End If

' Method 3: Menu System > List > Save > Local File
Dim menuPaths : menuPaths = Array( _
    "wnd[0]/mbar/menu[0]/menu[4]/menu[1]", _
    "wnd[0]/mbar/menu[4]/menu[2]", _
    "wnd[0]/mbar/menu[0]/menu[5]/menu[2]", _
    "wnd[0]/mbar/menu[0]/menu[3]/menu[1]")
Dim m
For m = 0 To UBound(menuPaths)
    If Not exported Then
        On Error Resume Next
        Session.findById(menuPaths(m)).select()
        If Err.Number = 0 Then exported = True : Log "  EXPORT: Menu " & m
        On Error Goto 0
    End If
Next

If Not exported Then
    Log "  EXPORT: Automatic export failed — user must export manually"
End If

WScript.Sleep 3000
TutupPopup

' ─── Save Dialog ───
Log "Looking for save dialog..."
Dim saved : saved = False
Dim timestamp : timestamp = Year(Now) & Right("0" & Month(Now), 2) & Right("0" & Day(Now), 2) & "_" & Right("0" & Hour(Now), 2) & Right("0" & Minute(Now), 2) & Right("0" & Second(Now), 2)
Dim fName : fName = "MB51_Export_" & timestamp & ".xlsx"

Dim winIdx
For winIdx = 1 To 5
    On Error Resume Next
    Dim tf : Set tf = Session.findById("wnd[" & winIdx & "]/usr/ctxtDY_PATH")
    If Err.Number = 0 Then
        Session.findById("wnd[" & winIdx & "]/usr/ctxtDY_PATH").text = DownloadDir
        Session.findById("wnd[" & winIdx & "]/usr/ctxtDY_FILENAME").text = fName
        WScript.Sleep 500
        Session.findById("wnd[" & winIdx & "]/tbar[0]/btn[0]").press()
        saved = True
        Log "  File saved: " & DownloadDir & "\" & fName
        Exit For
    End If
    On Error Goto 0
Next

' ─── Result ───
If saved Then
    Log "=== SUCCESS: " & DownloadDir & "\" & fName & " ==="
    WScript.Echo "RESULTFILE=" & DownloadDir & "\" & fName
Else
    Log "=== MANUAL SAVE REQUIRED ==="
    Log "Simpan file sebagai: " & DownloadDir & "\" & fName
    WScript.Echo "PENDINGMANUAL=" & DownloadDir
End If

Log "=== MB51 EXPORT ENDED ==="
