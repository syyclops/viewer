variable "resource_group_name" {
  description = "Name of the Azure resource group"
  type        = string
  default     = "rg-viewer"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus2"
}

variable "app_name" {
  description = "Name of the Static Web App"
  type        = string
  default     = "swa-syyclops-viewer"
}

variable "custom_domain" {
  description = "Custom domain for the viewer"
  type        = string
  default     = "viewer.syyclops.com"
}

variable "enable_custom_domain" {
  description = "Enable custom domain (set to true after adding DNS CNAME)"
  type        = bool
  default     = false
}
