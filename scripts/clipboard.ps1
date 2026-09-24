param([ValidateSet('copy','paste')][string]$Mode)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Drawing, System.Windows.Forms, System.Web.Extensions
Add-Type -Path (Join-Path $PSScriptRoot 'ClipboardBridge.cs') -ReferencedAssemblies System.Drawing,System.Windows.Forms,System.Web.Extensions
try { [Console]::WriteLine([CeolClipboard]::Run($Mode, [Console]::In.ReadToEnd())) }
catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }
