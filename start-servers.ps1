$frontendPath = "C:\Users\manis\OneDrive\Desktop\image-generator\frontend\build"
$backendPath = "C:\Users\manis\OneDrive\Desktop\image-generator\backend"

Set-Location $frontendPath

$frontendJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    python -m http.server 3000
} -ArgumentList $frontendPath

Start-Sleep -Seconds 3

$backendJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    node server.js
} -ArgumentList $backendPath

Start-Sleep -Seconds 5

Write-Output "Servers started"

Start-Process "http://127.0.0.1:3000"