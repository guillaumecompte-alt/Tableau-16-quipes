/**
 * ZE PADEL — Gmail relay for controlled test emails.
 *
 * This script intentionally sends ONLY to the two test addresses below.
 * Do not widen the allowlist until the app and email content have been validated.
 */

const TEST_RECIPIENTS = new Set([
  'guillaume.compte@gmail.com',
  'williamdurand84@gmail.com',
]);
const SECRET_PROPERTY = 'ZE_PADEL_API_SECRET';
const MAX_TEST_RECIPIENTS_PER_DAY = 10;

function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'ZE PADEL Gmail relay',
    mode: 'TEST_ONLY',
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return jsonResponse_({ ok: false, error: 'busy_try_again' });
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const expectedSecret = props.getProperty(SECRET_PROPERTY);
    if (!expectedSecret) {
      return jsonResponse_({ ok: false, error: 'server_not_configured' });
    }

    const rawBody = e && e.postData && e.postData.contents;
    if (!rawBody || rawBody.length > 30000) {
      return jsonResponse_({ ok: false, error: 'invalid_request_body' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (_) {
      return jsonResponse_({ ok: false, error: 'invalid_json' });
    }

    if (!constantTimeEqual_(String(payload.secret || ''), expectedSecret)) {
      return jsonResponse_({ ok: false, error: 'unauthorized' });
    }

    const recipient = String(payload.to || '').trim().toLowerCase();
    if (!TEST_RECIPIENTS.has(recipient)) {
      return jsonResponse_({ ok: false, error: 'recipient_not_allowed_in_test_mode' });
    }

    const requestId = String(payload.requestId || '');
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(requestId)) {
      return jsonResponse_({ ok: false, error: 'invalid_request_id' });
    }

    const subject = String(payload.subject || '').trim();
    const textBody = String(payload.text || '');
    const htmlBody = String(payload.html || '');
    if (!subject || subject.length > 180 || !textBody || textBody.length > 20000 || htmlBody.length > 20000) {
      return jsonResponse_({ ok: false, error: 'invalid_email_content' });
    }

    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      requestId + ':' + recipient,
    );
    const sentKey = 'ZE_PADEL_TEST_SENT_' +
      Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '');
    if (props.getProperty(sentKey)) {
      return jsonResponse_({ ok: false, error: 'duplicate_request' });
    }

    const dateKey = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
    const countKey = 'ZE_PADEL_TEST_COUNT_' + dateKey;
    const count = Number(props.getProperty(countKey) || 0);
    if (count >= MAX_TEST_RECIPIENTS_PER_DAY) {
      return jsonResponse_({ ok: false, error: 'test_daily_limit_reached' });
    }
    if (MailApp.getRemainingDailyQuota() < 1) {
      return jsonResponse_({ ok: false, error: 'gmail_daily_quota_reached' });
    }

    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      body: textBody,
      htmlBody: htmlBody || undefined,
      name: 'ZE PADEL · Convocations',
    });

    // Record only after Gmail accepts the send request.
    props.setProperty(sentKey, new Date().toISOString());
    props.setProperty(countKey, String(count + 1));

    return jsonResponse_({ ok: true, sent: true, to: recipient });
  } catch (error) {
    console.error('ZE PADEL Gmail relay error: ' + String(error));
    return jsonResponse_({ ok: false, error: 'send_failed' });
  } finally {
    lock.releaseLock();
  }
}

function constantTimeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
