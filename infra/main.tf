terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# ---------------------------------------------------------------------------
# Resource Group
# ---------------------------------------------------------------------------

resource "azurerm_resource_group" "viewer" {
  name     = var.resource_group_name
  location = var.location
}

# ---------------------------------------------------------------------------
# Static Web App (Free tier)
# ---------------------------------------------------------------------------

resource "azurerm_static_web_app" "viewer" {
  name                = var.app_name
  resource_group_name = azurerm_resource_group.viewer.name
  location            = azurerm_resource_group.viewer.location
  sku_tier            = "Free"
  sku_size            = "Free"
}

# ---------------------------------------------------------------------------
# Build & Deploy
# ---------------------------------------------------------------------------

resource "null_resource" "deploy" {
  depends_on = [azurerm_static_web_app.viewer]

  triggers = {
    always_run = timestamp()
  }

  provisioner "local-exec" {
    working_dir = "${path.module}/.."
    command     = "bun run build && npx @azure/static-web-apps-cli deploy apps/web/dist --deployment-token ${azurerm_static_web_app.viewer.api_key} --env production"
  }
}

# ---------------------------------------------------------------------------
# Custom Domain (opt-in after DNS CNAME is configured)
# ---------------------------------------------------------------------------

resource "azurerm_static_web_app_custom_domain" "viewer" {
  count             = var.enable_custom_domain ? 1 : 0
  static_web_app_id = azurerm_static_web_app.viewer.id
  domain_name       = var.custom_domain
  validation_type   = "cname-delegation"
}
