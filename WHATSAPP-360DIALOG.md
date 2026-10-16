# Connecting your WhatsApp number through 360dialog

This keeps your number on the WhatsApp Business app (coexistence) and sends a copy of every chat to the CRM.

## Before you start

- Update the **WhatsApp Business app** on your phone to the latest version (2.24.17 or newer).
- Your number should have been in use on the app for at least 7 days.
- Keep your phone handy. You'll scan a code with it.
- Open the WhatsApp Business app at least once every 13 days afterwards, or the connection drops.

## Step 1: Sign up with 360dialog

1. Go to **360dialog.com** and sign up. Pick the basic plan for one number (about €49 a month).
2. When it asks you to connect a number, choose the option to **connect your existing WhatsApp Business App** number. It may be called "Coexistence" or "Keep using the WhatsApp Business App". **Don't pick an option that moves or migrates the number.**
3. A Meta window opens. Log in with Facebook, choose your **FCW** business portfolio, and enter your number.
4. On your phone, the WhatsApp Business app shows a prompt or QR code. Approve it, and choose whether to share your chat history (sharing is fine).

## Step 2: Give the CRM your 360dialog key

1. In the 360dialog hub, open your number and click **Generate API key**. Copy it. Don't paste it in chat.
2. In Render, open **fcw-crm**, then **Environment**, then **Edit**. Add `D360_API_KEY` with that key, then click **Save, rebuild and deploy**.

## Step 3: Connect

1. Wait until Render shows **Live**, then open your CRM and go to **Messages**.
2. Click **Connect WhatsApp (360dialog)**. It should say "Connected".
3. From another phone, send a WhatsApp message to your number. It should appear in the CRM as a new lead within a few seconds. Then reply from your phone; the lead should move to **Contacted**.

If the button shows an error, send a screenshot to Claude in the project thread.

## Afterwards

- Chat from your phone as usual.
- Messages from your Meta click-to-WhatsApp ads are tagged with the ad automatically (see `META-ADS.md`).
- The CRM still won't send messages to anyone until you approve turning that on.
