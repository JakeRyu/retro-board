// Retro-board production infra in BW-Sandbox-Dev-001.
// Path B from the F-26 deployment plan: Private Endpoint compliance for the
// MG policy `cosmosdb-disable-Public-BW-MG`. Cosmos has no public network
// access; App Service reaches it via VNet integration → private endpoint.

@description('Azure region. UK South is the BW org default.')
param location string = 'uksouth'

@minLength(3)
@maxLength(8)
@description('Lowercase alphanumeric suffix appended to globally-unique resource names (Cosmos + App Service).')
param nameSuffix string

@description('Microsoft Entra single-tenant app (client) ID for NextAuth.')
param entraAppClientId string

@secure()
@description('Microsoft Entra app client secret.')
param entraAppClientSecret string

@description('Entra issuer URL. No trailing slash. e.g. https://login.microsoftonline.com/<tenant-id>/v2.0')
param entraIssuer string

@secure()
@description('NextAuth session secret. 32+ random bytes, base64.')
param authSecret string

// -- Naming -----------------------------------------------------------------
var vnetName = 'vnet-retro-board'
var peSubnetName = 'snet-pe'
var appSubnetName = 'snet-app'
var cosmosName = 'cosmos-retro-board-${nameSuffix}'
var appName = 'app-retro-board-${nameSuffix}'
var planName = 'plan-retro-board'
var privateDnsZoneName = 'privatelink.documents.azure.com'

// /27 each → 27 usable hosts; ample for a single PE + a single App Service plan.
var vnetAddressPrefix = '10.40.0.0/24'
var peSubnetPrefix = '10.40.0.0/27'
var appSubnetPrefix = '10.40.0.32/27'

// Built-in Cosmos data-plane role. Same ID across all Cosmos accounts.
var cosmosDataContributorRoleId = '${cosmosAccount.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'

// -- Networking -------------------------------------------------------------
resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [vnetAddressPrefix]
    }
    subnets: [
      {
        name: peSubnetName
        properties: {
          addressPrefix: peSubnetPrefix
          // PE subnets need private-endpoint network policies disabled.
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
      {
        name: appSubnetName
        properties: {
          addressPrefix: appSubnetPrefix
          delegations: [
            {
              name: 'app-service-delegation'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
    ]
  }
}

resource peSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: vnet
  name: peSubnetName
}

resource appSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: vnet
  name: appSubnetName
}

// -- Private DNS zone for Cosmos -------------------------------------------
resource dnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: privateDnsZoneName
  location: 'global'
}

resource dnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: dnsZone
  name: '${vnetName}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

// -- Cosmos DB account (serverless, public access disabled) ----------------
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-12-01-preview' = {
  name: cosmosName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    // BW MG policy `cosmosdb-disable-Public-BW-MG` enforces this.
    publicNetworkAccess: 'Disabled'
    // Serverless = pay-per-request, no provisioned RU floor. In API
    // 2024-12-01-preview the EnableServerless capability moved to this
    // top-level `capacityMode` property.
    capacityMode: 'Serverless'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    // Local-auth on so the seed script can use the account key when needed.
    // App Service uses MI + RBAC and never touches a key.
    disableLocalAuth: false
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-12-01-preview' = {
  parent: cosmosAccount
  name: 'retro-board'
  properties: {
    resource: { id: 'retro-board' }
  }
}

resource boardsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-12-01-preview' = {
  parent: cosmosDb
  name: 'boards'
  properties: {
    resource: {
      id: 'boards'
      partitionKey: {
        paths: ['/workspaceId']
        kind: 'Hash'
      }
    }
  }
}

resource userStateContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-12-01-preview' = {
  parent: cosmosDb
  name: 'userState'
  properties: {
    resource: {
      id: 'userState'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
      }
    }
  }
}

// -- Private Endpoint for Cosmos -------------------------------------------
resource cosmosPE 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pe-cosmos-retro-board'
  location: location
  properties: {
    subnet: { id: peSubnet.id }
    privateLinkServiceConnections: [
      {
        name: 'cosmos-conn'
        properties: {
          privateLinkServiceId: cosmosAccount.id
          groupIds: ['Sql']
        }
      }
    ]
  }
}

resource cosmosPEDns 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: cosmosPE
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'cosmos-dns'
        properties: {
          privateDnsZoneId: dnsZone.id
        }
      }
    ]
  }
}

// -- App Service plan + site -----------------------------------------------
resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  kind: 'linux'
  properties: {
    // Linux plans must set `reserved: true`.
    reserved: true
  }
}

resource app 'Microsoft.Web/sites@2024-04-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    virtualNetworkSubnetId: appSubnet.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      // B1 doesn't support always-on; cold start after idle is acceptable.
      alwaysOn: false
      // Only RFC1918 traffic routes through the VNet — that's what reaches
      // the PE. Internet-bound traffic (Entra OAuth, etc.) goes direct.
      vnetRouteAllEnabled: false
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'COSMOS_ENDPOINT', value: 'https://${cosmosName}.documents.azure.com:443/' }
        // COSMOS_KEY intentionally absent: triggers DefaultAzureCredential
        // path in lib/cosmos.ts.
        { name: 'AUTH_SECRET', value: authSecret }
        { name: 'AUTH_URL', value: 'https://${appName}.azurewebsites.net' }
        { name: 'AUTH_TRUST_HOST', value: 'true' }
        { name: 'AUTH_MICROSOFT_ENTRA_ID_ID', value: entraAppClientId }
        { name: 'AUTH_MICROSOFT_ENTRA_ID_SECRET', value: entraAppClientSecret }
        { name: 'AUTH_MICROSOFT_ENTRA_ID_ISSUER', value: entraIssuer }
        // Standalone Next.js bundle from `output: 'standalone'`.
        { name: 'WEBSITES_PORT', value: '3000' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' }
      ]
      appCommandLine: 'node server.js'
    }
  }
}

// -- Cosmos data-plane role assignment for the app's managed identity ------
resource roleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-12-01-preview' = {
  parent: cosmosAccount
  name: guid(app.id, cosmosAccount.id, 'data-contributor')
  properties: {
    principalId: app.identity.principalId
    roleDefinitionId: cosmosDataContributorRoleId
    scope: cosmosAccount.id
  }
}

// -- Outputs ---------------------------------------------------------------
output appHostname string = app.properties.defaultHostName
output appUrl string = 'https://${app.properties.defaultHostName}'
output cosmosEndpoint string = 'https://${cosmosName}.documents.azure.com:443/'
output cosmosAccountName string = cosmosName
output entraRedirectUri string = 'https://${app.properties.defaultHostName}/api/auth/callback/microsoft-entra-id'
output appName string = appName
