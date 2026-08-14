import { loadPreferences, savePreferences } from "./core/storage";

const REMINDER_ALARM = "daily-job-match-reminder";
const REMINDER_NOTIFICATION = "daily-job-match-notification";
const DEFAULT_URL = "https://www.zhipin.com/web/geek/job";

function nextReminderTime(time: string): number {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const next = new Date();
  next.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  return next.getTime();
}

async function configureReminder(): Promise<void> {
  const preferences = await loadPreferences();
  await chrome.alarms.clear(REMINDER_ALARM);
  if (!preferences.reminderEnabled) return;
  await chrome.alarms.create(REMINDER_ALARM, {
    when: nextReminderTime(preferences.reminderTime)
  });
}

async function ensureReminder(): Promise<void> {
  const preferences = await loadPreferences();
  if (!preferences.reminderEnabled) return;
  const existing = await chrome.alarms.get(REMINDER_ALARM);
  if (!existing) await configureReminder();
}

async function initialize(): Promise<void> {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  const preferences = await loadPreferences();
  await savePreferences(preferences);
  await ensureReminder();
}

chrome.runtime.onInstalled.addListener(() => {
  void initialize();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureReminder();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== REMINDER_ALARM) return;
  void (async () => {
    try {
      await chrome.notifications.create(REMINDER_NOTIFICATION, {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon.svg"),
        title: "今日岗位匹配提醒",
        message: "打开已保存的搜索页，再由你主动扫描当前可见岗位。",
        priority: 1
      });
    } finally {
      await configureReminder();
    }
  })();
});

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId !== REMINDER_NOTIFICATION) return;
  void (async () => {
    const preferences = await loadPreferences();
    let url = preferences.dailyEntryUrl || DEFAULT_URL;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || (parsed.hostname !== "zhipin.com" && !parsed.hostname.endsWith(".zhipin.com"))) url = DEFAULT_URL;
    } catch {
      url = DEFAULT_URL;
    }
    await chrome.tabs.create({ url, active: true });
    await chrome.notifications.clear(REMINDER_NOTIFICATION);
  })();
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (typeof message !== "object" || message === null || !("type" in message)) return false;
  if ((message as { type: string }).type === "CONFIGURE_REMINDER") {
    void configureReminder()
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }
  return false;
});

void initialize();
