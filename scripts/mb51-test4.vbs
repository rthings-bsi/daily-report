' TEST 4: Try different ways to access connections
Dim SapGui, Engine
Set SapGui = GetObject("SAPGUI")
If SapGui Is Nothing Then WScript.Echo "FAIL: No SAPGUI" : WScript.Quit 1

Set Engine = SapGui.GetScriptingEngine()
WScript.Echo "Engine type: " & TypeName(Engine)
WScript.Echo "Connections type: " & TypeName(Engine.Connections)
WScript.Echo "Connection count: " & Engine.Connections.Count

' Try accessing connection in different ways
On Error Resume Next
Dim conn0 : Set conn0 = Engine.Connections.Item(0)
If Err.Number = 0 Then
    WScript.Echo "Item(0): " & conn0.Description
Else
    WScript.Echo "Item(0) ERROR: " & Err.Description
    Err.Clear
End If

On Error Resume Next
Set conn0 = Engine.Connections("P23")
If Err.Number = 0 Then
    WScript.Echo "Connections(P23): " & conn0.Description
Else
    WScript.Echo "Connections(P23) ERROR: " & Err.Description
    Err.Clear
End If

On Error Resume Next
Dim connEnum : Set connEnum = Engine.Connections.GetEnumerator()
If Err.Number = 0 Then
    WScript.Echo "Enumerator OK — iterating:"
    While connEnum.MoveNext
        WScript.Echo "  Found: " & connEnum.Current.Description
    Wend
Else
    WScript.Echo "Enumerator ERROR: " & Err.Description
    Err.Clear
End If

On Error Goto 0

' Alternative: use SAP GUILauncherService
WScript.Echo "--- Alternative via SAP.LogonControl ---"
On Error Resume Next
Dim logonCtrl : Set logonCtrl = CreateObject("SAP.LogonControl.1")
If Err.Number = 0 Then
    WScript.Echo "LogonControl OK"
Else
    WScript.Echo "LogonControl ERROR: " & Err.Description
End If

On Error Resume Next
Dim rfcCtrl : Set rfcCtrl = CreateObject("SAP.Functions.Unicode")
If Err.Number = 0 Then
    WScript.Echo "Functions.Unicode OK"
Else
    WScript.Echo "Functions.Unicode NOT available: " & Err.Description
End If

WScript.Echo "TEST_END"
