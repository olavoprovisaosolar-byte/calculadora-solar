const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const FULL_BACKUP = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
    <exclude domain="sharedpref" path="SecureStore.xml"/>
</full-backup-content>
`;

const EXTRACTION = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="sharedpref" path="SecureStore.xml"/>
    </cloud-backup>
    <device-transfer>
        <exclude domain="sharedpref" path="SecureStore.xml"/>
    </device-transfer>
</data-extraction-rules>
`;

function withManifestFlags(config) {
  return withAndroidManifest(config, (next) => {
    const app = next.modResults.manifest.application?.[0];
    if (app?.$) {
      app.$['android:allowBackup'] = 'true';
      app.$['android:requestLegacyExternalStorage'] = 'true';
      app.$['android:hasFragileUserData'] = 'true';
      app.$['android:fullBackupContent'] = '@xml/solar_backup_rules';
      app.$['android:dataExtractionRules'] = '@xml/solar_data_extraction_rules';
    }
    return next;
  });
}

function withBackupXml(config) {
  return withDangerousMod(config, [
    'android',
    (next) => {
      const dir = path.join(next.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'solar_backup_rules.xml'), FULL_BACKUP);
      fs.writeFileSync(path.join(dir, 'solar_data_extraction_rules.xml'), EXTRACTION);
      return next;
    },
  ]);
}

module.exports = function withDurableBackup(config) {
  return withBackupXml(withManifestFlags(config));
};
