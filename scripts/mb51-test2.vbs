' TEST 2: Quick status check — NO sendVKey, just read
Dim SapGui, Engine, Connection, Session
Set SapGui = GetObject("SAPGUI")
If SapGui Is Nothing Then WScript.Echo "FAIL: No SAPGUI" : WScript.Quit 1

Set Engine = SapGui.GetScriptingEngine()
Set Connection = Engine.Connections(0)
Set Session = Connection.Sessions(0)

WScript.Echo "CONNECTION: " & Connection.Description
WScript.Echo "CONNECTION: " & Connection.Description
WScript.Echo "SESSION: " & Session.Name
WScript.Echo "SESSION_INFO: " & Session.Info.UserName & " @ " & Session.Info.Client

' Cek OKCD field (read only)
On Error Resume Next
Dim okcd : Set okcd = Session.findById("wnd[0]/tbar[0]/okcd")
If Err.Number = 0 Then
    WScript.Echo "OKCD_FIELD: exists, text='" & okcd.text & "'"
Else
    WScript.Echo "OKCD_FIELD: NOT FOUND — " & Err.Description
End If
On Error Goto 0

' Cek semua toolbar button di tbar[0]
WScript.Echo "--- Toolbar Buttons ---"
Dim btnIdx
For btnIdx = 0 To 20
    On Error Resume Next
    Dim btn : Set btn = Session.findById("wnd[0]/tbar[0]/btn[" & btnIdx & "]")
    If Err.Number = 0 Then
        Dim btnText : btnText = btn.text
        Dim btnId : btnId = btn.id
        Dim btnAcc : btnAcc = btn.Accelerator
        WScript.Echo "  btn[" & btnIdx & "]: id=" & btnId & " text='" & btnText & "' acc='" & btnAcc & "'"
    End If
    On Error Goto 0
Next

' Cek menu items
WScript.Echo "--- Menu Bar ---"
On Error Resume Next
Dim menuIdx
For menuIdx = 0 To 10
    On Error Resume Next
    Dim mitem : Set mitem = Session.findById("wnd[0]/mbar/menu[" & menuIdx & "]")
    If Err.Number = 0 Then
        WScript.Echo "  menu[" & menuIdx & "]: " & mitem.text
    End If
    On Error Goto 0
Next

' Cek screen resolution / area
On Error Resume Next
WScript.Echo "SCREEN_WIDTH: " & Session.findById("wnd[0]").Width
WScript.Echo "SCREEN_HEIGHT: " & Session.findById("wnd[0]").Height

' Cek current active area
On Error Resume Next
Dim mainArea : Set mainArea = Session.findById("wnd[0]/usr")
If Err.Number = 0 Then
    WScript.Echo "USR_AREA: exists"
Else
    WScript.Echo "USR_AREA: NOT FOUND — " & Err.Description
End If

WScript.Echo "TEST_END"
