# Landing page lead form: the journey and how to connect

Your Google ads (and Meta ads, if any point to the page) send people to your landing page, where they fill in a form. The CRM gets a copy of every form, tagged with the ad that brought the person.

## The journey

| Step | What happens | What the CRM does |
| --- | --- | --- |
| 1. Clicks the ad | Google adds a click ID (`gclid`) and your tracking tags (`utm_...`) to the page address. | Nothing yet. |
| 2. Lands on the page | They read the page, maybe browse a little. | The CRM script remembers which ad they came from, for 30 days, even if they leave and come back. |
| 3. Fills the form | Name, phone, and your questions. Your page shows its usual thank-you message. | Within seconds, creates a lead with source **Google Ads** (or **Meta Ads**, or **Website** for visitors who didn't come from an ad), the campaign, all their answers and the page they used. Sets a "reply or call" reminder. |
| 4. You contact them fast | Call or WhatsApp them from the lead. Aim for the same hour. | Log the outcome as a note and move the status to **Contacted**. |
| 5. Follow-ups | Schedule the next follow-up from the lead. | Reminds you when it's due. |
| 6. Outcome | They buy or drop off. | Set **Won** or **Lost**. |
| 7. Results | Compare campaigns. | The **Ads** table on the Today screen shows leads, open, won and win rate per campaign. |

If the same phone number or email fills the form again, the CRM adds it to the existing lead's history instead of creating a duplicate.

## Step 1: get your form key

In Render, open **fcw-crm**, then **Environment**, and copy the value of **FORM_KEY** (eye icon). If it isn't there yet, open **Blueprints**, then **fcw-crm**, and click **Manual sync**; Render creates it.

## Step 2: connect the form (pick one)

### Option A: add one line to the page (works with most builders)

Paste this into the landing page's code, just before `</body>`, or into the builder's "custom code", "footer code" or "tracking code" box. Replace `YOUR_FORM_KEY` with the key from step 1:

```html
<script src="https://fcw-crm.onrender.com/form.js" data-key="YOUR_FORM_KEY" async></script>
```

Your form keeps working exactly as before (emails, Google Sheets, whatever it does now). The script only sends the CRM a copy, and it never sends passwords or card details.

This does not work for a form shown inside a box from another site (Google Forms, Typeform, Jotform embeds). Use option B for those.

### Option B: the form builder's webhook

Many builders (Elementor Pro, WPForms, Webflow via Zapier, Wix Automations, Typeform, Jotform) can send each submission to a webhook. Use this address:

```
https://fcw-crm.onrender.com/webhooks/form?key=YOUR_FORM_KEY
```

With option B the CRM sees only what the builder sends, so the ad details reach it only if your form has hidden fields named `gclid`, `utm_source` and `utm_campaign` that the builder fills from the page address. Option A does this for you, so prefer it when you can.

### Test it

Open the landing page with a test address such as `https://your-page.com/?utm_source=google&utm_campaign=test`, fill in the form with your own details, and check that a **Google Ads** lead with campaign "test" appears in the CRM. Delete it from its **Details** tab.

### Elementor (WordPress)

Use option A:

1. In WordPress, open the landing page and click **Edit with Elementor**.
2. Drag an **HTML** widget (search "HTML" in the widgets panel) to the bottom of the page.
3. Paste the script line from option A, with your key, into the widget's box. It shows nothing on the page.
4. Click **Update**. If you use a caching plugin (WP Rocket, LiteSpeed, W3 Total Cache), clear its cache.

If you have Elementor Pro and want the CRM on every page, use **Elementor**, **Custom Code**, **Add New** instead, with location **</body> - End**, and set the display condition to **Entire Site**.

Your form fields can keep their own names. The CRM reads the visible labels (such as "Phone Number"), so a phone field called `field_a1b2c3` still lands as the phone number.

Backup: in the Form widget, **Actions After Submit**, add **Webhook** and paste the option B address. The ad details only come through this way if you add hidden fields named `gclid` and `utm_campaign` set to the dynamic tag **Request Parameter**, so the script is easier.

## Step 3: tag your Google ads

1. **Keep auto-tagging on:** Google Ads, **Admin**, **Account settings**, **Auto-tagging** ticked. This adds the `gclid`.
2. **Add a tracking template** so each lead shows the campaign: Google Ads, **Admin**, **Account settings**, **Tracking**, then set the tracking template to:

   ```
   {lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={creative}&utm_term={keyword}
   ```

   If your landing page address already has a `?` in it, use `{lpurl}&utm_source=...` instead.
3. Campaigns arrive as ID numbers. To show names, add `GOOGLE_CAMPAIGN_NAMES` in Render as described in [GOOGLE-ADS.md](GOOGLE-ADS.md) ("Show campaign names instead of numbers"). Or put the name straight into the ad's own URL suffix, e.g. `utm_campaign=diwali_sale`.

For Meta ads that point to the same page, add `?utm_source=facebook&utm_campaign=YOUR_CAMPAIGN` to the ad's website URL. Meta also adds its own `fbclid`, which the CRM recognises.

## Tips for the form

- Make **phone number** required and ask if it's on WhatsApp.
- Name the fields plainly (`name`, `phone`, `email`, `message`) if your builder lets you; the CRM recognises the common variations either way and saves every other answer on the lead.
- Spam: the CRM accepts at most 10 forms per visitor per 10 minutes and ignores submissions without a phone or email.

## Later

The CRM saves the Google click ID (`gclid`) for each lead. A later step could report **Won** leads back to Google Ads so it finds more people like your buyers. That isn't built yet.
