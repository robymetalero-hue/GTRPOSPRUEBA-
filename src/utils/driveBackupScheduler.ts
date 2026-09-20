import { backupDatabaseToDrive } from './driveBackup';

let autoBackupTimer: any = null;
let lastBackupDate: string | null = null;

export const startAutoBackupScheduler = (timeString: string = "23:00", onNotification: (msg: string, type: 'success'|'error'|'warn') => void) => {
    if (autoBackupTimer) {
        clearInterval(autoBackupTimer);
    }

    autoBackupTimer = setInterval(async () => {
        const now = new Date();
        const currentTime = now.toTimeString().substring(0, 5); // "HH:MM"
        const today = now.toISOString().split('T')[0];

        if (currentTime === timeString && lastBackupDate !== today) {
            onNotification(`Iniciando respaldo automático en Drive (${timeString})...`, 'warn');
            try {
                const success = await backupDatabaseToDrive();
                if (success) {
                    lastBackupDate = today;
                    onNotification(`✓ Respaldo automático subido a Google Drive.`, 'success');
                }
            } catch (err: any) {
                console.error("Auto backup failed:", err);
                onNotification(`Respaldo automático falló: ${err.message}. Verifica permisos de popup.`, 'error');
            }
        }
    }, 60000); // Check every minute
};
