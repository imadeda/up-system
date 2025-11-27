# Up System - Deployment Guide

This guide walks you through deploying your Up System app so all your reps can use it on their phones with real-time sync.

**Estimated time:** 30-45 minutes  
**Cost:** $0/month (using free tiers)

---

## Overview

You'll be setting up:
1. **Firebase** - Real-time database (so all phones see the same data)
2. **Vercel** - Hosting (where the app lives on the internet)
3. **GitHub** - Code storage (connects Firebase to Vercel)

---

## Step 1: Create a GitHub Account (if you don't have one)

1. Go to [github.com](https://github.com)
2. Click "Sign up"
3. Follow the prompts to create an account

---

## Step 2: Upload the Code to GitHub

### Option A: Using GitHub Web Interface (Easiest)

1. Log into GitHub
2. Click the **+** icon in the top right → **New repository**
3. Name it `up-system`
4. Keep it **Public** (required for free Vercel hosting)
5. Click **Create repository**
6. On the next page, click **"uploading an existing file"**
7. Drag and drop all the files from the `up-system-firebase` folder
8. Click **Commit changes**

### Option B: Using Git Command Line

```bash
cd up-system-firebase
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/up-system.git
git push -u origin main
```

---

## Step 3: Set Up Firebase

### 3.1 Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Create a project"** (or "Add project")
3. Name it `up-system` (or anything you like)
4. Disable Google Analytics (not needed) → Click **Create project**
5. Wait for it to finish, then click **Continue**

### 3.2 Create the Realtime Database

1. In the left sidebar, click **Build** → **Realtime Database**
2. Click **Create Database**
3. Select a location closest to you (e.g., `us-central1`)
4. Start in **Test mode** (we'll secure it later) → Click **Enable**

### 3.3 Get Your Firebase Config

1. Click the **gear icon** (⚙️) next to "Project Overview" → **Project settings**
2. Scroll down to "Your apps" section
3. Click the **</>** (Web) icon to add a web app
4. Name it `up-system-web`
5. **Don't** check "Firebase Hosting"
6. Click **Register app**
7. You'll see a code block with `firebaseConfig`. Copy these values:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",           // Copy this
  authDomain: "...",           // Copy this
  databaseURL: "https://...",  // Copy this (IMPORTANT!)
  projectId: "...",            // Copy this
  storageBucket: "...",        // Copy this
  messagingSenderId: "...",    // Copy this
  appId: "..."                 // Copy this
};
```

### 3.4 Update Your Code with Firebase Config

1. Go to your GitHub repository
2. Navigate to `src/firebase.js`
3. Click the **pencil icon** (✏️) to edit
4. Replace the placeholder values with your Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

5. Click **Commit changes**

---

## Step 4: Deploy to Vercel

### 4.1 Create a Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up**
3. Choose **Continue with GitHub** (easiest)
4. Authorize Vercel to access your GitHub

### 4.2 Import Your Project

1. Click **Add New...** → **Project**
2. Find your `up-system` repository and click **Import**
3. Vercel auto-detects it's a Vite project
4. Leave all settings as default
5. Click **Deploy**
6. Wait 1-2 minutes for the build to complete

### 4.3 Get Your URL

Once deployed, you'll see something like:
```
✓ Production: https://up-system-abc123.vercel.app
```

**This is your app's URL!** Reps can open this on their phones.

---

## Step 5: Secure Your Database

Now that everything works, let's add basic security:

1. Go back to [Firebase Console](https://console.firebase.google.com)
2. Click **Realtime Database** → **Rules** tab
3. Replace the rules with:

```json
{
  "rules": {
    "store": {
      ".read": true,
      ".write": true
    }
  }
}
```

4. Click **Publish**

> **Note:** This allows anyone with the URL to read/write. For tighter security, you can add authentication later (see "Optional Enhancements" below).

---

## Step 6: Test It!

1. Open your Vercel URL on your phone
2. Open it on a second phone (or computer)
3. Set up a shift with some rep names
4. Check someone in on one device
5. **Watch it appear instantly on the other device!** ✨

---

## Step 7: Add to Home Screen (Optional but Recommended)

Reps can save the app to their phone's home screen so it feels like a native app:

### iPhone:
1. Open the URL in Safari
2. Tap the **Share** button (square with arrow)
3. Tap **"Add to Home Screen"**
4. Name it "Up System" → Tap **Add**

### Android:
1. Open the URL in Chrome
2. Tap the **three dots** menu
3. Tap **"Add to Home screen"**
4. Name it "Up System" → Tap **Add**

---

## Troubleshooting

### "Permission denied" errors
- Check that your Firebase database rules allow read/write
- Make sure the `databaseURL` in `firebase.js` is correct

### App shows "Loading..." forever
- Check browser console for errors (F12 on desktop)
- Verify your Firebase config values are correct
- Make sure the Realtime Database was created (not Firestore)

### Changes not syncing between devices
- Both devices must be online
- Check Firebase Console → Realtime Database → Data to see if data is being written

### Build fails on Vercel
- Make sure all files were uploaded to GitHub
- Check that `package.json` exists in the root folder

---

## Optional Enhancements

### Custom Domain
Instead of `up-system-abc123.vercel.app`, use your own domain:
1. In Vercel, go to your project → **Settings** → **Domains**
2. Add your domain and follow the DNS instructions

### Password Protection
To prevent random people from accessing your app:
1. Add Firebase Authentication
2. Create a simple PIN code system
3. Or use Vercel's password protection (requires Pro plan)

### Daily Reset
To automatically clear data each day:
1. Set up a Firebase Cloud Function
2. Or add a "Clear Day" button for managers

---

## Quick Reference

| What | Where |
|------|-------|
| Your app URL | `https://up-system-XXXX.vercel.app` |
| View/manage data | Firebase Console → Realtime Database |
| View deployments | Vercel Dashboard |
| Update code | Push to GitHub (auto-deploys) |

---

## Need Help?

- **Firebase docs:** [firebase.google.com/docs](https://firebase.google.com/docs)
- **Vercel docs:** [vercel.com/docs](https://vercel.com/docs)
- **React docs:** [react.dev](https://react.dev)

---

**Congratulations!** 🎉 Your Up System is now live and syncing in real-time across all devices.
