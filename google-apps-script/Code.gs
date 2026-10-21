/**
 * ZE PADEL — Gmail relay.
 *
 * Default mode is TEST_ONLY. Production must be explicitly enabled via the
 * ZE_PADEL_MODE script property. Never place the shared secret in source code.
 */
const TEST_RECIPIENTS = new Set([
  'guillaume.compte@gmail.com',
  'williamdurand84@gmail.com',
]);
const SECRET_PROPERTY = 'ZE_PADEL_API_SECRET';
const MODE_PROPERTY = 'ZE_PADEL_MODE';
const MAX_TEST_RECIPIENTS_PER_DAY = 10;
const MAX_PRODUCTION_RECIPIENTS_PER_DAY = 40;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function doGet() {
  const mode = PropertiesService.getScriptProperties().getProperty(MODE_PROPERTY) === 'PRODUCTION'
    ? 'PRODUCTION'
    : 'TEST_ONLY';
  return jsonResponse_({
    ok: true,
    service: 'ZE PADEL Gmail relay',
    mode: mode,
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
    const requestedMode = String(payload.mode || 'TEST_ONLY');
    if (!EMAIL_RE.test(recipient) || recipient.length > 254) {
      return jsonResponse_({ ok: false, error: 'invalid_recipient' });
    }

    const configuredProduction = props.getProperty(MODE_PROPERTY) === 'PRODUCTION';
    if (requestedMode === 'TEST_ONLY') {
      if (!TEST_RECIPIENTS.has(recipient)) {
        return jsonResponse_({ ok: false, error: 'recipient_not_allowed_in_test_mode' });
      }
    } else if (requestedMode === 'PRODUCTION') {
      if (!configuredProduction) {
        return jsonResponse_({ ok: false, error: 'production_mode_not_enabled' });
      }
      if (TEST_RECIPIENTS.has(recipient)) {
        return jsonResponse_({ ok: false, error: 'test_recipient_blocked_in_production' });
      }
    } else {
      return jsonResponse_({ ok: false, error: 'invalid_mode' });
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
    const sentKey = 'ZE_PADEL_SENT_' +
      Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '');
    if (props.getProperty(sentKey)) {
      return jsonResponse_({ ok: false, error: 'duplicate_request' });
    }

    const dateKey = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
    const quotaMode = requestedMode === 'PRODUCTION' ? 'PRODUCTION' : 'TEST';
    const countKey = 'ZE_PADEL_' + quotaMode + '_COUNT_' + dateKey;
    const count = Number(props.getProperty(countKey) || 0);
    const maxPerDay = requestedMode === 'PRODUCTION'
      ? MAX_PRODUCTION_RECIPIENTS_PER_DAY
      : MAX_TEST_RECIPIENTS_PER_DAY;

    if (count >= maxPerDay) {
      return jsonResponse_({ ok: false, error: 'daily_limit_reached' });
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

    props.setProperty(sentKey, new Date().toISOString());
    props.setProperty(countKey, String(count + 1));

    return jsonResponse_({ ok: true, sent: true, to: recipient, mode: requestedMode });
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
