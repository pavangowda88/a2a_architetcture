param(
    [string]$KeycloakUrl = "http://localhost:8080",
    [string]$Realm = "6g",
    [string]$AdminUser = "admin",
    [string]$AdminPassword = "admin"
)

$ErrorActionPreference = "Stop"
$KeycloakUrl = $KeycloakUrl.TrimEnd("/")
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $scriptDir ".env"
$envExample = Join-Path $scriptDir ".env.example"

function Invoke-Kc {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body
    )

    $params = @{
        Method = $Method
        Uri = "$KeycloakUrl$Path"
        Headers = @{ Authorization = "Bearer $script:adminToken" }
        ContentType = "application/json"
    }
    if ($null -ne $Body) {
        $params.Body = $Body | ConvertTo-Json -Depth 10
    }
    try {
        return Invoke-RestMethod @params
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 404) {
            return $null
        }
        throw
    }
}

function Get-ExistingByName {
    param([string]$Path, [string]$Property, [string]$Value)
    $items = Invoke-Kc -Method GET -Path $Path
    return @($items | Where-Object { $_.$Property -eq $Value }) | Select-Object -First 1
}

function Ensure-ClientScope {
    param([string]$Name)
    $existing = Get-ExistingByName -Path "/admin/realms/$Realm/client-scopes" -Property "name" -Value $Name
    if ($existing) {
        return $existing.id
    }
    Invoke-Kc -Method POST -Path "/admin/realms/$Realm/client-scopes" -Body @{
        name = $Name
        protocol = "openid-connect"
        displayOnConsentScreen = $false
        includeInTokenScope = $true
    } | Out-Null
    return (Get-ExistingByName -Path "/admin/realms/$Realm/client-scopes" -Property "name" -Value $Name).id
}

function Ensure-Client {
    param([string]$ClientId)
    $existing = Get-ExistingByName -Path "/admin/realms/$Realm/clients?clientId=$ClientId" -Property "clientId" -Value $ClientId
    if ($existing) {
        return $existing.id
    }
    Invoke-Kc -Method POST -Path "/admin/realms/$Realm/clients" -Body @{
        clientId = $ClientId
        enabled = $true
        protocol = "openid-connect"
        publicClient = $false
        serviceAccountsEnabled = $true
        standardFlowEnabled = $false
        directAccessGrantsEnabled = $false
        clientAuthenticatorType = "client-secret"
    } | Out-Null
    return (Get-ExistingByName -Path "/admin/realms/$Realm/clients?clientId=$ClientId" -Property "clientId" -Value $ClientId).id
}

function Ensure-VscodeMcpClient {
    $client = Get-ExistingByName -Path "/admin/realms/$Realm/clients?clientId=vscode-mcp" -Property "clientId" -Value "vscode-mcp"
    if (-not $client) {
        Invoke-Kc -Method POST -Path "/admin/realms/$Realm/clients" -Body @{
            clientId = "vscode-mcp"
            enabled = $true
            protocol = "openid-connect"
            publicClient = $true
            serviceAccountsEnabled = $false
            standardFlowEnabled = $true
            directAccessGrantsEnabled = $false
            clientAuthenticatorType = "none"
            redirectUris = @(
                "http://127.0.0.1:*"
                "http://localhost:*"
                "http://127.0.0.1:33418/*"
                "http://localhost:33418/*"
                "https://vscode.dev/redirect"
                "https://vscode.dev/*"
                "vscode://*"
                "vscode-insiders://*"
            )
            webOrigins = @(
                "http://127.0.0.1:*"
                "http://localhost:*"
                "http://127.0.0.1:33418"
                "http://localhost:33418"
                "https://vscode.dev"
                "+"
            )
        } | Out-Null
        $client = Get-ExistingByName -Path "/admin/realms/$Realm/clients?clientId=vscode-mcp" -Property "clientId" -Value "vscode-mcp"
    } else {
        $client.enabled = $true
        $client.publicClient = $true
        $client.serviceAccountsEnabled = $false
        $client.standardFlowEnabled = $true
        $client.directAccessGrantsEnabled = $false
        $client.clientAuthenticatorType = "none"
        $client.redirectUris = @(
            "http://127.0.0.1:*"
            "http://localhost:*"
            "http://127.0.0.1:33418/*"
            "http://localhost:33418/*"
            "https://vscode.dev/redirect"
            "https://vscode.dev/*"
            "vscode://*"
            "vscode-insiders://*"
        )
        $client.webOrigins = @(
            "http://127.0.0.1:*"
            "http://localhost:*"
            "http://127.0.0.1:33418"
            "http://localhost:33418"
            "https://vscode.dev"
            "+"
        )
        Invoke-Kc -Method PUT -Path "/admin/realms/$Realm/clients/$($client.id)" -Body $client | Out-Null
    }
    return $client.id
}

function Get-ClientSecret {
    param([string]$ClientUuid)
    return (Invoke-Kc -Method GET -Path "/admin/realms/$Realm/clients/$ClientUuid/client-secret").value
}

function Ensure-DefaultScope {
    param([string]$ClientUuid, [string]$ScopeUuid)
    $assigned = Invoke-Kc -Method GET -Path "/admin/realms/$Realm/clients/$ClientUuid/default-client-scopes"
    if (-not (@($assigned) | Where-Object { $_.id -eq $ScopeUuid })) {
        Invoke-Kc -Method PUT -Path "/admin/realms/$Realm/clients/$ClientUuid/default-client-scopes/$ScopeUuid" -Body $null | Out-Null
    }
}

function Ensure-RealmDefaultScope {
    param([string]$ScopeUuid)
    $assigned = Invoke-Kc -Method GET -Path "/admin/realms/$Realm/default-default-client-scopes"
    if (-not (@($assigned) | Where-Object { $_.id -eq $ScopeUuid })) {
        Invoke-Kc -Method PUT -Path "/admin/realms/$Realm/default-default-client-scopes/$ScopeUuid" -Body $null | Out-Null
    }
}

function Ensure-User {
    param(
        [string]$Username,
        [string]$Password,
        [string]$Email = "",
        [string]$FirstName = "",
        [string]$LastName = ""
    )
    $existing = Get-ExistingByName -Path "/admin/realms/$Realm/users?username=$Username" -Property "username" -Value $Username
    if (-not $existing) {
        Invoke-Kc -Method POST -Path "/admin/realms/$Realm/users" -Body @{
            username = $Username
            enabled = $true
            emailVerified = $true
            email = if ($Email) { $Email } else { "$Username@6g.net" }
            firstName = if ($FirstName) { $FirstName } else { $Username }
            lastName = if ($LastName) { $LastName } else { "User" }
            credentials = @(
                @{
                    type = "password"
                    value = $Password
                    temporary = $false
                }
            )
        } | Out-Null
    } else {
        Invoke-Kc -Method PUT -Path "/admin/realms/$Realm/users/$($existing.id)/reset-password" -Body @{
            type = "password"
            value = $Password
            temporary = $false
        } | Out-Null
    }
}

function Ensure-RegistrationScopePolicy {
    param([string[]]$AllowedScopes)
    $components = Invoke-Kc -Method GET -Path "/admin/realms/$Realm/components?providerId=allowed-client-templates"
    foreach ($component in @($components) | Where-Object { $_.name -eq "Allowed Client Scopes" }) {
        $config = @{}
        if ($component.config) {
            foreach ($property in $component.config.PSObject.Properties) {
                $config[$property.Name] = @($property.Value)
            }
        }
        $config["allowed-client-scopes"] = @($AllowedScopes)
        $config["allow-default-scopes"] = @("true")
        $component.config = $config
        Invoke-Kc -Method PUT -Path "/admin/realms/$Realm/components/$($component.id)" -Body $component | Out-Null
    }
}

function Ensure-TrustedHostsPolicy {
    param([string[]]$TrustedHosts)
    $components = Invoke-Kc -Method GET -Path "/admin/realms/$Realm/components?providerId=trusted-hosts"
    foreach ($component in @($components) | Where-Object { $_.name -eq "Trusted Hosts" }) {
        $config = @{}
        if ($component.config) {
            foreach ($property in $component.config.PSObject.Properties) {
                $config[$property.Name] = @($property.Value)
            }
        }
        $config["trusted-hosts"] = @($TrustedHosts)
        $config["host-sending-registration-request-must-match"] = @("false")
        $config["client-uris-must-match"] = @("true")
        $component.config = $config
        Invoke-Kc -Method PUT -Path "/admin/realms/$Realm/components/$($component.id)" -Body $component | Out-Null
    }
}

Write-Host "Getting Keycloak admin token..."
$tokenResponse = Invoke-RestMethod `
    -Method POST `
    -Uri "$KeycloakUrl/realms/master/protocol/openid-connect/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body @{ username = $AdminUser; password = $AdminPassword; grant_type = "password"; client_id = "admin-cli" }
$adminToken = $tokenResponse.access_token

if (-not (Invoke-Kc -Method GET -Path "/admin/realms/$Realm")) {
    Write-Host "Creating realm '$Realm'..."
    Invoke-Kc -Method POST -Path "/admin/realms" -Body @{ realm = $Realm; enabled = $true } | Out-Null
}

$scopeNames = @(
    "agent:read", "agent:write", "authentication:request", "subscriber:read",
    "subscriber:write", "security:read", "security:write", "network:read",
    "network:write", "mcp:execute", "automation:execute"
)

Write-Host "Creating client scopes..."
$scopeIds = @{}
foreach ($scopeName in $scopeNames) {
    $scopeIds[$scopeName] = Ensure-ClientScope -Name $scopeName
    Ensure-RealmDefaultScope -ScopeUuid $scopeIds[$scopeName]
}
$audienceScopeId = Ensure-ClientScope -Name "6g-agent-services-audience"
Ensure-RealmDefaultScope -ScopeUuid $audienceScopeId
$resourceAudienceScopeId = Ensure-ClientScope -Name "6g-resource-server-audience"
Ensure-RealmDefaultScope -ScopeUuid $resourceAudienceScopeId

Write-Host "Configuring VS Code MCP OAuth client..."
$vscodeMcpClientUuid = Ensure-VscodeMcpClient
Ensure-DefaultScope -ClientUuid $vscodeMcpClientUuid -ScopeUuid $scopeIds["mcp:execute"]
Ensure-DefaultScope -ClientUuid $vscodeMcpClientUuid -ScopeUuid $audienceScopeId
Ensure-DefaultScope -ClientUuid $vscodeMcpClientUuid -ScopeUuid $resourceAudienceScopeId

Write-Host "Allowing MCP scopes for dynamic client registration..."
$registrationScopes = @(
    "openid", "profile", "email", "mcp:execute",
    "6g-agent-services-audience", "6g-resource-server-audience"
) + $scopeNames
Ensure-RegistrationScopePolicy -AllowedScopes $registrationScopes

Write-Host "Allowing local MCP client registration hosts..."
Ensure-TrustedHostsPolicy -TrustedHosts @("localhost", "127.0.0.1", "::1", "*")

$audienceScopeMapper = Invoke-Kc -Method GET -Path "/admin/realms/$Realm/client-scopes/$audienceScopeId/protocol-mappers/models"
if (-not (@($audienceScopeMapper) | Where-Object { $_.name -eq "6g-agent-services-audience" })) {
    Invoke-Kc -Method POST -Path "/admin/realms/$Realm/client-scopes/$audienceScopeId/protocol-mappers/models" -Body @{
        name = "6g-agent-services-audience"
        protocol = "openid-connect"
        protocolMapper = "oidc-audience-mapper"
        config = @{
            "included.client.audience" = "6g-agent-services"
            "access.token.claim" = "true"
            "introspection.token.claim" = "true"
        }
    } | Out-Null
}
$resourceAudienceMapper = Invoke-Kc -Method GET -Path "/admin/realms/$Realm/client-scopes/$resourceAudienceScopeId/protocol-mappers/models"
if (-not (@($resourceAudienceMapper) | Where-Object { $_.name -eq "6g-resource-server-audience" })) {
    Invoke-Kc -Method POST -Path "/admin/realms/$Realm/client-scopes/$resourceAudienceScopeId/protocol-mappers/models" -Body @{
        name = "6g-resource-server-audience"
        protocol = "openid-connect"
        protocolMapper = "oidc-audience-mapper"
        config = @{
            "included.client.audience" = "6g-resource-server"
            "access.token.claim" = "true"
            "introspection.token.claim" = "true"
        }
    } | Out-Null
}

$clientIds = @(
    "6g-agent-services", "6g-resource-server", "supervisor-agent", "ausf-agent",
    "udm-agent", "subscriber-agent", "security-agent", "notification-agent",
    "mcp-server", "ue-agent-001", "ue-agent-002"
)

Write-Host "Creating clients and assigning default scopes..."
$secrets = @{}
foreach ($clientId in $clientIds) {
    $clientUuid = Ensure-Client -ClientId $clientId
    $secrets[$clientId] = Get-ClientSecret -ClientUuid $clientUuid
    Ensure-DefaultScope -ClientUuid $clientUuid -ScopeUuid $audienceScopeId
    Ensure-DefaultScope -ClientUuid $clientUuid -ScopeUuid $resourceAudienceScopeId
    foreach ($scopeName in $scopeNames) {
        Ensure-DefaultScope -ClientUuid $clientUuid -ScopeUuid $scopeIds[$scopeName]
    }
}

Write-Host "Updating redirect URIs and default scopes for all registered clients..."
$allClients = Invoke-Kc -Method GET -Path "/admin/realms/$Realm/clients"
foreach ($c in $allClients) {
    if ($c.publicClient -or $c.clientId -eq "vscode-mcp") {
        Ensure-DefaultScope -ClientUuid $c.id -ScopeUuid $scopeIds["mcp:execute"]
        Ensure-DefaultScope -ClientUuid $c.id -ScopeUuid $audienceScopeId
        Ensure-DefaultScope -ClientUuid $c.id -ScopeUuid $resourceAudienceScopeId
        $c.redirectUris = @(
            "http://127.0.0.1:*"
            "http://localhost:*"
            "http://127.0.0.1:33418/*"
            "http://127.0.0.1:33418"
            "http://127.0.0.1:33418/"
            "http://localhost:33418/*"
            "http://localhost:33418"
            "http://localhost:33418/"
            "https://vscode.dev/redirect"
            "https://vscode.dev/*"
            "vscode://*"
            "vscode-insiders://*"
            "*"
        )
        $c.webOrigins = @(
            "http://127.0.0.1:*"
            "http://localhost:*"
            "http://127.0.0.1:33418"
            "http://localhost:33418"
            "https://vscode.dev"
            "+"
        )
        Invoke-Kc -Method PUT -Path "/admin/realms/$Realm/clients/$($c.id)" -Body $c | Out-Null
    }
}

Write-Host "Provisioning user accounts in realm '$Realm'..."
Ensure-User -Username "admin" -Password "admin" -Email "admin@6g.net" -FirstName "6G" -LastName "Admin"
Ensure-User -Username "user" -Password "user" -Email "user@6g.net" -FirstName "6G" -LastName "User"

if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
}
$envText = Get-Content $envFile -Raw
$envValues = @{
    "RESOURCE_CLIENT_SECRET" = $secrets["6g-resource-server"]
    "SUPERVISOR_AGENT_CLIENT_SECRET" = $secrets["supervisor-agent"]
    "AUSF_AGENT_CLIENT_SECRET" = $secrets["ausf-agent"]
    "UDM_AGENT_CLIENT_SECRET" = $secrets["udm-agent"]
    "SUBSCRIBER_AGENT_CLIENT_SECRET" = $secrets["subscriber-agent"]
    "SECURITY_AGENT_CLIENT_SECRET" = $secrets["security-agent"]
    "NOTIFICATION_AGENT_CLIENT_SECRET" = $secrets["notification-agent"]
    "MCP_SERVER_CLIENT_SECRET" = $secrets["mcp-server"]
    "UE_AGENT_001_CLIENT_SECRET" = $secrets["ue-agent-001"]
    "UE_AGENT_002_CLIENT_SECRET" = $secrets["ue-agent-002"]
}
foreach ($key in $envValues.Keys) {
    $line = "$key=$($envValues[$key])"
    if ($envText -match "(?m)^$key=.*$") {
        $envText = [regex]::Replace($envText, "(?m)^$key=.*$", { $line })
    } else {
        $envText += "`r`n$line"
    }
}
Set-Content -Path $envFile -Value $envText -NoNewline

Write-Host "Keycloak setup complete. Secrets were written to $envFile"
Write-Host "Next: python seed.py --reset; python run_all.py"