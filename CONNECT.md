# Connecting Google Ads and WhatsApp to your CRM

Your CRM address: **https://fcw-crm.onrender.com**

Both connections need two secret values that Render already made for you. To see one, go to Render, open **fcw-crm**, then **Environment**, and click the eye icon next to the name.

---

## Part 1: Google Ads (about 5 minutes)

This works for **lead form assets** in Google Ads, the forms people fill in directly inside your ad. It does not cover forms on your own website.

1. In Render, copy the value of **GOOGLE_ADS_KEY**.
2. In Google Ads, open the campaign that has your lead form, then go to **Assets** and open the **Lead form** asset to edit it.
3. Scroll to **Lead delivery options** (sometimes called "Other data integration options") and choose **Webhook integration**.
4. Fill in:
   - **Webhook URL:** `https://fcw-crm.onrender.com/webhooks/google-ads`
   - **Key:** paste the GOOGLE_ADS_KEY value
5. Click **Send test data**. Google should show that it succeeded.
6. Open your CRM and go to **Leads**. A new Google Ads lead with the note "Google Ads test lead" should be there. You can delete it from its **Details** tab.
7. Save the lead form.

From now on, every form filled in on that ad appears in the CRM within seconds. Repeat steps 2 to 7 for each lead form you use.

---

## Part 2: WhatsApp (longer, and one important warning)

### Read this first

For WhatsApp chats to reach the CRM automatically, your number has to be connected to Meta's **WhatsApp Business Platform** (the "Cloud API").

**Warning:** your number is on the WhatsApp Business app. The normal way of connecting a number to the API **removes it from the app**. Meta has a newer option called **coexistence** that keeps the app working on your phone while also connecting the API. Only use that option. If Meta doesn't offer it to you, stop and tell me before going further.

From what I know, coexistence is offered through Meta's sign-up flow, sometimes only through a Meta partner, and it isn't available in every country yet. I can't check your Meta account from here, so treat the exact button names below as a guide.

### Steps

1. **Meta business account.** Go to business.facebook.com and make sure you have a business portfolio for FCW.
2. **Create a Meta app.** Go to developers.facebook.com, open **My Apps**, click **Create app** and choose the **Business** type. Link it to your FCW business portfolio.
3. **Add WhatsApp.** In the app, add the **WhatsApp** product.
4. **Connect your number with coexistence.** Under **WhatsApp > API Setup**, add a phone number and choose the option to **connect an existing WhatsApp Business app number**. Meta asks you to scan a QR code from the WhatsApp Business app on your phone. *If you only see an option that would move your number off the app, stop here and tell me.*
5. **Copy the app secret.** In the app, go to **App settings > Basic**, click **Show** next to **App secret**, and copy it. In Render, open **fcw-crm > Environment > Edit**, add a variable named `WHATSAPP_APP_SECRET` with that value, and click **Save, rebuild and deploy**. This makes the CRM reject anything that doesn't really come from Meta.
6. **Point WhatsApp at the CRM.** Back in Meta, go to **WhatsApp > Configuration**, then **Webhook**, and click **Edit**:
   - **Callback URL:** `https://fcw-crm.onrender.com/webhooks/whatsapp`
   - **Verify token:** copy the **WHATSAPP_VERIFY_TOKEN** value from Render
   - Click **Verify and save**.
7. **Turn on messages.** In the same **Webhook fields** list, click **Subscribe** next to **messages**.
8. **Test.** From a different phone, send a WhatsApp message to your business number. A new WhatsApp lead with that person's name, number and message should appear in the CRM.

### What stays off for now

The CRM still won't **send** any WhatsApp messages. Reminders and client follow-up texts stay in test mode and are only listed under **Messages**. Turning sending on comes later, after Meta-approved message templates are set up and you say go.
