
const PASSWORD_HASH = '913a526d41bda0c248cc70a6a7fbb34d3236a2baa011313556a633a82e76997e';
let TARGET_DATETIME = 'Feb 22 22:00:00 2026'; 
let EXPIRATION = 'Mar 8 18:00:00 2026';
let previousTarget = TARGET_DATETIME; 

async function hashString(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function handleSubmit(evt) {
    evt.preventDefault();
    const input = document.getElementById('password-input');
    const loading = document.getElementById('submit-loading');
    const submitBtn = evt.target.querySelector('button[type=submit]');
    const fields = document.getElementById('form-fields');

    if (fields) fields.classList.add('hidden');
    loading.style.display = 'block';
    submitBtn.disabled = true;

    const enteredHash = await hashString(input.value);
    if (enteredHash === PASSWORD_HASH) {
        try {
            await checkTimeAndShow();
            document.getElementById('auth-box').style.display = 'none';
            setInterval(() => { checkTimeAndShow(); }, 60000);
        } catch (e) {

        }
    } else {
        const modal = document.getElementById('error-modal');
        if (modal) {
            modal.style.display = 'flex';
        } else {
            alert('Incorrect password.');
        }
        input.value = '';
        input.focus();
    }

    loading.style.display = 'none';
    submitBtn.disabled = false;
    if (fields) fields.classList.remove('hidden');
}

function formatTime(date) {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;
    return hours + ':' + minutes + ampm;
}


function formatDateTime(date) {
    if (!date) return '';
    return date.toLocaleString('en-US', { weekday: 'long', month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
} 

function parseTime(str) {
    const m = str.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3];
    if (ampm === 'pm' && h !== 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return h * 60 + min;
}


function parseTargetDateTime(str, nowDate) {

    const d = new Date(str);
    if (!isNaN(d)) return d;


    const mins = parseTime(str);
    if (mins === null) return null;
    const fallback = nowDate ? new Date(nowDate) : new Date();
    fallback.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return fallback;
}

const TIMEZONE = 'Asia/Manila';

async function getNetworkTime() {
    const urls = [
        `https://worldtimeapi.org/api/timezone/${TIMEZONE}`,
        `https://timeapi.io/api/Time/current/zone?timeZone=${TIMEZONE}`,
        'https://worldclockapi.com/api/json/utc/now'
    ];
    let lastErr;
    for (const url of urls) {
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('status ' + resp.status);
            const json = await resp.json();
            if (json.datetime) return new Date(json.datetime);
            if (json.dateTime) return new Date(json.dateTime);
            if (json.currentDateTime) {
                const d = new Date(json.currentDateTime);
                return new Date(d.getTime() + 8 * 60 * 60 * 1000);
            }
            throw new Error('unknown response format from ' + url);
        } catch (e) {
            lastErr = e;
            console.warn('time fetch failed for', url, e);
        }
    }
    throw lastErr || new Error('no time sources available');
}

function updateMessage(text, time) {
    const msgEl = document.getElementById('message-content');
    const showEl = document.getElementById('message-show-time');
    const expireEl = document.getElementById('message-expire-time');
    if (text) {
        msgEl.textContent = text;
    }
    const targetDate = parseTargetDateTime(TARGET_DATETIME);
    showEl.textContent = `Visible from ${targetDate ? formatDateTime(targetDate) : TARGET_DATETIME}`;
    expireEl.textContent = EXPIRATION ? `until ${formatDateTime(new Date(EXPIRATION))}` : '';
}

async function checkTimeAndShow() {
    const noticeEl = document.getElementById('time-notice');

    let nowDate;
    try {
        nowDate = await getNetworkTime();
    } catch (err) {
        console.error('Unable to fetch network time, aborting display:', err);
        noticeEl.textContent = 'Cannot verify current time; ensure the page is served over HTTPS and has network access. Message stays hidden until time is obtained.';
        noticeEl.style.display = 'block';
        document.getElementById('message-section').style.display = 'none';
        return;
    }

    const now = formatTime(nowDate);
    const targetDate = parseTargetDateTime(TARGET_DATETIME, nowDate);


    if (TARGET_DATETIME !== previousTarget) {
        previousTarget = TARGET_DATETIME;
        document.getElementById('message-section').style.display = 'none';
    }

    if (EXPIRATION) {
        const expDate = new Date(EXPIRATION);
        if (nowDate > expDate) {
            document.getElementById('message-section').style.display = 'none';
            noticeEl.textContent = `Message expired on ${formatDateTime(expDate)}. (Visible from ${formatDateTime(targetDate) || TARGET_DATETIME})`;
            noticeEl.style.display = 'block';
            return;
        }
    }

    if (targetDate && nowDate >= targetDate) {

        noticeEl.style.display = 'none';
        document.getElementById('message-section').style.display = 'block';
        const authBox = document.getElementById('auth-box');
        if (authBox) authBox.style.display = 'none';
        updateMessage();
    } else {
        document.getElementById('message-section').style.display = 'none';
        noticeEl.textContent = `Message will appear at ${formatDateTime(targetDate) || TARGET_DATETIME}. Current time: ${formatDateTime(nowDate)}`;
        noticeEl.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('password-form');
    form.addEventListener('submit', handleSubmit);
    const showSpan = document.getElementById('schedule-show');
    const expSpan = document.getElementById('schedule-expire');
    if (showSpan) {
        const td = parseTargetDateTime(TARGET_DATETIME);
        showSpan.textContent = `Visible from ${td ? formatDateTime(td) : TARGET_DATETIME}`;
    }
    if (expSpan) expSpan.textContent = EXPIRATION ? `until ${formatDateTime(new Date(EXPIRATION))}` : '';


    const modalClose = document.getElementById('modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            const modal = document.getElementById('error-modal');
            if (modal) modal.style.display = 'none';
        });
    }
});
