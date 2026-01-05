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

**Find Keychain Access on macOS Sequoia:**
```bash
# Method 1: Open via Spotlight
# Press Cmd+Space, type "Keychain Access", press Enter

# Method 2: Open via Terminal
open /Applications/Utilities/Keychain\ Access.app

# Method 3: Navigate manually
# Finder → Applications → Utilities → Keychain Access
```

**On your Mac:**
```bash
# Open Keychain Access (use methods above)
# Go to: Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority
# Fill in:
#   - User Email Address: (your Apple ID email)
#   - Common Name: (your name or company name)
#   - CA Email Address: (leave blank)
#   - Request is: "Saved to disk"
# Click Continue and save the CSR file
```

**In Apple Developer Portal:**
1. Go to https://developer.apple.com/account/resources/certificates
2. Click "+" to create new certificate
3. Choose "Developer ID Application"
4. Upload your CSR file
5. Download the certificate (.cer file)
6. **Double-click to install in Keychain Access**

**Install Apple Intermediate Certificates (CRITICAL):**
```bash
# Download Apple's intermediate certificates
curl -O https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer
curl -O https://www.apple.com/certificateauthority/AppleRootCA-G3.cer

# Install them (will open dialogs - click "Add" for both)
open DeveloperIDG2CA.cer
open AppleRootCA-G3.cer
```

**Verify your certificate is trusted:**
```bash
# Check if your signing identity is now valid
security find-identity -v -p codesigning

# You should see:
# 1) ABC123... "Developer ID Application: Your Name (TEAM_ID)"
# 1 valid identities found
```

**If you see "0 valid identities found":**
- Your certificate shows "not trusted" in Keychain Access
- Missing intermediate certificates (install them as shown above)
- Certificate and private key aren't properly paired

### 3. Export Certificate for GitHub

**In Keychain Access:**
1. **Look for the certificate with a triangle/arrow** next to it (this means it has a private key)
2. **Expand the certificate** by clicking the triangle - you should see both:
   - Certificate: "Developer ID Application: Your Name (TEAM_ID)"  
   - Private key: "Your Name (TEAM_ID)"
3. **Select the certificate entry** (the one with the triangle, not the private key line)
4. Right-click → Export
5. **Now .p12 should be available** - Save as `.p12` file with a strong password

**Troubleshooting Export Issues:**
```bash
# If .p12 is still grayed out, check if the private key is there:
security find-identity -v -p codesigning

# You should see something like:
# 1) ABC123... "Developer ID Application: Your Name (TEAM_ID)"

# If you don't see it, the certificate/key pair wasn't installed properly
```

**If .p12 is still grayed out:**
- The certificate wasn't properly matched with your original CSR
- Try deleting the certificate and re-downloading/installing it
- Make sure you're in the correct keychain (usually "login")

4. Convert to base64 (IMPORTANT - use this exact command):
```bash
# Use openssl base64 and remove line breaks (CRITICAL for GitHub Actions)
openssl base64 -in /path/to/certificate.p12 -out /tmp/cert-base64.txt
cat /tmp/cert-base64.txt | tr -d '\n' | pbcopy

# This copies the base64 string to your clipboard
# The tr -d '\n' removes line breaks which cause import failures in CI
```

**⚠️ Common mistake:** Using just `base64 -i certificate.p12 | pbcopy` may include line breaks that break GitHub Actions!

### 4. Create App-Specific Password for Notarization

**Important: This is NOT in the Apple Developer portal. You need to go to Apple ID management:**

1. Go to **https://appleid.apple.com/account/manage** (different from developer.apple.com)
2. Sign in with your Apple ID (same one you use for Developer Program)
3. Under **"Sign-In and Security"** → **"App-Specific Passwords"**
4. Click **"+"** to generate a new password
5. **Label it** something like "Tauri Notarization" 
6. **Save this password securely** - you'll need it for GitHub secrets

**If you don't see "App-Specific Passwords":**
- Make sure you have 2FA enabled on your Apple ID (required)
- Try refreshing the page
- The option appears under the Security section

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

### 7. Update tauri.conf.json (Optional - Usually Skip This)

**RECOMMENDATION: Skip this step** - Your GitHub Actions workflow already handles signing dynamically.

**What this does:**
- Hardcodes your signing identity in the config file
- Forces Tauri to always use this specific certificate

**When you might want it:**
- Multiple developers with different certificates
- Want to enforce a specific certificate locally
- Complex team setups with certificate management

**Why you should skip it:**
- ❌ **Hardcodes sensitive info** in your repository
- ❌ **Less flexible** - breaks if certificate changes
- ❌ **GitHub Actions already handles it** via environment variables
- ❌ **Your certificate details are in the repo** (not great for security)

**Your GitHub Actions workflow is already configured correctly** with dynamic signing via secrets. No changes needed to tauri.conf.json!

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

### "0 valid identities found" / "Certificate is not trusted"
**Most common issue:** Missing Apple intermediate certificates

```bash
# Download and install Apple intermediate certificates
curl -O https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer
curl -O https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
open DeveloperIDG2CA.cer  # Click "Add" when dialog appears
open AppleRootCA-G3.cer   # Click "Add" when dialog appears

# Verify it's fixed
security find-identity -v -p codesigning
```

Other causes:
- Certificate and private key aren't properly paired
- Certificate wasn't created from your CSR
- Wrong keychain (make sure it's in "login" keychain)

### "Developer ID Application not found"
- Make sure the certificate is installed in Keychain Access
- Check that the identity name in GitHub secrets matches exactly
- Verify intermediate certificates are installed (see above)

### ".p12 export is grayed out"
- Certificate doesn't have private key attached
- Must use the certificate created from YOUR CSR request
- Delete certificate and recreate with proper CSR process

### "no identity found" in GitHub Actions
**The certificate wasn't properly imported in CI.** Common causes:

1. **Base64 encoding has line breaks** - Re-export using:
   ```bash
   openssl base64 -in /path/to/certificate.p12 -out /tmp/cert-base64.txt
   cat /tmp/cert-base64.txt | tr -d '\n' | pbcopy
   ```
   Then update the `APPLE_CERTIFICATE` secret with this new value.

2. **Wrong password** - Verify `APPLE_CERTIFICATE_PASSWORD` matches exactly

3. **Signing identity mismatch** - Verify `APPLE_SIGNING_IDENTITY` is exactly:
   ```
   Developer ID Application: Your Name (TEAM_ID)
   ```
   (No quotes, no extra spaces - must match `security find-identity` output exactly)

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
