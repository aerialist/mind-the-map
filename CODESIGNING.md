# Code Signing Setup for macOS and Windows

## Problem
Apps built in GitHub Actions have security issues when distributed:
- **macOS**: Cannot be opened at all - "file is broken" error (signing is MANDATORY)
- **Windows**: Shows "Unknown publisher" SmartScreen warning (signing is optional but recommended)

## Solution Overview

### macOS (Required)
To distribute macOS apps, you need:
1. Apple Developer Program membership ($99/year)
2. Code signing certificate
3. App Store Connect API key for notarization
4. Proper GitHub secrets configuration

### Windows (Optional but Recommended)
To avoid SmartScreen warnings on Windows:
1. Code signing certificate from a trusted CA (~$100-400/year)
2. Certificate exported for GitHub Actions
3. Proper GitHub secrets configuration

## Step-by-Step Setup

### 1. Join Apple Developer Program
- Visit: https://developer.apple.com/programs/
- Enroll and pay the $99 annual fee
- Note your **Team ID** (found in Apple Developer Account settings)

### 2. Create Code Signing Certificate

**On your Mac:**
```bash
# Open Keychain Access
# Go to: Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority
# Save the CSR file
```

**In Apple Developer Portal:**
1. Go to https://developer.apple.com/account/resources/certificates
2. Click "+" to create new certificate
3. Choose "Developer ID Application"
4. Upload your CSR file
5. Download the certificate (.cer file)
6. Double-click to install in Keychain Access

### 3. Export Certificate for GitHub

**In Keychain Access:**
1. Find "Developer ID Application: Your Name (TEAM_ID)"
2. Right-click → Export
3. Save as `.p12` file with a strong password
4. Convert to base64:
```bash
base64 -i /path/to/certificate.p12 | pbcopy
```

### 4. Create App-Specific Password for Notarization

1. Go to https://appleid.apple.com/account/manage
2. Sign in with your Apple ID
3. Under "Sign-In and Security" → "App-Specific Passwords"
4. Click "+" to generate a new password
5. Save this password securely

### 5. Get Your Signing Identity

```bash
# List available signing identities
security find-identity -v -p codesigning
```

Look for something like: `Developer ID Application: Your Name (TEAM_ID)`

### 6. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

| Secret Name | Value | Description |
|------------|-------|-------------|
| `APPLE_CERTIFICATE` | (base64 string) | Base64-encoded .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | (password) | Password for the .p12 file |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Your Name (TEAM_ID)` | Full signing identity string |
| `APPLE_ID` | (your Apple ID email) | Your Apple Developer account email |
| `APPLE_PASSWORD` | (app-specific password) | App-specific password from step 4 |
| `APPLE_TEAM_ID` | (10-character ID) | Your Team ID from Apple Developer |

### 7. Update tauri.conf.json (Optional)

If you want to hardcode the signing identity (less flexible):

```json
"bundle": {
  "macOS": {
    "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
    "providerShortName": "TEAM_ID"
  }
}
```

## Testing

1. Push a commit with a version tag:
```bash
git tag v0.1.1
git push origin v0.1.1
```

2. GitHub Actions will build, sign, and notarize the app
3. Download the artifact from the Release
4. The .app or .dmg should now open without issues

## Troubleshooting

### "Developer ID Application not found"
- Make sure the certificate is installed in Keychain Access
- Check that the identity name in GitHub secrets matches exactly

### "Failed to notarize"
- Verify `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` are correct
- Make sure you're using an app-specific password, not your regular Apple ID password

### "Certificate expired"
- Developer ID certificates expire after 5 years
- Create a new certificate and update GitHub secrets

## Alternative: Disable Gatekeeper (Testing Only)

For testing purposes only, you can bypass Gatekeeper:

```bash
# Remove quarantine attribute from downloaded app
xattr -cr /path/to/Mind\ the\ Map.app

# Or disable Gatekeeper temporarily (NOT RECOMMENDED)
sudo spctl --master-disable
```

**WARNING:** This is only for testing. Don't distribute unsigned apps to users.

## Windows Code Signing Setup (Optional)

### 1. Purchase a Code Signing Certificate

Buy from a trusted Certificate Authority:
- **DigiCert** (~$400/year) - Most trusted
- **Sectigo/Comodo** (~$200/year) - Good value
- **SSL.com** (~$100/year) - Budget option

Choose "Code Signing Certificate" (not EV/Extended Validation unless you need it)

### 2. Export Certificate for GitHub

**On Windows:**
```powershell
# Export from Certificate Manager (certmgr.msc)
# Right-click certificate → All Tasks → Export
# Choose "Yes, export the private key"
# Save as .pfx file with password
```

**Convert to base64:**
```powershell
# PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | Set-Clipboard

# Or on macOS/Linux
base64 -i certificate.pfx | pbcopy
```

### 3. Configure GitHub Secrets for Windows

Add these additional secrets:

| Secret Name | Value | Description |
|------------|-------|-------------|
| `WINDOWS_CERTIFICATE` | (base64 string) | Base64-encoded .pfx certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | (password) | Password for the .pfx file |

### 4. Update GitHub Actions Workflow

Add this step before "Build and Release" for Windows:

```yaml
- name: Import Code-Signing Certificate (Windows only)
  if: matrix.os == 'windows-latest'
  shell: pwsh
  run: |
    $certificateBytes = [Convert]::FromBase64String("${{ secrets.WINDOWS_CERTIFICATE }}")
    $certificatePath = "$env:TEMP\certificate.pfx"
    [IO.File]::WriteAllBytes($certificatePath, $certificateBytes)
    
    $password = ConvertTo-SecureString "${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}" -AsPlainText -Force
    Import-PfxCertificate -FilePath $certificatePath -CertStoreLocation Cert:\CurrentUser\My -Password $password
    
    Remove-Item $certificatePath
```

Then set the environment variable in the "Build and Release" step:
```yaml
env:
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.WINDOWS_CERTIFICATE }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
```

### 5. Update tauri.conf.json for Windows

```json
"bundle": {
  "windows": {
    "certificateThumbprint": null,
    "digestAlgorithm": "sha256",
    "timestampUrl": "http://timestamp.digicert.com"
  }
}
```

## Recommendation: Start with macOS Only

For most developers:
1. **Start with macOS signing** (mandatory for distribution)
2. **Skip Windows signing initially** (users can click through the warning)
3. **Add Windows signing later** when you have paying customers or need professional appearance

Windows SmartScreen warning is annoying but not blocking. macOS completely prevents execution.

## Resources

- [Apple Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Tauri Code Signing Docs](https://tauri.app/v1/guides/distribution/sign-macos/)
- [Tauri Windows Signing](https://tauri.app/v1/guides/distribution/sign-windows/)
- [Tauri Action GitHub](https://github.com/tauri-apps/tauri-action)
