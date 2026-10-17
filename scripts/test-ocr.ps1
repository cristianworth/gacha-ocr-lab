$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$fixtureDir = Join-Path $projectRoot 'data/synthetic'
$resultDir = Join-Path $projectRoot 'data/results'
New-Item -ItemType Directory -Path $fixtureDir -Force | Out-Null
Add-Type -AssemblyName System.Drawing

function New-Fixture([string]$Path, [string[]]$Lines, [int]$Left = 50, [int]$Top = 50, [int]$FontSize = 30) {
    $bitmap = [System.Drawing.Bitmap]::new(1440, 900)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $font = [System.Drawing.Font]::new('Arial', $FontSize)
    try {
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
        $position = $Top
        foreach ($line in $Lines) {
            $graphics.DrawString($line, $font, [System.Drawing.Brushes]::Black, $Left, $position)
            $position += 100
        }
        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $font.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function Invoke-Fixture([string]$Path, [bool]$Offline, [string]$Languages = '') {
    $before = @(Get-ChildItem -LiteralPath $resultDir -Filter '*.json' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
    $cliArgs = @((Join-Path $projectRoot 'src/cli.js'), $Path)
    if ($Languages) { $cliArgs += @('--lang', $Languages) }
    if ($Offline) { $cliArgs += '--offline' }
    & node @cliArgs | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "CLI failed with exit code $LASTEXITCODE" }
    $new = @(Get-ChildItem -LiteralPath $resultDir -Filter '*.json' | Where-Object { $_.FullName -notin $before })
    if ($new.Count -ne 1) { throw 'Expected exactly one new JSON result.' }
    $parsed = Get-Content -LiteralPath $new[0].FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    $expectedLanguages = if ($Languages) { $Languages } else { 'eng' }
    if ($parsed.ocr.languages -ne $expectedLanguages) { throw 'Unexpected OCR language.' }
    if ($parsed.ocr.imageSize.width -ne 1440 -or $parsed.ocr.imageSize.height -ne 900) { throw 'Expected decoded image size 1440x900.' }
    return $parsed
}

$name = 'Test Sword'
$fixture = Join-Path $fixtureDir 'weapon.png'
New-Fixture $fixture @("Weapon Name: $name", 'Sword', 'Lv. 80/90', 'Refinement Rank 3')
# Keep CLI output visible while returning only the parsed JSON from the function.
$result = Invoke-Fixture $fixture $false
if ($result.fields.name.value -ne $name -or $result.fields.level.value.current -ne 80 -or $result.fields.level.value.max -ne 90 -or $result.fields.refinement.value -ne 3) {
    throw 'Synthetic labeled weapon did not match expected values.'
}

$englishPanel = Join-Path $fixtureDir 'weapon-en-1440x900.png'
New-Fixture $englishPanel @('Test Sword', 'Sword', 'Base ATK 510', 'Lv. 80/90', 'Refinement Rank 3') -Left 990 -Top 110 -FontSize 22
$result = Invoke-Fixture $englishPanel $true
if ($result.fields.name.status -ne 'uncertain' -or $result.fields.name.candidates[0].value -ne 'Test Sword' -or $result.fields.level.value.current -ne 80 -or $result.fields.level.value.max -ne 90 -or $result.fields.refinement.value -ne 3) {
    throw 'Synthetic English 1440x900 panel did not preserve expected candidates and values.'
}

$portuguese = Join-Path $fixtureDir 'weapon-pt.png'
New-Fixture $portuguese @('Espada de Estudo', 'Espada', 'Nv. 80/90', 'Rank de Refinamento 3')
$result = Invoke-Fixture $portuguese $true 'por+eng'
if ($result.fields.name.status -ne 'uncertain' -or $result.fields.name.candidates[0].value -ne 'Espada de Estudo' -or $result.fields.level.value.current -ne 80 -or $result.fields.refinement.value -ne 3) {
    throw 'Synthetic Portuguese panel did not preserve the uncertain name and expected numeric fields.'
}

$blank = Join-Path $fixtureDir 'blank.png'
New-Fixture $blank @()
$result = Invoke-Fixture $blank $true
foreach ($field in @('name', 'level', 'refinement')) {
    if ($result.fields.$field.status -ne 'absent') { throw "Expected absent $field on blank image." }
}

$corrupt = Join-Path $fixtureDir 'corrupt.png'
[System.IO.File]::WriteAllBytes($corrupt, [byte[]](137,80,78,71,13,10,26,10,0,0,0,0))
& node (Join-Path $projectRoot 'src/cli.js') $corrupt --offline
if ($LASTEXITCODE -ne 1) { throw 'Corrupt PNG must fail with exit code 1.' }
Write-Host 'PASS: actual local OCR + JSON on 1440x900 synthetic images, default English and optional Portuguese; blank image offline; corrupt image failure. No real game screenshot tested.'
exit 0
