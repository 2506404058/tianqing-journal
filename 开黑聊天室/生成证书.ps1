param([Parameter(Mandatory=$true)][string]$Address)
$ErrorActionPreference = 'Stop'
$ip = [System.Net.IPAddress]::Parse($Address)
$certDir = Join-Path $PSScriptRoot 'certs'
if (Test-Path (Join-Path $certDir 'server.pfx')) { throw '证书已存在。为避免影响朋友的信任配置，请先手动备份并移走 certs 文件夹再重新生成。' }
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=Squad Chat', $rsa, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$san = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
$san.AddDnsName('localhost'); $san.AddIpAddress([System.Net.IPAddress]::Loopback); $san.AddIpAddress($ip)
$request.CertificateExtensions.Add($san.Build())
$request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false,$false,0,$true))
$request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature,$true))
$oids = [System.Security.Cryptography.OidCollection]::new(); [void]$oids.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1'))
$request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($oids,$false))
$cert = $request.CreateSelfSigned([DateTimeOffset]::Now.AddMinutes(-5),[DateTimeOffset]::Now.AddDays(180))
[void](New-Item -ItemType Directory -Path $certDir -Force)
[System.IO.File]::WriteAllBytes((Join-Path $certDir 'server.pfx'),$cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx,''))
[System.IO.File]::WriteAllBytes((Join-Path $certDir '给朋友的证书.cer'),$cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
Write-Host ('证书已生成，180天有效。网址：https://' + $Address + ':3443')
Write-Host ('公钥证书SHA256：' + $cert.GetCertHashString([System.Security.Cryptography.HashAlgorithmName]::SHA256))
Write-Host '只分享 给朋友的证书.cer，不要分享 server.pfx。信任证书前请核对指纹。'
$cert.Dispose();$rsa.Dispose()
