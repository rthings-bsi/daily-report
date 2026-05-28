' ============================================================
' SCRIPT EXPORT DATA DARI SAP GUI
' ============================================================
' CARA PAKAI:
' 1. Buka SAP GUI, login ke P23
' 2. Buka menu SAP GUI: Script -> Record and Playback
'    (Atau: Script -> Load Script jika sudah ada menu)
' 3. Klik "Load Script" -> pilih file ini -> Open
' 4. Klik Execute/Play
' 5. Script akan export data ke Desktop\SAP_Export\SAP_Export.xlsx
' ============================================================

Dim FSO : Set FSO = CreateObject("Scripting.FileSystemObject")
Dim Desktop : Desktop = FSO.GetSpecialFolder(2) ' Desktop
Dim DownloadDir : DownloadDir = Desktop & "\SAP_Export"
If Not FSO.FolderExists(DownloadDir) Then FSO.CreateFolder DownloadDir

Dim LogFile : LogFile = DownloadDir & "\script_log.txt"

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

Log "=== SCRIPT STARTED ==="

' Dapatkan session SAP yang sedang aktif
Dim SapGui, Engine, Connection, Session
Set SapGui = GetObject("SAPGUI")
If SapGui Is Nothing Then
    MsgBox "SAP GUI tidak ditemukan! Pastikan SAP GUI sudah berjalan.", vbCritical, "Error"
    Log "ERROR: SAP GUI tidak ditemukan"
    WScript.Quit 1
End If

Set Engine = SapGui.GetScriptingEngine()
If Engine.Connections.Count = 0 Then
    MsgBox "Tidak ada koneksi SAP aktif. Pastikan sudah login ke P23.", vbCritical, "Error"
    Log "ERROR: No active connections"
    WScript.Quit 1
End If

Set Connection = Engine.Connections(0)
Set Session = Connection.Sessions(0)

Log "Session: " & Session.Name
On Error Resume Next
Log "Description: " & Connection.Description
On Error Goto 0

' Tutup popup yang mungkin muncul
Sub TutupPopup()
    Dim i, w
    For i = 1 To 5
        On Error Resume Next
        w = "wnd[" & i & "]"
        Dim p : Set p = Session.findById(w)
        If Err.Number = 0 Then
            Dim btnPaths, j
            btnPaths = Array(w & "/tbar[0]/btn[0]", w & "/tbar[0]/btn[1]", w & "/usr/btnSPB_SAVE", w & "/usr/btnSPB_YES")
            For j = 0 To UBound(btnPaths)
                On Error Resume Next
                Session.findById(btnPaths(j)).press
                If Err.Number = 0 Then
                    Log "Popup closed: " & btnPaths(j)
                    WScript.Sleep 500
                    Exit For
                End If
                On Error Goto 0
            Next
        End If
        On Error Goto 0
    Next
End Sub

TutupPopup

' ===== KONFIGURASI TRANSAKSI =====
' GANTI nilai di bawah ini sesuai kebutuhan sebelum menjalankan script
TransactionCode = "ZMMR001"
DateFrom = ""    ' Format: DD.MM.YYYY atau kosongkan
DateTo = ""      ' Format: DD.MM.YYYY atau kosongkan
Plant = ""       ' Kode plant atau kosongkan

' Navigasi ke transaction
If Len(TransactionCode) > 0 Then
    Session.findById("wnd[0]/tbar[0]/okcd").text = "/n" & TransactionCode
    Session.findById("wnd[0]").sendVKey 0
    WScript.Sleep 3000
    TutupPopup
    Log "Transaction opened: " & TransactionCode
End If

' Isi parameter
If Len(DateFrom) > 0 Then
    On Error Resume Next
    Dim dps : dps = Array("wnd[0]/usr/ctxtS_DATE-LOW", "wnd[0]/usr/ctxtSO_DATE-LOW", "wnd[0]/usr/ctxtP_DATE-LOW", "wnd[0]/usr/ctxtP_DATUM-LOW")
    Dim d
    For d = 0 To UBound(dps)
        Session.findById(dps(d)).text = DateFrom
        If Err.Number = 0 Then Log "DateFrom set: " & dps(d) : Exit For
    Next
End If

If Len(DateTo) > 0 Then
    On Error Resume Next
    dps = Array("wnd[0]/usr/ctxtS_DATE-HIGH", "wnd[0]/usr/ctxtSO_DATE-HIGH", "wnd[0]/usr/ctxtP_DATE-HIGH", "wnd[0]/usr/ctxtP_DATUM-HIGH")
    For d = 0 To UBound(dps)
        Session.findById(dps(d)).text = DateTo
        If Err.Number = 0 Then Log "DateTo set: " & dps(d) : Exit For
    Next
End If

If Len(Plant) > 0 Then
    On Error Resume Next
    Dim pps : pps = Array("wnd[0]/usr/ctxtS_WERKS-LOW", "wnd[0]/usr/ctxtP_WERKS-LOW")
    For d = 0 To UBound(pps)
        Session.findById(pps(d)).text = Plant
        If Err.Number = 0 Then Log "Plant set: " & pps(d) : Exit For
    Next
End If

' Execute report (F8)
Session.findById("wnd[0]").sendVKey 8
WScript.Sleep 5000
TutupPopup
Log "Report executed"

' Export ke Excel
Session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").pressButton "&MYXLS"
WScript.Sleep 3000

' Save dialog
Dim winIdx, saved : saved = False
For winIdx = 1 To 5
    On Error Resume Next
    Dim tf : Set tf = Session.findById("wnd[" & winIdx & "]/usr/ctxtDY_PATH")
    If Err.Number = 0 Then
        Session.findById("wnd[" & winIdx & "]/usr/ctxtDY_PATH").text = DownloadDir
        Session.findById("wnd[" & winIdx & "]/usr/ctxtDY_FILENAME").text = "SAP_Export.xlsx"
        WScript.Sleep 500
        Session.findById("wnd[" & winIdx & "]/tbar[0]/btn[0]").press
        saved = True
        Exit For
    End If
    On Error Goto 0
Next

If saved Then
    Log "FILE SAVED: " & DownloadDir & "\SAP_Export.xlsx"
    MsgBox "Export berhasil!" & vbCrLf & vbCrLf & "File: " & DownloadDir & "\SAP_Export.xlsx", vbInformation, "SAP Export Sukses"
Else
    Log "MANUAL SAVE NEEDED"
    MsgBox "Silakan simpan file SAP_Export.xlsx ke folder:" & vbCrLf & DownloadDir, vbInformation, "Simpan Manual"
End If

Log "=== SCRIPT ENDED ==="
