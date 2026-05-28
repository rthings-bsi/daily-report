' SAP GUI Internal Script - dijalankan dari SAP GUI: Script -> Load Script
' Script ini punya akses PENUH ke sesi SAP yang sedang aktif.

' ===== KONFIGURASI =====
' Ubah nilai-nilai ini sesuai kebutuhan sebelum dijalankan:
TransactionCode = "ZMMR001"     ' Transaction code
DateFrom = ""                    ' Format: DD.MM.YYYY atau kosong
DateTo = ""                      ' Format: DD.MM.YYYY atau kosong
Plant = ""                       ' Plant code atau kosong

' ===== SCRIPT =====
Dim FSO : Set FSO = CreateObject("Scripting.FileSystemObject")
Dim DownloadDir : DownloadDir = FSO.GetSpecialFolder(2) & "\SAP_Export" ' Desktop\SAP_Export
If Not FSO.FolderExists(DownloadDir) Then FSO.CreateFolder DownloadDir

Dim LogFile : LogFile = DownloadDir & "\script.log"

Sub WriteLog(msg)
    Dim ts, line
    line = "[" & Hour(Now) & ":" & Right("0" & Minute(Now), 2) & ":" & Right("0" & Second(Now), 2) & "] " & msg
    WScript.Echo line
    On Error Resume Next
    Set ts = FSO.OpenTextFile(LogFile, 8, True)
    If Not ts Is Nothing Then
        ts.WriteLine line
        ts.Close
    End If
    On Error Goto 0
End Sub

WriteLog "=== SCRIPT STARTED ==="
WriteLog "Transaction: " & TransactionCode
WriteLog "Date From: " & DateFrom
WriteLog "Date To: " & DateTo
WriteLog "Plant: " & Plant
WriteLog "Download: " & DownloadDir

' Get current SAP session
Dim SapGui, Engine, Connection, Session
Set SapGui = GetObject("SAPGUI")
If SapGui Is Nothing Then
    MsgBox "SAP GUI tidak ditemukan!", vbCritical, "Error"
    WScript.Quit 1
End If

Set Engine = SapGui.GetScriptingEngine()
Set Connection = Engine.Connections(0)
Set Session = Connection.Sessions(0)

WriteLog "Session: " & Session.Name

' Close popups
Sub ClosePopups()
    Dim i, w, btnPaths, j
    For i = 1 To 5
        On Error Resume Next
        w = "wnd[" & i & "]"
        Dim popup : Set popup = Session.findById(w)
        If Err.Number = 0 Then
            WriteLog "Closing popup at " & w
            btnPaths = Array(w & "/tbar[0]/btn[0]", w & "/tbar[0]/btn[1]", w & "/usr/btnSPB_YES", w & "/tbar[0]/btn[2]")
            For j = 0 To UBound(btnPaths)
                On Error Resume Next
                Session.findById(btnPaths(j)).press
                If Err.Number = 0 Then
                    WriteLog "  Pressed " & btnPaths(j)
                    WScript.Sleep 500
                    Exit For
                End If
                On Error Goto 0
            Next
        End If
        On Error Goto 0
    Next
End Sub

ClosePopups

' Navigate to transaction
If Len(TransactionCode) > 0 Then
    WriteLog "Navigating to: " & TransactionCode
    Session.findById("wnd[0]/tbar[0]/okcd").text = "/n" & TransactionCode
    Session.findById("wnd[0]").sendVKey 0
    WScript.Sleep 3000
    ClosePopups
End If

' Set Date From
If Len(DateFrom) > 0 Then
    On Error Resume Next
    Dim datePatterns, k
    datePatterns = Array("wnd[0]/usr/ctxtS_DATE-LOW", "wnd[0]/usr/ctxtSO_DATE-LOW", "wnd[0]/usr/ctxtP_DATE-LOW", "wnd[0]/usr/ctxtP_DATUM-LOW", "wnd[0]/usr/ctxtS_DATUM-LOW")
    For k = 0 To UBound(datePatterns)
        Session.findById(datePatterns(k)).text = DateFrom
        If Err.Number = 0 Then
            WriteLog "Date From set via: " & datePatterns(k)
            Exit For
        End If
    Next
End If

' Set Date To
If Len(DateTo) > 0 Then
    On Error Resume Next
    datePatterns = Array("wnd[0]/usr/ctxtS_DATE-HIGH", "wnd[0]/usr/ctxtSO_DATE-HIGH", "wnd[0]/usr/ctxtP_DATE-HIGH", "wnd[0]/usr/ctxtP_DATUM-HIGH", "wnd[0]/usr/ctxtS_DATUM-HIGH")
    For k = 0 To UBound(datePatterns)
        Session.findById(datePatterns(k)).text = DateTo
        If Err.Number = 0 Then
            WriteLog "Date To set via: " & datePatterns(k)
            Exit For
        End If
    Next
End If

' Set Plant
If Len(Plant) > 0 Then
    On Error Resume Next
    Dim plantPatterns
    plantPatterns = Array("wnd[0]/usr/ctxtS_WERKS-LOW", "wnd[0]/usr/ctxtP_WERKS-LOW", "wnd[0]/usr/ctxtS_WERK-LOW")
    For k = 0 To UBound(plantPatterns)
        Session.findById(plantPatterns(k)).text = Plant
        If Err.Number = 0 Then
            WriteLog "Plant set via: " & plantPatterns(k)
            Exit For
        End If
    Next
End If

' Execute (F8)
WriteLog "Executing (F8)..."
Session.findById("wnd[0]").sendVKey 8
WScript.Sleep 5000
ClosePopups

' Export
WriteLog "Exporting..."
Dim exported : exported = False

' Method 1: ALV Spreadsheet button
On Error Resume Next
Session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").pressButton "&MYXLS"
If Err.Number = 0 Then exported = True
On Error Goto 0

' Method 2: Menu
If Not exported Then
    On Error Resume Next
    Dim menuPaths, m
    menuPaths = Array("wnd[0]/mbar/menu[0]/menu[4]/menu[1]", "wnd[0]/mbar/menu[4]/menu[2]")
    For m = 0 To UBound(menuPaths)
        If Not exported Then
            Session.findById(menuPaths(m)).select
            If Err.Number = 0 Then exported = True
        End If
    Next
    On Error Goto 0
End If

' Method 3: Ctrl+Shift+F7
If Not exported Then
    Session.findById("wnd[0]").sendVKey 79
    WScript.Sleep 2000
    exported = True
End If

If Not exported Then
    WriteLog "Export button not found - manual export needed"
    MsgBox "Tidak bisa export otomatis. Silakan export manual: System > List > Save > Local File > Spreadsheet", vbInformation, "SAP Export"
End If

WScript.Sleep 3000
ClosePopups

' Save dialog
Dim savedFile : savedFile = False
Dim winIdx, winPath
For winIdx = 1 To 5
    winPath = "wnd[" & winIdx & "]"
    On Error Resume Next
    Dim testField : Set testField = Session.findById(winPath & "/usr/ctxtDY_PATH")
    If Err.Number = 0 Then
        Session.findById(winPath & "/usr/ctxtDY_PATH").text = DownloadDir
        Session.findById(winPath & "/usr/ctxtDY_FILENAME").text = "SAP_Export.xlsx"
        WScript.Sleep 500
        Session.findById(winPath & "/tbar[0]/btn[0]").press
        savedFile = True
        WriteLog "File saved to: " & DownloadDir & "\SAP_Export.xlsx"
        Exit For
    End If
    On Error Goto 0
Next

If savedFile Then
    MsgBox "File tersimpan di:" & vbCrLf & DownloadDir & "\SAP_Export.xlsx", vbInformation, "SAP Export Berhasil"
Else
    MsgBox "Simpan file SAP_Export.xlsx ke folder:" & vbCrLf & DownloadDir, vbInformation, "Simpan Manual"
End If

WriteLog "=== SCRIPT ENDED ==="
