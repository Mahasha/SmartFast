/**
 * Expo config plugin: withFastingService
 *
 * Injects the AndroidManifest entries the native fasting foreground service
 * needs. Runs during `expo prebuild`, so the entries are re-applied on every
 * `--clean` regeneration (the generated android/ is disposable).
 *
 * Adds:
 *  - Foreground-service + notification + boot permissions.
 *  - The <service> typed `specialUse` (no Android 15 timeout — fasts run 12-48h)
 *    with the required PROPERTY_SPECIAL_USE_FGS_SUBTYPE justification.
 *  - The BOOT_COMPLETED <receiver> that re-hosts an active fast after reboot.
 *
 * The service/receiver classes are provided by the local module
 * (modules/fasting-service), package expo.modules.fastingservice.
 */

const { withAndroidManifest } = require('@expo/config-plugins');

const PACKAGE = 'expo.modules.fastingservice';
const SERVICE_NAME = `${PACKAGE}.FastingForegroundService`;
const RECEIVER_NAME = `${PACKAGE}.BootReceiver`;

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.WAKE_LOCK',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
];

const FGS_SUBTYPE =
  'Ongoing intermittent-fasting timer showing a live elapsed-time chronometer; ' +
  'must persist while the app is backgrounded or closed for the duration of a ' +
  'user-initiated fast.';

function ensurePermissions(manifest) {
  if (!Array.isArray(manifest['uses-permission'])) {
    manifest['uses-permission'] = [];
  }
  const list = manifest['uses-permission'];
  for (const name of PERMISSIONS) {
    const exists = list.some((p) => p.$ && p.$['android:name'] === name);
    if (!exists) {
      list.push({ $: { 'android:name': name } });
    }
  }
}

function ensureService(application) {
  if (!Array.isArray(application.service)) {
    application.service = [];
  }
  if (application.service.some((s) => s.$ && s.$['android:name'] === SERVICE_NAME)) {
    return;
  }
  application.service.push({
    $: {
      'android:name': SERVICE_NAME,
      'android:exported': 'false',
      'android:stopWithTask': 'false',
      'android:foregroundServiceType': 'specialUse',
    },
    property: [
      {
        $: {
          'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
          'android:value': FGS_SUBTYPE,
        },
      },
    ],
  });
}

function ensureReceiver(application) {
  if (!Array.isArray(application.receiver)) {
    application.receiver = [];
  }
  if (application.receiver.some((r) => r.$ && r.$['android:name'] === RECEIVER_NAME)) {
    return;
  }
  application.receiver.push({
    $: {
      'android:name': RECEIVER_NAME,
      'android:exported': 'true',
      'android:permission': 'android.permission.RECEIVE_BOOT_COMPLETED',
    },
    'intent-filter': [
      {
        action: [
          { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
          { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
        ],
      },
    ],
  });
}

module.exports = function withFastingService(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    ensurePermissions(manifest);

    const application =
      manifest.application && manifest.application[0] ? manifest.application[0] : null;
    if (application) {
      ensureService(application);
      ensureReceiver(application);
    }

    return cfg;
  });
};
