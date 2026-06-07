import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getDb } from '../database/db';
import { formatAr } from '../utils/format';

let soundEnabled = true;
const MIN_NOTIFICATION_INTERVAL_SECONDS = 60;

/** Enable or disable notification sounds. */
export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: soundEnabled,
    shouldSetBadge: false,
  }),
});

/** Request notification permissions from the user (Android channel setup included). */
export async function requestPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return false;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }
    return true;
  } catch {
    return false;
  }
}

/** Cancel all pending scheduled notifications. */
export async function cancelAllScheduled(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Schedule a daily notification at the given hour/minute with a month-to-date summary. */
export async function scheduleDailySummary(
  userId: number,
  hour: number,
  minute: number
): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const db = await getDb();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    const entrees = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
       WHERE user_id = ? AND type = 'entree' AND strftime('%Y-%m', date) = ?`,
      userId,
      monthStr
    );

    const sorties = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
       WHERE user_id = ? AND type = 'sortie' AND strftime('%Y-%m', date) = ?`,
      userId,
      monthStr
    );

    const solde = (entrees?.total ?? 0) - (sorties?.total ?? 0);

    const totalEntrees = entrees?.total ?? 0;
    const totalSorties = sorties?.total ?? 0;

    const body = `Entrées aujourd'hui : +${formatAr(totalEntrees)} | Sorties : -${formatAr(totalSorties)} | Solde du mois : ${formatAr(solde)}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 Résumé Coco du jour',
        body,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch (err) {
    console.error('scheduleDailySummary error:', err);
  }
}

/** Send an alert for every unpaid bill past its due date (marks notif_state = 2). */
export async function checkOverdueBills(userId: number): Promise<void> {
  try {
    const db = await getDb();
    const overdueBills = await db.getAllAsync<{
      id: number;
      titre: string;
      montant: number;
      date_echeance: string;
    }>(
      `SELECT id, titre, montant, date_echeance FROM factures
       WHERE user_id = ? AND payee = 0 AND date_echeance < datetime('now') AND notif_state = 0`,
      userId
    );

    for (const bill of overdueBills) {
      const dueDate = new Date(bill.date_echeance);
      const daysLate = Math.floor(
        (Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Facture en retard !',
          body: `${bill.titre} — ${formatAr(bill.montant)} est en retard depuis ${daysLate} jours`,
        },
        trigger: null,
      });

      await db.runAsync(
        'UPDATE factures SET notif_state = 2 WHERE id = ?',
        bill.id
      );
    }
  } catch (err) {
    console.error('checkOverdueBills error:', err);
  }
}

/** Send an alert for bills due in exactly `joursAvant` days (notif_state = 0 only). */
export async function checkUpcomingDueBills(
  userId: number,
  joursAvant: number
): Promise<void> {
  try {
    const db = await getDb();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + joursAvant);
    const targetStr = targetDate.toISOString().slice(0, 10);

    const upcoming = await db.getAllAsync<{
      id: number;
      titre: string;
      montant: number;
      date_echeance: string;
    }>(
      `SELECT id, titre, montant, date_echeance FROM factures
       WHERE user_id = ? AND payee = 0 AND date_echeance = ? AND notif_state = 0`,
      userId,
      targetStr
    );

    for (const bill of upcoming) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📄 Facture à venir',
          body: `${bill.titre} — ${formatAr(bill.montant)} arrive à échéance dans ${joursAvant} jour${joursAvant > 1 ? 's' : ''}`,
          data: { factureId: bill.id },
        },
        trigger: null,
      });
    }
  } catch (err) {
    console.error('checkUpcomingDueBills error:', err);
  }
}

/** Schedule a one-time notification for a bill on its due date. */
export async function scheduleBillDueNotification(
  billId: number,
  titre: string,
  montant: number,
  dateEcheance: string
): Promise<void> {
  try {
    const triggerDate = new Date(dateEcheance);
    if (isNaN(triggerDate.getTime())) return;

    const now = Date.now();
    const diff = triggerDate.getTime() - now;
    if (diff <= 0) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📄 Facture à payer',
        body: `${titre} — ${formatAr(montant)} arrive à échéance aujourd'hui`,
        data: { factureId: billId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(MIN_NOTIFICATION_INTERVAL_SECONDS, Math.floor(diff / 1000)),
        repeats: false,
      },
    });
  } catch (err) {
    console.error('scheduleBillDueNotification error:', err);
  }
}
