' TEST 7: Navigate to MB51 WITHOUT sendVKey — use toolbar button
Dim SapGui, Engine, Connection, Session
Set SapGui = GetObject("SAPGUI")
If SapGui Is Nothing Then WScript.Echo "FAIL: No SAPGUI" : WScript.Quit 1

Set Engine = SapGui.GetScriptingEngine()
Set Connection = Engine.Connections(0)
Set Session = Connection.Sessions(0)
WScript.Echo "SESSION: " & Session.Name

' Navigate using OK code — then press tbar[0]/btn[0] (Enter button)
On Error Resume Next
Session.findById("wnd[0]/tbar[0]/okcd").text = "/nMB51"
If Err.Number = 0 Then
    WScript.Echo "OKCD_SET: /nMB51"
Else
    WScript.Echo "OKCD_ERROR: " & Err.Description
    WScript.Quit 1
End If
Err.Clear

' Try pressing Enter button instead of sendVKey 0
On Error Resume Next
Session.findById("wnd[0]/tbar[0]/btn[0]").press()
If Err.Number = 0 Then
    WScript.Echo "TBAR_BTN0_PRESS: OK"
Else
    WScript.Echo "TBAR_BTN0_ERROR: " & Err.Description
    ' Try the search help button (enter equivalent)
    On Error Resume Next
    Session.findById("wnd[0]/tbar[0]/btn[12]").press()
    If Err.Number = 0 Then
        WScript.Echo "TBAR_BTN12_PRESS: OK (Enter)"
    Else
        WScript.Echo "TBAR_BTN12_ERROR: " & Err.Description
    End If
End If

WScript.Sleep 3000

' Check if we're on MB51 now
On Error Resume Next
Dim title : title = Session.findById("wnd[0]/titl").text
If Err.Number = 0 And Len(title) > 0 Then
    WScript.Echo "SCREEN_TITLE: " & title
End If
Err.Clear

Dim okcd2 : okcd2 = Session.findById("wnd[0]/tbar[0]/okcd").text
If Err.Number = 0 Then
    WScript.Echo "CURRENT_TRANSACTION: " & okcd2
End If

WScript.Echo "TEST_END"
