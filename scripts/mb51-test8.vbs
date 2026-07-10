' TEST 8: Minimal — just read title and current transaction, NO navigation
Dim SapGui, Engine, Connection, Session
Set SapGui = GetObject("SAPGUI")
If SapGui Is Nothing Then WScript.Echo "FAIL: No SAPGUI" : WScript.Quit 1

Set Engine = SapGui.GetScriptingEngine()
Set Connection = Engine.Connections(0)
Set Session = Connection.Sessions(0)
WScript.Echo "SESSION: " & Session.Name

On Error Resume Next
Dim t : t = Session.findById("wnd[0]/titl").text
If Err.Number = 0 Then WScript.Echo "TITLE: " & t Else WScript.Echo "NO_TITLE: " & Err.Description
Err.Clear

Dim o : o = Session.findById("wnd[0]/tbar[0]/okcd").text
If Err.Number = 0 Then WScript.Echo "OKCD: '" & o & "'" Else WScript.Echo "NO_OKCD: " & Err.Description
Err.Clear

' Count children of wnd[0] (top-level controls)
Dim n : n = Session.findById("wnd[0]").Children.Count
WScript.Echo "WND0 CHILDREN: " & n

Dim i
For i = 0 To n - 1
    Dim c : Set c = Session.findById("wnd[0]").Children(i)
    WScript.Echo "  [" & i & "] type=" & c.Type & " id=" & c.Id
    If i >= 15 Then WScript.Echo "  ..." : Exit For
Next

WScript.Echo "DONE"
