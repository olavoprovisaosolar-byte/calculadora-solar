import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  applyBackupJson,
  CloudBackupFile,
  listCloudBackups,
  pickLocalBackup,
  readCloudBackup,
} from '../services/driveSync';
import { loadAppBackup } from '../services/appBackup';
import { backupHasUserData } from '../services/backupMerge';
import { folderContainsUserBackup } from '../services/rootFolder';
import { startupRestoreMode } from '../services/rootBackupPolicy';
import { useTheme } from '../theme/ThemeContext';
import { PrimaryButton } from './PrimaryButton';

export function RestoreBackupOffer() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [files, setFiles] = useState<CloudBackupFile[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<'local' | 'drive' | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const backup = await loadAppBackup();
      const folderBackupFound = await folderContainsUserBackup();
      if (cancelled) return;
      const mode = startupRestoreMode({
        activeHasData: backupHasUserData(backup),
        folderBackupFound,
      });
      setVisible(mode === 'reception');
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function finish(raw: string) {
    const restored = await applyBackupJson(raw);
    setNotice(`Backup restaurado. ${restored.surveys} cliente(s) no histórico.`);
    setFiles([]);
    setVisible(false);
  }

  async function fromCloud() {
    setBusy('drive');
    setNotice('');
    try {
      const found = await listCloudBackups();
      if (found.length === 0) {
        setNotice('Nenhum backup encontrado na pasta do Google Drive.');
        return;
      }
      setFiles(found);
      setVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível buscar o backup na nuvem.';
      if (message !== 'Vinculação cancelada.') setNotice(message);
    } finally {
      setBusy(null);
    }
  }

  async function fromLocal() {
    setBusy('local');
    setNotice('');
    try {
      await finish(await pickLocalBackup());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível ler o arquivo local.';
      if (message !== 'Restauração cancelada.') setNotice(message);
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return null;

  return (
    <>
      <Modal visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kicker, { color: colors.primary }]}>Calculadora Solar</Text>
            <Text style={[styles.title, { color: colors.text }]}>Nenhum backup encontrado</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              Não há banco ativo nem arquivo recente em Meus Documentos/Calculadora Solar/Backups. Escolha de onde restaurar.
            </Text>
            <PrimaryButton
              label="Procurar Backup em outra Pasta Local"
              onPress={() => void fromLocal()}
              loading={busy === 'local'}
              disabled={busy !== null}
            />
            <PrimaryButton
              label="Buscar / Restaurar Backup do Google Drive"
              onPress={() => void fromCloud()}
              loading={busy === 'drive'}
              disabled={busy !== null}
              variant="secondary"
              style={styles.gap}
            />
            <Pressable accessibilityRole="button" onPress={() => setVisible(false)} style={styles.continue}>
              <Text style={[styles.continueLabel, { color: colors.primary }]}>Continuar sem backup</Text>
            </Pressable>
            {notice ? <Text style={[styles.notice, { color: colors.text }]}>{notice}</Text> : null}
          </View>
        </View>
      </Modal>
      <Modal visible={files.length > 0} transparent animationType="fade" onRequestClose={() => {
        setFiles([]);
        setVisible(true);
      }}>
        <View style={styles.backdrop}>
          <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Escolha o backup na nuvem</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              Toque no arquivo para atualizar o banco de dados do aplicativo.
            </Text>
            {files.map((file) => (
              <Pressable
                key={file.id}
                accessibilityRole="button"
                onPress={() => void readCloudBackup(file).then(finish).catch((error: unknown) => {
                  const message = error instanceof Error ? error.message : 'Não foi possível ler esse backup.';
                  setNotice(message);
                })}
                style={[styles.file, { borderColor: colors.border }]}
              >
                <Text style={[styles.fileLabel, { color: colors.text }]}>{file.label}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setFiles([]);
                setVisible(true);
              }}
            >
              <Text style={[styles.continueLabel, { color: colors.primary }]}>Voltar</Text>
            </Pressable>
            {notice ? <Text style={[styles.notice, { color: colors.text }]}>{notice}</Text> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
  },
  kicker: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    lineHeight: 28,
  },
  message: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 16,
  },
  gap: { marginTop: 8 },
  continue: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  continueLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    textAlign: 'center',
  },
  notice: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  list: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
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
});
