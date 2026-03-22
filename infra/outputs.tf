output "default_hostname" {
  description = "Azure-assigned hostname"
  value       = azurerm_static_web_app.viewer.default_host_name
}

output "cname_target" {
  description = "Add a CNAME record pointing your custom domain to this value"
  value       = azurerm_static_web_app.viewer.default_host_name
}

output "url" {
  description = "Viewer URL"
  value       = var.enable_custom_domain ? "https://${var.custom_domain}" : "https://${azurerm_static_web_app.viewer.default_host_name}"
}
