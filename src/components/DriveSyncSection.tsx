import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  applyBackupJson,
  CloudBackupFile,
  driveLinkStatus,
  linkDriveFolder,
  listCloudBackups,
  pickLocalBackup,
  readCloudBackup,
  saveCloudBackup,
  saveLocalBackup,
} from '../services/driveSync';
import { ROOT_BACKUP_DISPLAY, ROOT_BACKUP_FILE } from '../services/rootBackupPolicy';
import { useTheme } from '../theme/ThemeContext';
import { ActionDialog } from './ActionDialog';
import { PrimaryButton } from './PrimaryButton';

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function cancelled(error: unknown): boolean {
  const message = messageOf(error, '');
  return message === 'Vinculação cancelada.' || message === 'Restauração cancelada.' || message === 'Backup cancelado.';
}

export function DriveSyncSection() {
  const { colors } = useTheme();
  const [status, setStatus] = useState('Carregando vínculo com o Google Drive.');
  const [busy, setBusy] = useState<'link' | 'cloud' | 'local' | 'restore' | 'browse' | null>(null);
  const [notice, setNotice] = useState('');
  const [askRestore, setAskRestore] = useState(false);
  const [cloudFiles, setCloudFiles] = useState<CloudBackupFile[]>([]);

  async function refresh() {
    setStatus(await driveLinkStatus());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onLink() {
    setBusy('link');
    setNotice('');
    try {
      await linkDriveFolder();
      setNotice('Google Drive vinculado. Os próximos backups entram na pasta escolhida.');
      await refresh();
    } catch (error) {
      if (!cancelled(error)) setNotice(messageOf(error, 'Não foi possível vincular o Google Drive.'));
    } finally {
      setBusy(null);
    }
  }

  async function onCloud() {
    setBusy('cloud');
    setNotice('');
    try {
      const filename = await saveCloudBackup();
      setNotice(`Backup enviado para a pasta do Google Drive: ${filename}`);
      await refresh();
    } catch (error) {
      if (!cancelled(error)) setNotice(messageOf(error, 'Não foi possível fazer o backup na nuvem.'));
    } finally {
      setBusy(null);
    }
  }

  async function onLocal() {
    setBusy('local');
    setNotice('');
    try {
      const mode = await saveLocalBackup();
      setNotice(
        mode === 'downloaded'
          ? 'Backup local baixado. Guarde o arquivo JSON neste aparelho.'
          : 'Escolha onde guardar o arquivo JSON neste aparelho.',
      );
    } catch (error) {
      if (!cancelled(error)) setNotice(messageOf(error, 'Não foi possível fazer o backup local.'));
    } finally {
      setBusy(null);
    }
  }

  async function restoreRaw(raw: string) {
    const restored = await applyBackupJson(raw);
    setNotice(`Backup restaurado. ${restored.surveys} cliente(s) no histórico.`);
    setCloudFiles([]);
  }

  async function browseCloud(kind: 'restore' | 'browse') {
    setAskRestore(false);
    setBusy(kind);
    setNotice('');
    try {
      const files = await listCloudBackups();
      if (files.length === 0) {
        setNotice('Nenhum backup encontrado na pasta do Google Drive.');
        setCloudFiles([]);
        return;
      }
      setCloudFiles(files);
    } catch (error) {
      if (!cancelled(error)) setNotice(messageOf(error, 'Não foi possível buscar o backup na nuvem.'));
    } finally {
      setBusy(null);
    }
  }

  async function onLocalRestore() {
    setAskRestore(false);
    setBusy('restore');
    setNotice('');
    try {
      await restoreRaw(await pickLocalBackup());
    } catch (error) {
      if (!cancelled(error)) setNotice(messageOf(error, 'Não foi possível ler o backup local.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Google Drive</Text>
      <Text style={[styles.statusLabel, { color: colors.text }]}>Status da conexão</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{status}</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        O arquivo {ROOT_BACKUP_FILE} fica em {ROOT_BACKUP_DISPLAY}. A sincronização lê esse arquivo e envia a cópia para a pasta espelho no Google Drive.
      </Text>
      <PrimaryButton label="Vincular Google Drive" onPress={onLink} loading={busy === 'link'} disabled={busy !== null} />
      <PrimaryButton
        label="Sincronização com o Google Drive"
        onPress={onCloud}
        loading={busy === 'cloud'}
        disabled={busy !== null}
        variant="secondary"
        style={styles.gap}
      />
      <PrimaryButton
        label="Fazer Backup Local"
        onPress={onLocal}
        loading={busy === 'local'}
        disabled={busy !== null}
        variant="ghost"
        style={styles.gap}
      />
      <PrimaryButton
        label="Navegar / Restaurar do Google Drive"
        onPress={() => void browseCloud('browse')}
        loading={busy === 'browse'}
        disabled={busy !== null}
        variant="secondary"
        style={styles.gap}
      />
      <PrimaryButton
        label="Restaurar Backup"
        onPress={() => setAskRestore(true)}
        loading={busy === 'restore'}
        disabled={busy !== null}
        variant="ghost"
        style={styles.gap}
      />
      {cloudFiles.length > 0 ? (
        <Text style={[styles.body, { color: colors.textSecondary, marginTop: 12 }]}>
          Toque em um arquivo para atualizar o banco de dados do aplicativo.
        </Text>
      ) : null}
      {cloudFiles.map((file) => (
        <Pressable
          key={file.id}
          accessibilityRole="button"
          onPress={() => {
            setBusy('restore');
            void readCloudBackup(file)
              .then(restoreRaw)
              .catch((error) => setNotice(messageOf(error, 'Não foi possível ler esse backup.')))
              .finally(() => setBusy(null));
          }}
          style={[styles.file, { borderColor: colors.border }]}
        >
          <Text style={[styles.fileLabel, { color: colors.text }]}>{file.label}</Text>
        </Pressable>
      ))}
      {notice ? <Text style={[styles.notice, { color: colors.text }]}>{notice}</Text> : null}
      <ActionDialog
        visible={askRestore}
        title="Restaurar Backup"
        message="Buscar o backup na nuvem (Google Drive) ou carregar um arquivo local?"
        primary={{ label: 'Nuvem (Google Drive)', onPress: () => void browseCloud('restore') }}
        secondary={{ label: 'Arquivo local', onPress: () => void onLocalRestore() }}
        tertiary={{ label: 'Agora não', onPress: () => setAskRestore(false) }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    marginBottom: 8,
  },
  statusLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    marginBottom: 4,
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  gap: { marginTop: 8 },
  file: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  fileLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
  },
  notice: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
});
