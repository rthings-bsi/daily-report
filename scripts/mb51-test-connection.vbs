' TEST: Check SAP GUI connection status
Dim SapGui, Engine, Connection, Session
Set SapGui = GetObject("SAPGUI")
If SapGui Is Nothing Then
    WScript.Echo "FAIL: SAPGUI object not found. SAP GUI mungkin tidak jalan."
    WScript.Quit 1
End If

Set Engine = SapGui.GetScriptingEngine()
WScript.Echo "OK: Engine found"

If Engine.Connections.Count = 0 Then
    WScript.Echo "FAIL: No SAP connections. Login ke P23 dulu."
    WScript.Quit 1
End If

Set Connection = Engine.Connections(0)
Set Session = Connection.Sessions(0)
WScript.Echo "OK: Connected to " & Connection.Description & " / " & Session.Name

' Cek OK code field
On Error Resume Next
Dim okcd : okcd = Session.findById("wnd[0]/tbar[0]/okcd").text
If Err.Number = 0 Then
    WScript.Echo "OK: Current transaction field = " & okcd
Else
    WScript.Echo "WARN: Cannot read OK code field: " & Err.Description
End If
On Error Goto 0

' Cek status bar message
On Error Resume Next
Dim sbar : sbar = Session.findById("wnd[0]/sbar").text
If Err.Number = 0 And Len(sbar) > 0 Then
    WScript.Echo "OK: Status bar: " & sbar
End If
On Error Goto 0

' Cek apakah bisa sendVKey
On Error Resume Next
Session.findById("wnd[0]").sendVKey 0
If Err.Number = 0 Then
    WScript.Echo "OK: sendVKey 0 works"
Else
    WScript.Echo "WARN: sendVKey 0 FAILED: " & Err.Description
End If
On Error Goto 0

' Cek grid control
On Error Resume Next
Dim grid : Set grid = Session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell")
If Err.Number = 0 Then
    WScript.Echo "OK: ALV Grid found (cntlGRID1/shellcont/shell)"
Else
    WScript.Echo "WARN: Standard ALV Grid NOT found"
    ' Coba grid alternatif
    Dim altGrids : altGrids = Array("wnd[0]/usr/cntlGRID1/shellcont/shell", "wnd[0]/usr/cntlGRID2/shellcont/shell", "wnd[0]/usr/subGRID1/shellcont/shell")
    Dim i
    For i = 0 To UBound(altGrids)
        On Error Resume Next
        Set grid = Session.findById(altGrids(i))
        If Err.Number = 0 Then
            WScript.Echo "OK: Found grid at " & altGrids(i)
            Exit For
        End If
        On Error Goto 0
    Next
End If
On Error Goto 0

' Cek menu bar
On Error Resume Next
Dim mbar : Set mbar = Session.findById("wnd[0]/mbar")
If Err.Number = 0 Then
    WScript.Echo "OK: Menu bar accessible"
Else
    WScript.Echo "WARN: Menu bar not accessible"
End If
On Error Goto 0

WScript.Echo ""
WScript.Echo "TEST COMPLETE"
