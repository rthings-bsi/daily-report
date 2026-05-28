' SAP GUI Scripting Diagnostic Test
' Run from CMD: C:\Windows\SysWOW64\cscript.exe //Nologo scripts\test-sap-gui.vbs

WScript.Echo "==========================================="
WScript.Echo " SAP GUI Scripting Diagnostic Test"
WScript.Echo "==========================================="
WScript.Echo ""

' Check cscript bitness
Set WshShell = CreateObject("WScript.Shell")
Dim procArch : procArch = WshShell.ExpandEnvironmentStrings("%PROCESSOR_ARCHITECTURE%")
Dim procArchWow : procArchWow = WshShell.ExpandEnvironmentStrings("%PROCESSOR_ARCHITEW6432%")
If procArchWow <> "" Then procArch = procArchWow
WScript.Echo "CScript: " & WScript.FullName
WScript.Echo "Process: " & procArch
WScript.Echo ""

' Test 1: Try Sapgui.ScriptingCtrl.1 FIRST (faster/more reliable)
WScript.Echo "--- Test 1: CreateObject Sapgui.ScriptingCtrl.1 ---"
On Error Resume Next
Dim SapGui : Set SapGui = CreateObject("Sapgui.ScriptingCtrl.1")
If Err.Number = 0 Then
    WScript.Echo "  [OK] Sapgui.ScriptingCtrl.1 created"
    WScript.Echo "  Type: " & TypeName(SapGui)
Else
    WScript.Echo "  [FAIL] " & Err.Description & " (0x" & Hex(Err.Number) & ")"
    
    WScript.Echo ""
    WScript.Echo "--- Test 2: Try SapGui.Auto (fallback) ---"
    Err.Clear
    Set SapGui = CreateObject("SapGui.Auto")
    If Err.Number = 0 Then
        WScript.Echo "  [OK] SapGui.Auto created"
        WScript.Echo "  Type: " & TypeName(SapGui)
    Else
        WScript.Echo "  [FAIL] " & Err.Description & " (0x" & Hex(Err.Number) & ")"
        WScript.Echo ""
        WScript.Echo "==========================================="
        WScript.Echo " DIAGNOSIS: BOTH ProgIDs FAILED"
        WScript.Echo "==========================================="
        
        ' Check OCX
        Dim ocxPaths, ocxFound, i
        ocxPaths = Array( _
            "C:\Program Files (x86)\SAP\FrontEnd\SAPgui\sapfewse.ocx", _
            "C:\Program Files\SAP\FrontEnd\SAPgui\sapfewse.ocx" _
        )
        ocxFound = ""
        For i = 0 To UBound(ocxPaths)
            Set FSO = CreateObject("Scripting.FileSystemObject")
            If FSO.FileExists(ocxPaths(i)) Then ocxFound = ocxPaths(i) : Exit For
        Next
        
        If ocxFound <> "" Then
            WScript.Echo "OCX ditemukan: " & ocxFound
            WScript.Echo "Ukuran: " & FSO.GetFile(ocxFound).Size & " bytes"
            WScript.Echo ""
            WScript.Echo "Jalankan sebagai ADMIN:"
            WScript.Echo "  C:\Windows\SysWOW64\regsvr32.exe """ & ocxFound & """"
            WScript.Echo "Lalu RESTART komputer."
        Else
            WScript.Echo "OCX sapfewse.ocx TIDAK DITEMUKAN."
            WScript.Echo "Install SAP GUI dengan SAP GUI Scripting component."
        End If
        
        WScript.Quit 1
    End If
End If
Err.Clear
On Error Goto 0

WScript.Echo ""

' Test 3: GetScriptingEngine
WScript.Echo "--- Test 3: GetScriptingEngine ---"
On Error Resume Next
Dim Engine : Set Engine = SapGui.GetScriptingEngine()
If Err.Number = 0 Then
    WScript.Echo "  [OK] Engine obtained"
    WScript.Echo "  Type: " & TypeName(Engine)
Else
    WScript.Echo "  [FAIL] " & Err.Description
    WScript.Echo "  Pastikan SAP GUI Scripting diaktifkan di Options."
    WScript.Quit 1
End If
Err.Clear
On Error Goto 0

WScript.Echo ""

' Test 4: Check connections
WScript.Echo "--- Test 4: Connections ---"
On Error Resume Next
Dim connCount : connCount = Engine.Connections.Count
If Err.Number = 0 Then
    WScript.Echo "  Connections: " & connCount
    If connCount > 0 Then
        For i = 0 To connCount - 1
            Dim conn : Set conn = Engine.Connections(i)
            WScript.Echo "  Connection " & i & ": " & conn.Description
            WScript.Echo "    User: " & conn.User
            WScript.Echo "    Sessions: " & conn.Sessions.Count
        Next
    Else
        WScript.Echo ""
        WScript.Echo "  TIDAK ADA KONEKSI! Ini penyebab utama error."
        WScript.Echo ""
        WScript.Echo "  Kemungkinan penyebab:"
        WScript.Echo "  1. SAP GUI belum login (buka SAP Logon, login ke P23)"
        WScript.Echo "  2. SAP GUI perlu di-restart setelah registrasi COM"
        WScript.Echo "  3. Server P23 tidak mengizinkan scripting eksternal"
        WScript.Echo ""
        WScript.Echo "  Cek proses SAP GUI:"
        On Error Resume Next
        Dim procs : Set procs = GetObject("winmgmts:\\.\root\cimv2").ExecQuery("SELECT Name FROM Win32_Process WHERE Name='saplogon.exe' OR Name='sapgui.exe'")
        WScript.Echo "  Proses SAP ditemukan: " & (procs.Count > 0)
        If procs.Count = 0 Then
            WScript.Echo "  (Tidak ada proses SAP GUI berjalan)"
        End If
        On Error Goto 0
    End If
Else
    WScript.Echo "  [FAIL] " & Err.Description
End If
On Error Goto 0

WScript.Echo ""
WScript.Echo "==========================================="
WScript.Echo " TEST SELESAI"
WScript.Echo "==========================================="
