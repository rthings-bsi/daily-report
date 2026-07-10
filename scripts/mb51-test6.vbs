' TEST 6: Check session count before accessing
Dim SapGui, Engine, Connection
Set SapGui = GetObject("SAPGUI")
If SapGui Is Nothing Then WScript.Echo "FAIL: No SAPGUI" : WScript.Quit 1

Set Engine = SapGui.GetScriptingEngine()
Set Connection = Engine.Connections.Item(0)
WScript.Echo "CONNECTION: " & Connection.Description

' Just check session count
On Error Resume Next
Dim sessCount : sessCount = Connection.Sessions.Count
If Err.Number = 0 Then
    WScript.Echo "Sessions Count: " & sessCount
Else
    WScript.Echo "Sessions Count ERROR: " & Err.Description
    Err.Clear
End If

WScript.Echo "TEST_END"
