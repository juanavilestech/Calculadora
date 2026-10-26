[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$SessionId,

    [string]$Model,

    [switch]$Json,

    [switch]$Help
)

$ErrorActionPreference = "Stop"
$culture = [System.Globalization.CultureInfo]::GetCultureInfo("es-ES")

function Show-Usage {
    Write-Output "Uso: .\scripts\context.ps1 [-SessionId <id>] [-Model <proveedor/modelo>] [-Json]"
    Write-Output ""
    Write-Output "Sin argumentos analiza la sesion mas reciente de OpenCode."
    Write-Output "El porcentaje se calcula sobre la ultima llamada completada del modelo."
}

function Format-Number {
    param([int64]$Value)
    return $Value.ToString("N0", $culture)
}

function Invoke-External {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        $output = & $FilePath @Arguments 2>$null
        return [pscustomobject]@{
            Output   = @($output)
            ExitCode = $LASTEXITCODE
        }
    }
    finally {
        $ErrorActionPreference = $previous
    }
}

if ($Help) {
    Show-Usage
    return
}

if (-not (Get-Command opencode -ErrorAction SilentlyContinue)) {
    throw "No se encontro el comando 'opencode' en PATH."
}

if (-not $SessionId) {
    $query = "SELECT id FROM session WHERE parent_id IS NULL ORDER BY time_updated DESC LIMIT 1"
    $queryResult = Invoke-External "opencode" @("db", $query, "--format", "json")

    if ($queryResult.ExitCode -eq 0 -and $queryResult.Output.Count -gt 0) {
        $rows = @(($queryResult.Output -join "`n") | ConvertFrom-Json)

        if ($rows.Count -gt 0) {
            $SessionId = [string]$rows[0].id
        }
    }

    if (-not $SessionId) {
        $listResult = Invoke-External "opencode" @("session", "list", "-n", "1", "--format", "json")

        if ($listResult.ExitCode -eq 0 -and $listResult.Output.Count -gt 0) {
            $sessions = @(($listResult.Output -join "`n") | ConvertFrom-Json)

            if ($sessions.Count -gt 0) {
                $SessionId = [string]$sessions[0].id
            }
        }
    }

    if (-not $SessionId) {
        throw "No se encontro una sesion de OpenCode. Indica una con -SessionId."
    }
}

$exportResult = Invoke-External "opencode" @("export", $SessionId, "--sanitize")

if ($exportResult.ExitCode -ne 0) {
    throw "No se pudo exportar la sesion '$SessionId'."
}

$raw = $exportResult.Output -join "`n"

if (-not $raw) {
    throw "La exportacion de la sesion '$SessionId' esta vacia."
}

$data = $raw | ConvertFrom-Json

$providerId = [string]$data.info.model.providerID
$modelId = [string]$data.info.model.id

if ($Model) {
    $parts = $Model.Split("/", 2)

    if ($parts.Count -ne 2 -or -not $parts[0] -or -not $parts[1]) {
        throw "El parametro -Model debe tener el formato proveedor/modelo."
    }

    $providerId = $parts[0]
    $modelId = $parts[1]
}

$modelsFile = Join-Path $env:USERPROFILE ".cache\opencode\models.json"

if (-not (Test-Path -LiteralPath $modelsFile)) {
    throw "No se encontro el catalogo de modelos en '$modelsFile'."
}

$catalog = Get-Content -LiteralPath $modelsFile -Raw | ConvertFrom-Json
$providerNode = $catalog.PSObject.Properties[$providerId]

if (-not $providerNode) {
    throw "El proveedor '$providerId' no existe en el catalogo de modelos."
}

$modelNode = $providerNode.Value.models.PSObject.Properties[$modelId]

if (-not $modelNode) {
    throw "El modelo '$modelId' no existe para el proveedor '$providerId'."
}

$limits = $modelNode.Value.limit
$contextLimit = [int64]$limits.context

if ($contextLimit -le 0) {
    throw "El modelo '$providerId/$modelId' no declara un limite de contexto."
}

$inputLimit = [int64]$limits.input
$outputLimit = [int64]$limits.output

$calls = @()

foreach ($message in @($data.messages)) {
    $info = $message.info

    if ($null -eq $info) {
        $info = $message
    }

    if ($info.role -ne "assistant") {
        continue
    }

    $tokens = $info.tokens

    if ($null -eq $tokens) {
        continue
    }

    $cache = $tokens.cache
    $input = [int64]$tokens.input
    $output = [int64]$tokens.output
    $reasoning = [int64]$tokens.reasoning
    $cacheRead = [int64]$cache.read
    $cacheWrite = [int64]$cache.write
    $total = $input + $output + $reasoning + $cacheRead + $cacheWrite

    if ($total -le 0) {
        continue
    }

    $calls += [pscustomobject]@{
        Created    = [int64]$info.time.created
        MessageId  = [string]$info.id
        Input      = $input
        Output     = $output
        Reasoning  = $reasoning
        CacheRead  = $cacheRead
        CacheWrite = $cacheWrite
        Total      = $total
    }
}

if ($calls.Count -eq 0) {
    throw "La sesion '$SessionId' no tiene telemetria de tokens."
}

$last = $calls[$calls.Count - 1]
$used = [int64]$last.Total
$free = [int64]($contextLimit - $used)
$percent = [math]::Round(($used / [double]$contextLimit) * 100, 1)

if ($free -lt 0) {
    $free = 0
}

$result = [pscustomobject]@{
    SessionId    = $SessionId
    Provider     = $providerId
    Model        = $modelId
    ContextLimit = $contextLimit
    InputLimit   = $inputLimit
    OutputLimit  = $outputLimit
    Used         = $used
    Free         = $free
    Percent      = $percent
    Calls        = $calls.Count
    MessageId    = $last.MessageId
    Timestamp    = [DateTimeOffset]::FromUnixTimeMilliseconds($last.Created).LocalDateTime.ToString("yyyy-MM-dd HH:mm:ss")
    Breakdown    = [pscustomobject]@{
        Input      = $last.Input
        CacheRead  = $last.CacheRead
        CacheWrite = $last.CacheWrite
        Output     = $last.Output
        Reasoning  = $last.Reasoning
    }
}

if ($Json) {
    $result | ConvertTo-Json -Depth 5
    return
}

$barWidth = 28
$filled = [int][math]::Round(($percent / 100) * $barWidth)

if ($filled -gt $barWidth) {
    $filled = $barWidth
}

if ($filled -lt 0) {
    $filled = 0
}

$bar = ("#" * $filled) + ("-" * ($barWidth - $filled))
$limitDetail = ""

if ($inputLimit -gt 0 -and $outputLimit -gt 0) {
    $limitDetail = " (entrada $(Format-Number $inputLimit), salida $(Format-Number $outputLimit))"
}

Write-Output "Sesion:    $SessionId"
Write-Output "Modelo:    $providerId/$modelId"
Write-Output "Ventana:   $(Format-Number $contextLimit) tokens$limitDetail"
Write-Output "Uso:       $(Format-Number $used) / $(Format-Number $contextLimit) ($($percent.ToString('N1', $culture)) %)"
Write-Output "Libre:     $(Format-Number $free)"
Write-Output "Llamada:   $($result.Timestamp) ($($result.MessageId))"
Write-Output "Desglose:  entrada $(Format-Number $last.Input) | cache $(Format-Number ($last.CacheRead + $last.CacheWrite)) | salida $(Format-Number $last.Output) | razonamiento $(Format-Number $last.Reasoning)"
Write-Output "           [$bar] $($percent.ToString('N1', $culture)) %"
Write-Output ""
Write-Output "Nota: mide la ultima llamada completada; si el agente esta respondiendo, aun no incluye ese turno."
