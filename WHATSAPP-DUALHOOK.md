# Connecting your WhatsApp number through Dualhook

Dualhook connects your number in "coexistence" mode, so it stays on the WhatsApp Business app, and asks Meta to send every WhatsApp event straight to the CRM. Messages don't pass through Dualhook, and they arrive in Meta's own format. That means ad tagging and "you replied" tracking work automatically.

## Using a separate number for ads

This guide works for a new number just for your ads, which keeps your personal number untouched.

1. Get a new SIM (or a number that can receive an SMS or call) that has never been on WhatsApp.
2. Put it in a second phone (or a dual-SIM phone) and set up the **WhatsApp Business app** with that number. Add your FCW name, logo and business hours.
3. Use it for a few days first. Meta only allows coexistence for numbers that have been active on the app for a while (about 7 days).
4. Change your Meta ads' WhatsApp button to the new number. The ad chats arrive there from then on.
5. Then follow the steps below to connect it.


- Update the **WhatsApp Business app** to the latest version. Your number should have been in use on it for a while (Meta asks for about 7 days).
- Have your phone handy, and access to your FCW business portfolio on Facebook.
- Open the WhatsApp Business app at least every 13 days afterwards, or Meta disconnects it.

## Step 1: Get two values from Render

In Render, open **fcw-crm**, then **Environment**, and click the eye icon to copy each value:

- **WHATSAPP_WEBHOOK_KEY**
- **WHATSAPP_VERIFY_TOKEN**

Don't paste them in chat.

## Step 2: Sign up and save the webhook first

1. Sign up at **dualhook.com** and start the Developer plan (14-day free trial, then about $12 a month).
2. **Before connecting your number**, find the webhook settings and enter:
   - **Webhook URL:** `https://fcw-crm.onrender.com/webhooks/whatsapp?key=` followed by your WHATSAPP_WEBHOOK_KEY value (no spaces)
   - **Verify token:** your WHATSAPP_VERIFY_TOKEN value
3. Save. If Dualhook offers a **Test** button, use it; it should succeed.

## Step 3: Connect your number

1. Start the connection (Embedded Signup). A Meta window opens.
2. Pick your **FCW** business portfolio and WhatsApp Business account, and choose your **existing WhatsApp Business App number**. Don't pick an option that moves or migrates the number.
3. Approve the connection on your phone, and choose whether to share chat history.

## Step 4: Test

1. From another phone, send a WhatsApp message to your number. It should appear in the CRM as a new lead within seconds.
2. Reply from your phone. The lead should move to **Contacted**.
3. Tap your own Meta ad's "Chat on WhatsApp" button from another phone and send the message. The lead should show source **Meta Ads** with the ad's name.

If something doesn't show up, send Claude a screenshot in the project thread.
