# Google Ads lead forms: the journey and how to connect

## The journey

| Step | What happens | What the CRM does |
| --- | --- | --- |
| 1. Sees the ad | Someone sees your Google ad (Search, YouTube or Display) with a lead form. | Nothing yet. |
| 2. Fills the form | They enter their name, phone number and any questions you ask, and submit. They never leave Google. | Within seconds, creates a lead with source **Google Ads**, the campaign name and all their form answers. Sets a "reply or call" reminder. |
| 3. You contact them fast | Call or WhatsApp them from the lead (the **Call** and **WhatsApp** buttons). Form leads go cold quickly, so aim for the same hour. | Log the call outcome as a note, and move the status to **Contacted**. |
| 4. Follow-ups | Schedule the next follow-up from the lead. | Reminds you when it's due. |
| 5. Outcome | They buy or drop off. | Set **Won** or **Lost**. |
| 6. Results | Compare campaigns. | The **Ads** table on the Today screen shows each campaign's leads, still open, won and win rate. |

If the same phone number fills a form again, the CRM adds it to the existing lead's history instead of making a duplicate. Google sometimes sends the same lead twice; the CRM only records it once.

## Connect the form to the CRM

1. In Render, open **fcw-crm**, then **Environment**, and copy the value of **GOOGLE_ADS_KEY** (eye icon).
2. In Google Ads, go to **Campaigns**, then **Assets**, and open your **Lead form** asset to edit it. (You can also find it inside the campaign's assets.)
3. Scroll to **Lead delivery** (sometimes "Other data integration options") and choose **Webhook integration**.
4. Fill in:
   - **Webhook URL:** `https://fcw-crm.onrender.com/webhooks/google-ads`
   - **Key:** the GOOGLE_ADS_KEY value
5. Click **Send test data**. Open the CRM: a lead with the note "Google Ads test lead" should appear. Delete it from its **Details** tab.
6. Save the lead form. Repeat for every lead form you use.

Google's menu names change from time to time, so treat these as a guide.

## Show campaign names instead of numbers

Google only sends the campaign's ID number. Without a name, leads show as "Google campaign 21234567890". To show real names:

1. In Google Ads, open **Campaigns**, click **Columns**, and add the **Campaign ID** column.
2. In Render, open **fcw-crm**, then **Environment**, then **Edit**, and add `GOOGLE_CAMPAIGN_NAMES` with each ID and name, separated by semicolons, for example: `21234567890=Diwali Sale; 21234567891=Kids Gifts`
3. Click **Save, rebuild and deploy**. New leads get the names. For older leads, edit **Ad / campaign** in the lead's **Details** tab.

## Tips for the form

- Make **phone number** required, and add a question such as "Is this your WhatsApp number?" so you know how to reach them.
- Add one or two qualifying questions, for example "What are you looking for?" or "Which city?". The CRM saves all answers on the lead.
- Keep it short. Every extra question lowers the number of people who submit.

## Backup

Google keeps lead form submissions for 30 days. If the connection ever fails, download them from the lead form asset in Google Ads and add any missing ones with **+ Add lead**.

## Later

The CRM saves Google's click ID (GCLID) for each lead. A later step could report **Won** leads back to Google Ads, so it shows your ads to more people like your buyers. That isn't built yet.
