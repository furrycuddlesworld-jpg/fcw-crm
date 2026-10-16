# Connecting your WhatsApp number through Interakt

This keeps your number on the WhatsApp Business app (coexistence) and sends a copy of each customer message to the CRM.

## What you need

- An **Interakt Growth plan or higher**. Interakt only sends incoming messages to other systems (webhooks) on higher plans.
- Your **GST certificate**, which Interakt asks for during setup.
- Your FCW Facebook business portfolio, and your phone with the WhatsApp Business app (latest version).

## Step 1: Connect your number in Interakt

1. Log in at **app.interakt.ai** and click **Connect Your Number**.
2. Fill in your location, GST certificate and business details, then log in with Facebook and pick your FCW business portfolio.
3. Choose **connect your existing WhatsApp Business App**. Don't pick an option that moves the number.
4. Enter your number exactly as it is on the app, then the 6-digit code WhatsApp sends you.
5. In the WhatsApp Business app, open the message from Facebook, tap **Scan QR** and scan the code on your screen live.

## Step 2: Send messages to the CRM

1. Make up a long secret phrase, for example 30 random letters and numbers. Don't share it in chat.
2. In Render, open **fcw-crm**, then **Environment**, then **Edit**. Add `INTERAKT_SECRET` with that phrase, then click **Save, rebuild and deploy**.
3. In Interakt, go to **Settings**, then **Developer Settings**, and turn on webhooks:
   - **Webhook URL:** `https://fcw-crm.onrender.com/webhooks/interakt`
   - **Secret key:** the same phrase
   - Tick the webhook type for **incoming customer messages**.
4. From another phone, send a WhatsApp message to your number. It should appear in the CRM as a new lead.

## Good to know

- Interakt doesn't pass on which ad a chat came from, so put a code like `(Ad: DIWALI)` at the end of each ad's pre-filled message. The CRM reads it and tags the lead with that ad.
- Interakt turns its webhook off if the CRM fails to answer 5 times within 10 minutes. If leads stop arriving, check that webhooks are still switched on in Interakt.
