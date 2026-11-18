param([string]$ShareAddress,[int]$Port=3180)
$resultPath=Join-Path $PSScriptRoot '.zerotier-firewall-result.json'
try {
  $principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
  if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw '需要Windows管理员权限来创建指定的防火墙规则。'}
  $addresses=@(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object {$_.InterfaceAlias -like '*ZeroTier*' -and (!$ShareAddress -or $_.IPAddress -eq $ShareAddress)})
  if($addresses.Count -ne 1){throw '没有唯一匹配的ZeroTier地址，请检查网络连接。'}
  $address=$addresses[0]
  if($Port -ne 3180){throw '该配置脚本只允许分享端口3180。'}
  $nodePath=(Get-Command node.exe -ErrorAction Stop).Source
  $octets=$address.IPAddress.Split('.') | ForEach-Object {[int]$_}
  $bits=[int]$address.PrefixLength
  $networkOctets=for($i=0;$i -lt 4;$i++){$n=[Math]::Min(8,[Math]::Max(0,$bits-8*$i));$mask=if($n -eq 0){0}else{256-[Math]::Pow(2,8-$n)};($octets[$i] -band [int]$mask)}
  $remoteScope=($networkOctets -join '.')+'/'+$address.PrefixLength
  $ruleName='TianQing-ZeroTier-Web-3180'
  $interfacePattern=[System.Management.Automation.WildcardPattern]::Escape($address.InterfaceAlias)
  $existing=Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
  if($existing){
    Set-NetFirewallRule -Name $ruleName -Enabled True -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -LocalAddress $address.IPAddress -RemoteAddress $remoteScope -InterfaceAlias $interfacePattern -Program $nodePath -Profile Any -ErrorAction Stop | Out-Null
  }else{
    New-NetFirewallRule -Name $ruleName -DisplayName 'TianQing ZeroTier Web 3180' -Description 'Only the public static journal on the ZeroTier adapter; no desktop personal-data API.' -Enabled True -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -LocalAddress $address.IPAddress -RemoteAddress $remoteScope -InterfaceAlias $interfacePattern -Program $nodePath -Profile Any -ErrorAction Stop | Out-Null
  }
  @{ok=$true;address=$address.IPAddress;port=$Port;remoteScope=$remoteScope;rule=$ruleName} | ConvertTo-Json | Set-Content -LiteralPath $resultPath -Encoding UTF8
}catch{
  @{ok=$false;error=$_.Exception.Message} | ConvertTo-Json | Set-Content -LiteralPath $resultPath -Encoding UTF8
  exit 1
}
