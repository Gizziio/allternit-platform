# Manual Publishing Guide

Your NPM account requires 2FA for publishing. Here's how to publish manually:

## ✅ SDK Package Ready

The SDK package is ready at:
```
/Users/macbook/allternit-plugin-sdk/allternit-plugin-sdk-1.0.0.tgz
```

## Method 1: Publish via NPM Website (Easiest)

### Step 1: Go to NPM Website
Visit: https://www.npmjs.com/settings/allternit/packages

### Step 2: Create New Package
1. Click "+ New Package" or "Create New Package"
2. Select "Upload Package"
3. Choose the file: `allternit-plugin-sdk-1.0.0.tgz`
4. Click "Publish"

### Step 3: Verify
Visit: https://www.npmjs.com/package/@allternit/plugin-sdk

## Method 2: Publish via CLI with OTP

### Step 1: Get OTP Code
Open your authenticator app (Google Authenticator/Authy) and get the 6-digit code for NPM.

### Step 2: Publish with OTP
```bash
cd /Users/macbook/allternit-plugin-sdk
npm publish --access public --otp=123456
```
Replace `123456` with your actual OTP code.

## Method 3: Temporarily Disable 2FA

### Step 1: Disable 2FA
1. Go to: https://www.npmjs.com/settings/allternit
2. Under "Two-Factor Authentication"
3. Click "Disable 2FA"
4. Enter your password

### Step 2: Publish
```bash
cd /Users/macbook/allternit-plugin-sdk
npm publish --access public
```

### Step 3: Re-enable 2FA
Go back to settings and re-enable 2FA for security.

---

## Publishing the 12 Plugins

After the SDK is published, publish the plugins:

### Option A: One by One
```bash
cd /Users/macbook/allternit-plugins

# For each plugin:
cd marketresearchcard-plugin
npm install
npm run build
npm pack
cp *.tgz ../
cd ..

# Then upload each .tgz to NPM website
```

### Option B: Batch Script
```bash
cd /Users/macbook/allternit-plugins

for d in */; do
  echo "Building $d..."
  cd "$d"
  npm install
  npm run build
  npm pack
  mv *.tgz ../
  cd ..
done

# Now upload all 12 .tgz files via NPM website
```

---

## Files Ready to Publish

### SDK
- `/Users/macbook/allternit-plugin-sdk/allternit-plugin-sdk-1.0.0.tgz`

### Plugins (need build first)
- `/Users/macbook/allternit-plugins/marketresearchcard-plugin/`
- `/Users/macbook/allternit-plugins/codereviewcard-plugin/`
- `/Users/macbook/allternit-plugins/imagegencard-plugin/`
- `/Users/macbook/allternit-plugins/datatablecard-plugin/`
- `/Users/macbook/allternit-plugins/documentanalyzercard-plugin/`
- `/Users/macbook/allternit-plugins/emailcomposercard-plugin/`
- `/Users/macbook/allternit-plugins/chatbotcard-plugin/`
- `/Users/macbook/allternit-plugins/apispeccard-plugin/`
- `/Users/macbook/allternit-plugins/prdescriptioncard-plugin/`
- `/Users/macbook/allternit-plugins/socialmediacard-plugin/`
- `/Users/macbook/allternit-plugins/testgeneratorcard-plugin/`
- `/Users/macbook/allternit-plugins/translationcard-plugin/`

---

## After Publishing

Verify everything is live:

```bash
npm view @allternit/plugin-sdk version
# Should show: 1.0.0

npm view @allternit/marketresearchcard-plugin version
# Should show: 1.0.0
```

Users can then install:
```bash
npm install -g @allternit/plugin-sdk
```
