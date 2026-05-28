param(
    [string]$TransactionCode = "",
    [string]$DateFrom = "",
    [string]$DateTo = "",
    [string]$Plant = "",
    [string]$DownloadDir = ""
)

$ErrorActionPreference = "Continue"
$logFile = Join-Path -Path $DownloadDir -ChildPath "script.log"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "HH:mm:ss"
    $line = "[$timestamp] $Message"
    Write-Output $line
    Add-Content -Path $logFile -Value $line
}

function Get-ErrorDetail {
    param($ErrorRecord)
    $errMsg = $ErrorRecord.Exception.Message
    $errType = $ErrorRecord.Exception.GetType().Name
    $errLine = $ErrorRecord.InvocationInfo.ScriptLineNumber
    $errCode = $ErrorRecord.InvocationInfo.Line
    return "Type=$errType Msg=$errMsg at Line $errLine : $errCode"
}

function Close-Popups {
    param($session)
    for ($i = 1; $i -le 5; $i++) {
        try {
            $w = ("wnd[" + $i + "]")
            $popup = $session.findById($w)
            if ($popup -ne $null) {
                Write-Log ("Closing popup at " + $w)
                $btn = $null
                # Try various button positions
                $btnPaths = @(
                    $w + "/tbar[0]/btn[0]",
                    $w + "/tbar[0]/btn[1]",
                    $w + "/usr/btnSPB_YES",
                    $w + "/usr/btnSPB_NO",
                    $w + "/usr/btnSPB_ENTER",
                    $w + "/tbar[0]/btn[2]"
                )
                foreach ($bpath in $btnPaths) {
                    try {
                        $session.findById($bpath).press()
                        Write-Log ("  Pressed " + $bpath)
                        Start-Sleep -Milliseconds 500
                        break
                    } catch { continue }
                }
            }
        } catch { continue }
    }
}

# Write start marker
Write-Output "SCRIPTSTART"

# Check temp dir
if (-not (Test-Path $DownloadDir)) {
    New-Item -ItemType Directory -Path $DownloadDir -Force | Out-Null
}

Write-Log "Script started. Transaksi=$TransactionCode From=$DateFrom To=$DateTo"

# Check SAP GUI COM
try {
    $sapGui = New-Object -ComObject SapGui.Auto
    Write-Log "SAP GUI COM OK"
} catch {
    Write-Log ("ERROR: SAP GUI COM: " + (Get-ErrorDetail $_))
    Write-Output "SCRIPT_ERROR=SAP GUI COM object not available. Install SAP GUI and enable scripting."
    exit 1
}

# Get scripting engine
try {
    $engine = $sapGui.GetScriptingEngine()
    Write-Log ("Engine OK. Connections: " + $engine.Connections.Count)
} catch {
    Write-Log ("ERROR: Engine: " + (Get-ErrorDetail $_))
    Write-Output "SCRIPT_ERROR=Cannot get scripting engine. Enable SAP GUI Scripting."
    exit 1
}

# Check connections
if ($engine.Connections.Count -eq 0) {
    Write-Log "ERROR: No SAP connections found"
    Write-Output "SCRIPT_ERROR=No SAP connection. Open SAP GUI and log in to P23 first."
    exit 1
}

# Get first connection and session
try {
    $connection = $engine.Connections(0)
    Write-Log ("Connection OK: " + $connection.Description)
    $session = $connection.Sessions(0)
    Write-Log ("Session OK: " + $session.Name)
} catch {
    Write-Log ("ERROR: Session: " + (Get-ErrorDetail $_))
    Write-Output "SCRIPT_ERROR=Cannot get SAP session."
    exit 1
}

# Close any popups first
Close-Popups $session

# Navigate to transaction (use existing session, no CreateSession)
if ($TransactionCode) {
    Write-Log ("Navigating to transaction: " + $TransactionCode)
    try {
        # Try okcd field
        $okcd = $session.findById("wnd[0]/tbar[0]/okcd")
        $okcd.text = ("/n" + $TransactionCode)
        Write-Log "OK code field found and set"
        $session.findById("wnd[0]").sendVKey(0)
        Start-Sleep -Seconds 3
        Close-Popups $session
        Write-Log ("Transaction " + $TransactionCode + " opened")
    } catch {
        Write-Log ("Navigation error: " + (Get-ErrorDetail $_))
        Write-Output ("SCRIPT_ERROR=Gagal navigasi ke transaksi " + $TransactionCode + ". Detail: " + $_.Exception.Message)
        exit 1
    }
}

# Set date parameters
$dateSet = $false
if ($DateFrom) {
    Write-Log ("Setting Date From: " + $DateFrom)
    $datePatterns = @(
        "wnd[0]/usr/ctxtS_DATE-LOW",
        "wnd[0]/usr/ctxtSO_DATE-LOW",
        "wnd[0]/usr/ctxtP_DATE-LOW",
        "wnd[0]/usr/ctxtP_DATUM-LOW",
        "wnd[0]/usr/ctxtSO_DATUM-LOW",
        "wnd[0]/usr/ctxtS_DATUM-LOW",
        "wnd[0]/usr/ctxtS_BUDAT-LOW"
    )
    foreach ($pat in $datePatterns) {
        try {
            $field = $session.findById($pat)
            $field.text = $DateFrom
            Write-Log ("  Set via: " + $pat)
            $dateSet = $true
            break
        } catch { continue }
    }
    if (-not $dateSet) { Write-Log "  DateFrom field not found" }
}

if ($DateTo) {
    Write-Log ("Setting Date To: " + $DateTo)
    $datePatterns = @(
        "wnd[0]/usr/ctxtS_DATE-HIGH",
        "wnd[0]/usr/ctxtSO_DATE-HIGH",
        "wnd[0]/usr/ctxtP_DATE-HIGH",
        "wnd[0]/usr/ctxtP_DATUM-HIGH",
        "wnd[0]/usr/ctxtSO_DATUM-HIGH",
        "wnd[0]/usr/ctxtS_DATUM-HIGH",
        "wnd[0]/usr/ctxtS_BUDAT-HIGH"
    )
    foreach ($pat in $datePatterns) {
        try {
            $field = $session.findById($pat)
            $field.text = $DateTo
            Write-Log ("  Set via: " + $pat)
            break
        } catch { continue }
    }
}

# Set Plant
if ($Plant) {
    Write-Log ("Setting Plant: " + $Plant)
    $plantPatterns = @(
        "wnd[0]/usr/ctxtS_WERKS-LOW",
        "wnd[0]/usr/ctxtSO_WERKS-LOW",
        "wnd[0]/usr/ctxtP_WERKS-LOW",
        "wnd[0]/usr/ctxtS_WERK-LOW",
        "wnd[0]/usr/ctxtS_WERKS-LOW"
    )
    foreach ($pat in $plantPatterns) {
        try {
            $session.findById($pat).text = $Plant
            Write-Log ("  Set via: " + $pat)
            break
        } catch { continue }
    }
}

# Execute (F8)
Write-Log "Executing report (F8)..."
try {
    $session.findById("wnd[0]").sendVKey(8)
    Start-Sleep -Seconds 5
    Close-Popups $session
    Write-Log "Report executed"
} catch {
    Write-Log ("F8 error (non-fatal): " + (Get-ErrorDetail $_))
}

Start-Sleep -Seconds 3

# ── EXPORT ──
Write-Log "Starting export..."
$exported = $false

# Try multiple export methods
$exportMethods = @(
    { param($s) $s.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").pressButton("&MYXLS") },
    { param($s) $s.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").pressToolbarContextButton("&MYXLS") },
    { param($s) $s.findById("wnd[0]/mbar/menu[0]/menu[4]/menu[1]").select() },
    { param($s) $s.findById("wnd[0]/mbar/menu[4]/menu[2]").select() },
    { param($s) $s.findById("wnd[0]/mbar/menu[0]/menu[5]/menu[2]").select() },
    { param($s) $s.findById("wnd[0]").sendVKey(79) }
)

$methodNames = @(
    "ALV Spreadsheet button",
    "ALV context button",
    "Menu System>List>Save>Local File",
    "Menu List>Export",
    "Menu System>Export>Spreadsheet",
    "Ctrl+Shift+F7"
)

for ($i = 0; $i -lt $exportMethods.Length; $i++) {
    if (-not $exported) {
        try {
            Write-Log ("  Trying: " + $methodNames[$i])
            $exportMethods[$i].Invoke($session)
            Start-Sleep -Seconds 2
            Close-Popups $session
            $exported = $true
            Write-Log ("  OK: " + $methodNames[$i])
        } catch {
            Write-Log ("  Failed: " + $methodNames[$i])
        }
    }
}

Start-Sleep -Seconds 3

# ── SAVE DIALOG ──
Write-Log "Looking for save dialog..."
$savedFile = $false

for ($winIdx = 1; $winIdx -le 5; $winIdx++) {
    try {
        $winPath = ("wnd[" + $winIdx + "]")
        $testField = $session.findById($winPath + "/usr/ctxtDY_PATH")
        if ($testField -ne $null) {
            Write-Log ("  Save dialog at window " + $winIdx)
            $session.findById($winPath + "/usr/ctxtDY_PATH").text = $DownloadDir
            $session.findById($winPath + "/usr/ctxtDY_FILENAME").text = "SAP_Export.xlsx"
            Start-Sleep -Milliseconds 500
            $session.findById($winPath + "/tbar[0]/btn[0]").press()
            Write-Log "  File path set and confirmed"
            $savedFile = $true
            break
        }
    } catch { continue }
}

if (-not $savedFile) {
    Write-Log "No save dialog with DY_PATH found"
    # Try pressing Enter in any dialog
    for ($wi = 1; $wi -le 3; $wi++) {
        try {
            $session.findById(("wnd[" + $wi + "]/tbar[0]/btn[0]")).press()
            Write-Log ("Pressed button at wnd[" + $wi + "]")
            Start-Sleep -Seconds 2
        } catch { continue }
    }
}

Start-Sleep -Seconds 5

# ── CHECK RESULT ──
Write-Log "Checking for exported file..."
$resultFile = $null

$exportFile = Join-Path -Path $DownloadDir -ChildPath "SAP_Export.xlsx"
if (Test-Path $exportFile) {
    $resultFile = $exportFile
    Write-Log ("Found: " + $exportFile)
}

if ($resultFile -eq $null) {
    $foundFiles = Get-ChildItem -Path $DownloadDir -Filter "*.xlsx" -ErrorAction SilentlyContinue
    if ($foundFiles.Count -gt 0) {
        $resultFile = $foundFiles[0].FullName
        Write-Log ("Found: " + $resultFile)
    }
}

if ($resultFile -ne $null) {
    Write-Log ("SUCCESS: " + $resultFile)
    Write-Output ("RESULTFILE=" + $resultFile)
} else {
    Write-Log "File not found. Manual export may be needed."
    Write-Output ("PENDINGMANUAL=" + $DownloadDir)
}

Write-Output "SCRIPTEND"
