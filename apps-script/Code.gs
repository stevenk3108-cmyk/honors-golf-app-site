/**
 * Honors early-access sign-ups → Google Sheet (+ confirmation email).
 *
 * Paste this whole file into the Apps Script editor of the Google Sheet that will hold the sign-ups
 * (Sheet → Extensions → Apps Script), then follow apps-script/SETUP.txt.
 */

const SHEET_NAME = 'Sign-ups';
const SEND_CONFIRMATION = true;      // set false to only save rows, no email
const FROM_NAME = 'Honors';
const REPLY_TO = '';                 // optional, e.g. 'hello@honorsgolf.app'

const HEADERS = ['Timestamp', 'Name', 'Email', 'Course', 'Country', 'Device', 'Confirmation email'];

function doGet() {
  return json_({ ok: true, service: 'honors-signups' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Hidden "website" field: real people leave it empty, bots fill it in. Pretend it worked.
    if (data.website) return json_({ ok: true });

    const name = clean_(data.name, 120);
    const email = clean_(data.email, 254).toLowerCase();
    const course = clean_(data.course, 160);
    const country = clean_(data.country, 80);
    const device = String(data.device || '').toLowerCase();

    if (!name) return json_({ ok: false, error: 'Please enter your name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json_({ ok: false, error: 'Please enter a valid email address.' });
    if (!country) return json_({ ok: false, error: 'Please select your country.' });
    if (device !== 'ios' && device !== 'android') return json_({ ok: false, error: 'Please choose a device.' });

    const sheet = getSheet_();

    // Already signed up? Say thanks, but don't add a second row or send a second email.
    if (sheet.getLastRow() > 1) {
      const emails = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < emails.length; i++) {
        if (String(emails[i][0]).toLowerCase() === email) return json_({ ok: true, duplicate: true });
      }
    }

    sheet.appendRow([
      new Date(),
      safe_(name),
      email,
      safe_(course),
      safe_(country),
      device === 'ios' ? 'iOS' : 'Android',
      SEND_CONFIRMATION ? 'Pending' : 'Off'
    ]);
    const row = sheet.getLastRow();

    if (SEND_CONFIRMATION) {
      let status;
      try {
        sendConfirmation_(name, email);
        status = 'Sent';
      } catch (err) {
        status = 'Failed: ' + String(err && err.message || err).slice(0, 100);
      }
      sheet.getRange(row, HEADERS.length).setValue(status);
    }

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'Something went wrong. Please try again.' });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function sendConfirmation_(name, email) {
  const first = name.split(/\s+/)[0];
  const subject = 'You’re on the list for Honors early access';

  const text =
    'Hi ' + first + ',\n\n' +
    'Thanks for signing up for early access to Honors. We’ve got your details.\n\n' +
    'We’re adding people gradually, so it may take us a little while to get to you. ' +
    'When your access is ready, we’ll email you.\n\n' +
    'In the meantime, tell your mates: the more of them in, the better your league.\n\n' +
    'See you on the course,\n' +
    'The Honors team';

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1b251f;line-height:1.6">' +
    '<div style="background:#0a3322;padding:22px 28px;border-radius:12px 12px 0 0">' +
    '<span style="color:#00f5b4;font-weight:700;letter-spacing:.2em;font-size:15px">HONORS</span></div>' +
    '<div style="background:#f9f5ee;padding:28px;border-radius:0 0 12px 12px">' +
    '<p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0a3322">You’re on the list, ' + esc_(first) + '.</p>' +
    '<p style="margin:0 0 16px">Thanks for signing up for early access to Honors. We’ve got your details.</p>' +
    '<p style="margin:0 0 16px">We’re adding people gradually, so it may take us a little while to get to you. When your access is ready, we’ll email you.</p>' +
    '<p style="margin:0 0 16px">In the meantime, tell your mates: the more of them in, the better your league.</p>' +
    '<p style="margin:0">See you on the course,<br>The Honors team</p>' +
    '</div></div>';

  const options = { to: email, subject: subject, body: text, htmlBody: html, name: FROM_NAME };
  if (REPLY_TO) options.replyTo = REPLY_TO;
  MailApp.sendEmail(options);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
  }
  return sheet;
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}
// Stop a value like "=HYPERLINK(...)" being run as a formula in the sheet.
function safe_(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run this once from the editor: it asks for permissions and creates the "Sign-ups" tab. */
function setup() {
  getSheet_();
  if (SEND_CONFIRMATION) MailApp.getRemainingDailyQuota();
}
