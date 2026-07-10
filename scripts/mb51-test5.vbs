' TEST 5: Full access with proper Item() syntax
Dim SapGui, Engine, Connection, Session
Set SapGui = GetObject("SAPGUI")
If SapGui Is Nothing Then WScript.Echo "FAIL: No SAPGUI" : WScript.Quit 1

Set Engine = SapGui.GetScriptingEngine()
Set Connection = Engine.Connections.Item(0)
WScript.Echo "CONNECTION: " & Connection.Description

' Access session via Item
On Error Resume Next
Set Session = Connection.Sessions.Item(0)
If Err.Number = 0 Then
    WScript.Echo "SESSION: " & Session.Name & " (" & Session.Info.UserName & ")"
Else
    WScript.Echo "SESSION ERROR: " & Err.Description
    WScript.Echo "Sessions count: " & Connection.Sessions.Count
    Err.Clear
    
    ' Try other session access methods
    On Error Resume Next
    Dim sessIdx
    For sessIdx = 0 To Connection.Sessions.Count - 1
        Set Session = Connection.Sessions.Item(sessIdx)
        If Err.Number = 0 Then
            WScript.Echo "  Sess[" & sessIdx & "]: " & Session.Name
        Else
            Err.Clear
        End If
    Next
    WScript.Quit 1
End If
On Error Goto 0

' Read OK code field
On Error Resume Next
Dim okcdField : Set okcdField = Session.findById("wnd[0]/tbar[0]/okcd")
If Err.Number = 0 Then
    WScript.Echo "OKCD: '" & okcdField.text & "'"
Else
    WScript.Echo "OKCD NOT FOUND: " & Err.Description
End If
On Error Goto 0

' Read status bar
On Error Resume Next
Dim statusText : statusText = Session.findById("wnd[0]/sbar").text
If Err.Number = 0 Then
    WScript.Echo "STATUS: " & statusText
End If
On Error Goto 0

' List all children of wnd[0]/usr to find selection fields
WScript.Echo "--- USR Children ---"
On Error Resume Next
Dim usr, childCount, c
Set usr = Session.findById("wnd[0]/usr")
If Err.Number = 0 Then
    childCount = usr.Children.Count
    WScript.Echo "usr children: " & childCount
    For c = 0 To childCount - 1
        Dim ch : Set ch = usr.Children(c)
        WScript.Echo "  child[" & c & "]: type=" & ch.Type & " id=" & ch.Id
        If c > 30 Then
            WScript.Echo "  ... (truncated)"
            Exit For
        End If
    Next
End If

WScript.Echo "TEST_END"
