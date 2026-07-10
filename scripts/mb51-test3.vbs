' TEST 3: Minimal — just list connections and sessions
Dim SapGui, Engine, connIdx, sessIdx
Set SapGui = GetObject("SAPGUI")
If SapGui Is Nothing Then WScript.Echo "FAIL: No SAPGUI" : WScript.Quit 1

Set Engine = SapGui.GetScriptingEngine()
WScript.Echo "Active Connections: " & Engine.Connections.Count

For connIdx = 0 To Engine.Connections.Count - 1
    Dim conn : Set conn = Engine.Connections(connIdx)
    WScript.Echo "Conn[" & connIdx & "]: " & conn.Description
    WScript.Echo "  Sessions: " & conn.Sessions.Count
    
    For sessIdx = 0 To conn.Sessions.Count - 1
        On Error Resume Next
        Dim sess : Set sess = conn.Sessions(sessIdx)
        If Err.Number = 0 Then
            WScript.Echo "  Sess[" & sessIdx & "]: " & sess.Name
        Else
            WScript.Echo "  Sess[" & sessIdx & "]: ERROR - " & Err.Description
        End If
        On Error Goto 0
    Next
Next

WScript.Echo "DONE"
