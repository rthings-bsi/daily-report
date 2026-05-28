' SAP GUI Scripting via VBScript
' Usage: cscript //Nologo sap-gui-export.vbs TransactionCode DateFrom DateTo Plant DownloadDir

Dim TransactionCode, DateFrom, DateTo, Plant, DownloadDir, LogFile

' Parse arguments ('.' means empty)
TransactionCode = WScript.Arguments.Item(0)
DateFrom = WScript.Arguments.Item(1)
If DateFrom = "." Then DateFrom = ""
DateTo = WScript.Arguments.Item(2)
If DateTo = "." Then DateTo = ""
Plant = WScript.Arguments.Item(3)
If Plant = "." Then Plant = ""
DownloadDir = WScript.Arguments.Item(4)

Set FSO = CreateObject("Scripting.FileSystemObject")
LogFile = FSO.BuildPath(DownloadDir, "script.log")

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

Sub ClosePopups(session)
    Dim i, w, btnPaths, j, bpath
    For i = 1 To 5
        On Error Resume Next
        w = "wnd[" & i & "]"
        Dim popup : Set popup = session.findById(w)
        If Err.Number = 0 Then
            WriteLog "Closing popup at " & w
            btnPaths = Array(w & "/tbar[0]/btn[0]", w & "/tbar[0]/btn[1]", w & "/usr/btnSPB_YES", w & "/tbar[0]/btn[2]")
            For j = 0 To UBound(btnPaths)
                On Error Resume Next
                session.findById(btnPaths(j)).press
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

' === MAIN ===

If Not FSO.FolderExists(DownloadDir) Then
    FSO.CreateFolder DownloadDir
End If

WriteLog "VBScript started"
WScript.Echo "SCRIPTSTART"

' --- SAP GUI COM INIT ---
Dim SapGui
WriteLog "Mencoba GetObject('SAPGUI')..."
On Error Resume Next
Set SapGui = GetObject("SAPGUI")
If Err.Number = 0 Then
    WriteLog "GetObject SAPGUI: OK"
Else
    WriteLog "GetObject SAPGUI FAILED: " & Err.Description
    Err.Clear
    
    ' Try CreateObject SapGui.Auto
    WriteLog "Mencoba CreateObject SapGui.Auto..."
    Set SapGui = CreateObject("SapGui.Auto")
    If Err.Number = 0 Then
        WriteLog "SapGui.Auto: OK"
    Else
        WriteLog "SapGui.Auto FAILED: " & Err.Description
        Err.Clear
        
        ' Try CreateObject Sapgui.ScriptingCtrl.1
        WriteLog "Mencoba CreateObject Sapgui.ScriptingCtrl.1..."
        Set SapGui = CreateObject("Sapgui.ScriptingCtrl.1")
        If Err.Number = 0 Then
            WriteLog "Sapgui.ScriptingCtrl.1: OK"
        Else
            WriteLog "Sapgui.ScriptingCtrl.1 FAILED: " & Err.Description
            
            ' --- DIAGNOSIS ---
            Dim wshShell : Set wshShell = CreateObject("WScript.Shell")
            Dim winDir : winDir = wshShell.ExpandEnvironmentStrings("%SystemRoot%")
            WriteLog "--- DIAGNOSIS ---"
            
            ' Find OCX
            Dim ocxFound, sapGuiDir
            Dim ocxPaths : ocxPaths = Array( _
                "C:\Program Files (x86)\SAP\FrontEnd\SAPgui\sapfewse.ocx", _
                "C:\Program Files\SAP\FrontEnd\SAPgui\sapfewse.ocx", _
                "C:\Program Files (x86)\SAP\SAP GUI\FrontEnd\SAPgui\sapfewse.ocx" _
            )
            ocxFound = ""
            Dim oi
            For oi = 0 To UBound(ocxPaths)
                If FSO.FileExists(ocxPaths(oi)) Then ocxFound = ocxPaths(oi) : Exit For
            Next
            If ocxFound = "" Then
                Dim sapExeDir : sapExeDir = ""
                Dim sdi, sapDirs
                sapDirs = Array( _
                    "C:\Program Files (x86)\SAP\FrontEnd\SAPgui\", _
                    "C:\Program Files\SAP\FrontEnd\SAPgui\" _
                )
                For sdi = 0 To UBound(sapDirs)
                    If FSO.FolderExists(sapDirs(sdi)) Then
                        sapExeDir = sapDirs(sdi)
                        Dim ocxFile
                        For Each ocxFile In FSO.GetFolder(sapExeDir).Files
                            If LCase(ocxFile.Name) = "sapfewse.ocx" Then ocxFound = ocxFile.Path : Exit For
                        Next
                        Exit For
                    End If
                Next
                If ocxFound = "" Then
                    WScript.Echo "SCRIPT_ERROR=SAP GUI OCX (sapfewse.ocx) tidak ditemukan. Install SAP GUI dengan SAP GUI Scripting component."
                    WScript.Quit 1
                End If
            End If
            
            ' Try regsvr32
            WriteLog "OCX: " & ocxFound
            Dim sysReg : sysReg = winDir & "\SysWOW64\regsvr32.exe"
            If FSO.FileExists(sysReg) Then
                WriteLog "Run: " & sysReg & " /s """ & ocxFound & """"
                On Error Resume Next
                Dim rp : Set rp = wshShell.Exec(sysReg & " /s """ & ocxFound & """")
                Dim regTimer : regTimer = 0
                Do While rp.Status = 0 And regTimer < 50
                    WScript.Sleep 200 : regTimer = regTimer + 1
                Loop
                If rp.Status = 0 Then rp.Terminate : WriteLog "regsvr32 timeout"
                Dim rc : rc = rp.ExitCode
                Dim rs : rs = rp.StdErr.ReadAll()
                WriteLog "regsvr32 exit: " & rc
                If rs <> "" Then WriteLog "regsvr32: " & Replace(rs, vbCrLf, " | ")
                On Error Goto 0
                
                ' Retry GetObject first
                Set SapGui = GetObject("SAPGUI")
                If Err.Number = 0 Then
                    WriteLog "GetObject SAPGUI OK setelah regsvr32"
                Else
                    Err.Clear
                    Set SapGui = CreateObject("SapGui.Auto")
                    If Err.Number = 0 Then
                        WriteLog "SapGui.Auto OK setelah regsvr32"
                    Else
                        Err.Clear
                        Set SapGui = CreateObject("Sapgui.ScriptingCtrl.1")
                        If Err.Number = 0 Then
                            WriteLog "Sapgui.ScriptingCtrl.1 OK setelah regsvr32"
                        Else
                            If rc = 0 Then
                                WScript.Echo "SCRIPT_ERROR=regsvr32 sukses tapi COM masih error. RESTART KOMPUTER lalu coba lagi."
                            Else
                                WScript.Echo "SCRIPT_ERROR=regsvr32 gagal (exit " & rc & "). Buka CMD ADMIN, jalankan: " & sysReg & " """ & ocxFound & """ lalu RESTART."
                            End If
                            WScript.Quit 1
                        End If
                    End If
                End If
            Else
                WScript.Echo "SCRIPT_ERROR=regsvr32 32-bit tidak ditemukan."
                WScript.Quit 1
            End If
        End If
    End If
End If
On Error Goto 0

WriteLog "SAP GUI COM: OK (via " & TypeName(SapGui) & ")"

WriteLog "SAP GUI COM OK"

' Get scripting engine
Dim Engine
On Error Resume Next
Set Engine = SapGui.GetScriptingEngine()
If Err.Number <> 0 Then
    WriteLog "ERROR: GetScriptingEngine: " & Err.Description
    WScript.Echo "SCRIPT_ERROR=Enable SAP GUI Scripting: Options -> Scripting -> Enable scripting"
    WScript.Quit 1
End If
On Error Goto 0

WriteLog "Engine OK"

' Wait for connections with retry (SAP GUI may need time)
Dim connRetries, connIdx
connIdx = 0
For connRetries = 1 To 10
    If Engine.Connections.Count > 0 Then
        Exit For
    End If
    connIdx = connIdx + 1
    WriteLog "Menunggu koneksi SAP... (" & connIdx & "/10)"
    WScript.Sleep 2000
Next

If Engine.Connections.Count = 0 Then
    WriteLog "ERROR: No SAP connections after " & connIdx & " retries"
    
    ' Check if SAP GUI is running (via WMI - more reliable than tasklist)
    On Error Resume Next
    Dim sapRunning : sapRunning = False
    Dim wmiService : Set wmiService = GetObject("winmgmts:\\.\root\cimv2")
    If Err.Number = 0 Then
        Dim wmiProcs : Set wmiProcs = wmiService.ExecQuery("SELECT Name FROM Win32_Process WHERE Name='saplogon.exe' OR Name='sapgui.exe'")
        sapRunning = (wmiProcs.Count > 0)
    Else
        ' WMI failed, try tasklist as fallback
        Err.Clear
        Dim wshShell2 : Set wshShell2 = CreateObject("WScript.Shell")
        Dim procout2 : procout2 = wshShell2.Exec("cmd /c tasklist /NH /FI ""IMAGENAME eq saplogon.exe"" 2>nul").StdOut.ReadAll()
        sapRunning = InStr(1, procout2, "saplogon.exe", 1) > 0
        If Not sapRunning Then
            procout2 = wshShell2.Exec("cmd /c tasklist /NH /FI ""IMAGENAME eq sapgui.exe"" 2>nul").StdOut.ReadAll()
            sapRunning = InStr(1, procout2, "sapgui.exe", 1) > 0
        End If
    End If
    On Error Goto 0
    
    If sapRunning Then
        WriteLog "SAP GUI process terdeteksi (tapi koneksi tidak terlihat)"
        WScript.Echo "SCRIPT_ERROR=SAP GUI berjalan tapi koneksi tidak terlihat oleh scripting engine. Penyebab: (1) RESTART KOMPUTER dulu agar registrasi COM生效, (2) pastikan SAP GUI Scripting diaktifkan di SAP GUI: Options > Scripting > Enable scripting & Attach scripting to running sessions, (3) pastikan server P23 mengizinkan scripting (hubungi IT)"
    Else
        WScript.Echo "SCRIPT_ERROR=SAP GUI tidak terdeteksi. Buka SAP GUI, login ke P23, lalu coba lagi. Jika sudah buka tapi masih error, coba: (1) RESTART KOMPUTER, (2) buka SAP GUI > login ke P23, (3) coba lagi."
    End If
    WScript.Quit 1
End If

' Get connection and session
Dim Connection, Session
Set Connection = Engine.Connections(0)
WriteLog "Connection: " & Connection.Description
Set Session = Connection.Sessions(0)
WriteLog "Session: " & Session.Name
WriteLog "Session ID: " & Session.Id

' Close popups
ClosePopups Session

' Navigate to transaction
If Len(TransactionCode) > 0 Then
    WriteLog "Navigating to: " & TransactionCode
    On Error Resume Next
    Session.findById("wnd[0]/tbar[0]/okcd").text = "/n" & TransactionCode
    If Err.Number <> 0 Then
        WriteLog "ERROR setting transaction: " & Err.Description
        WScript.Echo "SCRIPT_ERROR=Gagal set transaction code: " & Err.Description
        WScript.Quit 1
    End If
    On Error Goto 0
    Session.findById("wnd[0]").sendVKey 0
    WScript.Sleep 3000
    ClosePopups Session
    WriteLog "Transaction opened"
End If

' Set Date From
If Len(DateFrom) > 0 Then
    WriteLog "Setting Date From: " & DateFrom
    Dim datePatterns
    datePatterns = Array("wnd[0]/usr/ctxtS_DATE-LOW", "wnd[0]/usr/ctxtSO_DATE-LOW", "wnd[0]/usr/ctxtP_DATE-LOW", "wnd[0]/usr/ctxtP_DATUM-LOW", "wnd[0]/usr/ctxtS_DATUM-LOW")
    For k = 0 To UBound(datePatterns)
        On Error Resume Next
        Session.findById(datePatterns(k)).text = DateFrom
        If Err.Number = 0 Then
            WriteLog "  Set via: " & datePatterns(k)
            Exit For
        End If
        On Error Goto 0
    Next
End If

' Set Date To
If Len(DateTo) > 0 Then
    WriteLog "Setting Date To: " & DateTo
    datePatterns = Array("wnd[0]/usr/ctxtS_DATE-HIGH", "wnd[0]/usr/ctxtSO_DATE-HIGH", "wnd[0]/usr/ctxtP_DATE-HIGH", "wnd[0]/usr/ctxtP_DATUM-HIGH", "wnd[0]/usr/ctxtS_DATUM-HIGH")
    For k = 0 To UBound(datePatterns)
        On Error Resume Next
        Session.findById(datePatterns(k)).text = DateTo
        If Err.Number = 0 Then
            WriteLog "  Set via: " & datePatterns(k)
            Exit For
        End If
        On Error Goto 0
    Next
End If

' Set Plant
If Len(Plant) > 0 Then
    WriteLog "Setting Plant: " & Plant
    Dim plantPatterns
    plantPatterns = Array("wnd[0]/usr/ctxtS_WERKS-LOW", "wnd[0]/usr/ctxtP_WERKS-LOW", "wnd[0]/usr/ctxtS_WERK-LOW")
    For k = 0 To UBound(plantPatterns)
        On Error Resume Next
        Session.findById(plantPatterns(k)).text = Plant
        If Err.Number = 0 Then
            WriteLog "  Set via: " & plantPatterns(k)
            Exit For
        End If
        On Error Goto 0
    Next
End If

' Execute (F8)
WriteLog "Executing (F8)..."
On Error Resume Next
Session.findById("wnd[0]").sendVKey 8
If Err.Number <> 0 Then WriteLog "F8 error (non-fatal): " & Err.Description
On Error Goto 0
WScript.Sleep 5000
ClosePopups Session

' ── EXPORT ──
WriteLog "Exporting to Excel..."
Dim exported : exported = False

' Method 1: ALV Spreadsheet button
On Error Resume Next
Session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").pressButton "&MYXLS"
If Err.Number = 0 Then
    WriteLog "  ALV Spreadsheet OK"
    exported = True
Else
    WriteLog "  ALV button not found"
End If
On Error Goto 0

' Method 2: ALV context button
If Not exported Then
    On Error Resume Next
    Session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").pressToolbarContextButton "&MYXLS"
    If Err.Number = 0 Then
        WriteLog "  ALV context OK"
        exported = True
    End If
    On Error Goto 0
End If

' Method 3: Menu path
If Not exported Then
    Dim menuPaths, m
    menuPaths = Array("wnd[0]/mbar/menu[0]/menu[4]/menu[1]", "wnd[0]/mbar/menu[4]/menu[2]", "wnd[0]/mbar/menu[0]/menu[5]/menu[2]")
    For m = 0 To UBound(menuPaths)
        If Not exported Then
            On Error Resume Next
            Session.findById(menuPaths(m)).select
            If Err.Number = 0 Then
                WriteLog "  Menu selected: " & menuPaths(m)
                exported = True
            End If
            On Error Goto 0
        End If
    Next
End If

' Method 4: Ctrl+Shift+F7
If Not exported Then
    WriteLog "  Trying Ctrl+Shift+F7"
    On Error Resume Next
    Session.findById("wnd[0]").sendVKey 79
    exported = True
    On Error Goto 0
    WScript.Sleep 2000
End If

WScript.Sleep 3000
ClosePopups Session

' ── SAVE DIALOG ──
WriteLog "Looking for save dialog..."
Dim savedFile : savedFile = False
Dim winIdx, winPath, testField

For winIdx = 1 To 5
    winPath = "wnd[" & winIdx & "]"
    On Error Resume Next
    Set testField = Session.findById(winPath & "/usr/ctxtDY_PATH")
    If Err.Number = 0 Then
        WriteLog "  Save dialog at " & winPath
        Session.findById(winPath & "/usr/ctxtDY_PATH").text = DownloadDir
        Session.findById(winPath & "/usr/ctxtDY_FILENAME").text = "SAP_Export.xlsx"
        WScript.Sleep 500
        Session.findById(winPath & "/tbar[0]/btn[0]").press
        WriteLog "  File path saved"
        savedFile = True
        Exit For
    End If
    On Error Goto 0
Next

If Not savedFile Then
    WriteLog "  No save dialog found"
    For winIdx = 1 To 3
        On Error Resume Next
        Session.findById("wnd[" & winIdx & "]/tbar[0]/btn[0]").press
        If Err.Number = 0 Then
            WriteLog "  Pressed button at wnd[" & winIdx & "]"
            WScript.Sleep 2000
        End If
        On Error Goto 0
    Next
End If

WScript.Sleep 5000

' ── CHECK RESULT ──
WriteLog "Checking for exported file..."
Dim exportFile, foundFiles

exportFile = FSO.BuildPath(DownloadDir, "SAP_Export.xlsx")
If FSO.FileExists(exportFile) Then
    WriteLog "SUCCESS: " & exportFile
    WScript.Echo "RESULTFILE=" & exportFile
Else
    On Error Resume Next
    Set foundFiles = FSO.GetFolder(DownloadDir).Files
    Dim found : found = False
    For Each f In foundFiles
        If InStr(f.Name, ".xlsx") > 0 Or InStr(f.Name, ".xls") > 0 Then
            WriteLog "SUCCESS: " & f.Path
            WScript.Echo "RESULTFILE=" & f.Path
            found = True
            Exit For
        End If
    Next
    If Not found Then
        WriteLog "File not found in " & DownloadDir
        WScript.Echo "PENDINGMANUAL=" & DownloadDir
    End If
    On Error Goto 0
End If

WScript.Echo "SCRIPTEND"
