import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { BarChart, PieChart, LineChart } from 'react-native-chart-kit';
import { useTheme } from '../../hooks/useTheme';
import type { ColorPalette } from '../../constants/colors';
import { useSession } from '../../hooks/useSession';
import { useCourant } from '../../hooks/useCourant';
import { useEpargne } from '../../hooks/useEpargne';
import { useRapport } from '../../hooks/useRapport';
import MonthSelector from '../../components/MonthSelector';
import EmptyState from '../../components/EmptyState';
import { formatAr } from '../../utils/format';
import {
  MonthlySummary,
  WeeklyBreakdown,
  CategorieBreakdown,
  EpargneEvolution,
  SoldeByStockage,
} from '../../types';
import { stockageLabels } from '../../constants/categories';

const screenWidth = Dimensions.get('window').width;

/** Rapport screen with monthly charts, stats and PDF export. */
export default function RapportScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useSession();
  const userId = user!.id;
  const insets = useSafeAreaInsets();
  const rapport = useRapport(userId);
  const { getSoldeByStockage } = useCourant(userId);
  const { getSolde } = useEpargne(userId);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [summary, setSummary] = useState<MonthlySummary>({
    total_entrees: 0,
    total_sorties: 0,
    solde_net: 0,
  });
  const [weeklyData, setWeeklyData] = useState<WeeklyBreakdown[]>([]);
  const [categorieData, setCategorieData] = useState<CategorieBreakdown[]>([]);
  const [topDepenses, setTopDepenses] = useState<
    { id: number; montant: number; description: string | null; categorie: string; date: string }[]
  >([]);
  const [soldeStockage, setSoldeStockage] = useState<SoldeByStockage>({
    espece: 0,
    mobile_money: 0,
    banque: 0,
    total: 0,
  });
  const [epargneSummary, setEpargneSummary] = useState<MonthlySummary>({
    total_entrees: 0,
    total_sorties: 0,
    solde_net: 0,
  });
  const [epargneEvolution, setEpargneEvolution] = useState<EpargneEvolution[]>([]);
  const [soldeEpargne, setSoldeEpargne] = useState(0);
  const [previousMonthSolde, setPreviousMonthSolde] = useState<{ courant: number; epargne: number }>({
    courant: 0,
    epargne: 0,
  });
  const [categorieSummary, setCategorieSummary] = useState<{
    entrees: { categorie: string; total: number; color: string }[];
    sorties: { categorie: string; total: number; color: string }[];
  }>({ entrees: [], sorties: [] });
  const [pdfLoading, setPdfLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [
        s,
        w,
        c,
        t,
        ss,
        es,
        ee,
        se,
        pm,
        cs,
      ] = await Promise.all([
        rapport.getMonthlySummary(month, year),
        rapport.getWeeklyBreakdown(month, year),
        rapport.getCategorieBreakdown(month, year),
        rapport.getTopDepenses(month, year, 5),
        getSoldeByStockage(),
        rapport.getEpargneSummary(month, year),
        rapport.getEpargneEvolution(month, year),
        getSolde(),
        rapport.getPreviousMonthSolde(month, year),
        rapport.getCategorieSummary(month, year),
      ]);

      setSummary(s);
      setWeeklyData(w);
      setCategorieData(c);
      setTopDepenses(t);
      setSoldeStockage(ss);
      setEpargneSummary(es);
      setEpargneEvolution(ee);
      setSoldeEpargne(se);
      setPreviousMonthSolde(pm);
      setCategorieSummary(cs);
    } catch (err) {
      console.error('Rapport load error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, month, year]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handlePrev = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNext = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const soldeCourantFinal = previousMonthSolde.courant + summary.solde_net;
  const soldeEpargneFinal = previousMonthSolde.epargne + epargneSummary.solde_net;
  const patrimoineTotal = soldeStockage.total + soldeEpargne;

  const generatePDF = useCallback(async () => {
    setPdfLoading(true);
    try {
      const moisNom = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
      ][month - 1];

      const catEntreeRows = categorieSummary.entrees
        .map((c) => `<tr><td>${c.categorie}</td><td style="text-align:right">${formatAr(c.total)}</td></tr>`)
        .join('');

      const catSortieRows = categorieSummary.sorties
        .map((c) => `<tr><td>${c.categorie}</td><td style="text-align:right">${formatAr(c.total)}</td></tr>`)
        .join('');

      const topRows = topDepenses
        .map(
          (d, i) =>
            `<tr><td>${i + 1}</td><td>${d.categorie}</td><td>${d.description ?? ''}</td><td style="text-align:right">${formatAr(d.montant)}</td></tr>`
        )
        .join('');

      const stockageRows = (['espece', 'mobile_money', 'banque'] as const)
        .map((s) => `<tr><td>${stockageLabels[s]}</td><td style="text-align:right">${formatAr(soldeStockage[s])}</td></tr>`)
        .join('');

      const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { font-family: 'IBM Plex Sans', Helvetica, Arial, sans-serif; font-size: 11px; color: #222; margin: 0; padding: 20px; }
  h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
  h2 { font-size: 14px; font-weight: 600; margin: 20px 0 8px; border-bottom: 2px solid #2563EB; padding-bottom: 4px; }
  h3 { font-size: 12px; font-weight: 600; margin: 14px 0 6px; }
  .subtitle { color: #666; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { text-align: left; font-size: 10px; font-weight: 600; color: #666; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #ddd; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
  .totals-grid { display: flex; gap: 8px; margin-bottom: 12px; }
  .total-card { flex: 1; padding: 10px; background: #f5f7fa; border-radius: 8px; text-align: center; }
  .total-card .label { font-size: 9px; color: #666; text-transform: uppercase; } 
  .total-card .value { font-size: 14px; font-weight: 700; margin-top: 2px; }
  .footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; }
  .positive { color: #16a34a; }
  .negative { color: #dc2626; }
  .neutral { color: #64748b; }
</style>
</head>
<body>
  <h1>Mon Argent</h1>
  <div class="subtitle">Relevé mensuel — ${moisNom} ${year}</div>

  <h2>Compte Courant</h2>
  <div class="totals-grid">
    <div class="total-card"><div class="label">Report</div><div class="value neutral">${formatAr(previousMonthSolde.courant)}</div></div>
    <div class="total-card"><div class="label">Entrées</div><div class="value positive">+${formatAr(summary.total_entrees)}</div></div>
    <div class="total-card"><div class="label">Sorties</div><div class="value negative">-${formatAr(summary.total_sorties)}</div></div>
    <div class="total-card"><div class="label">Solde final</div><div class="value ${soldeCourantFinal >= 0 ? 'positive' : 'negative'}">${formatAr(soldeCourantFinal)}</div></div>
  </div>

  ${catEntreeRows ? `
  <h3>Entrées par catégorie</h3>
  <table><thead><tr><th>Catégorie</th><th style="text-align:right">Montant</th></tr></thead><tbody>${catEntreeRows}</tbody></table>
  ` : ''}

  ${catSortieRows ? `
  <h3>Sorties par catégorie</h3>
  <table><thead><tr><th>Catégorie</th><th style="text-align:right">Montant</th></tr></thead><tbody>${catSortieRows}</tbody></table>
  ` : ''}

  ${topDepenses.length > 0 ? `
  <h3>Top ${topDepenses.length} dépenses</h3>
  <table><thead><tr><th>#</th><th>Catégorie</th><th>Description</th><th style="text-align:right">Montant</th></tr></thead><tbody>${topRows}</tbody></table>
  ` : ''}

  <h3>Solde par portefeuille</h3>
  <table><thead><tr><th>Portefeuille</th><th style="text-align:right">Solde</th></tr></thead><tbody>${stockageRows}</tbody></table>

  <h2>Compte Épargne</h2>
  <div class="totals-grid">
    <div class="total-card"><div class="label">Report</div><div class="value neutral">${formatAr(previousMonthSolde.epargne)}</div></div>
    <div class="total-card"><div class="label">Ajouté</div><div class="value positive">+${formatAr(epargneSummary.total_entrees)}</div></div>
    <div class="total-card"><div class="label">Retiré</div><div class="value negative">-${formatAr(epargneSummary.total_sorties)}</div></div>
    <div class="total-card"><div class="label">Solde final</div><div class="value ${soldeEpargneFinal >= 0 ? 'positive' : 'negative'}">${formatAr(soldeEpargneFinal)}</div></div>
  </div>

  <h2>Vue Globale</h2>
  <div class="totals-grid">
    <div class="total-card"><div class="label">Patrimoine total</div><div class="value">${formatAr(patrimoineTotal)}</div></div>
  </div>

  <div class="footer">Généré le ${new Date().toLocaleDateString('fr-FR')} · Mon Argent v1.0.1</div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, margins: { left: 16, top: 16, right: 16, bottom: 16 } });
      await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (err) {
      console.error('PDF generation error:', err);
      Alert.alert('Erreur', 'Impossible de générer le PDF.');
    } finally {
      setPdfLoading(false);
    }
  }, [
    month, year, summary, previousMonthSolde, soldeCourantFinal,
    soldeEpargneFinal, categorieSummary, topDepenses, soldeStockage,
    epargneSummary, patrimoineTotal,
  ]);

  const baseTaux = summary.total_entrees + previousMonthSolde.courant;
  const tauxEpargne =
    baseTaux > 0
      ? ((baseTaux - summary.total_sorties) / baseTaux) * 100
      : null;

  const barChartData = {
    labels:
      weeklyData.length > 0
        ? weeklyData.map((w) => `S${w.week}`)
        : ['S1', 'S2', 'S3', 'S4', 'S5'],
    datasets: [
      {
        data:
          weeklyData.length > 0
            ? weeklyData.map((w) => w.entrees)
            : [0, 0, 0, 0, 0],
        color: () => colors.entree,
      },
      {
        data:
          weeklyData.length > 0
            ? weeklyData.map((w) => w.sorties)
            : [0, 0, 0, 0, 0],
        color: () => colors.sortie,
      },
    ],
    legend: ['Entrées', 'Sorties'],
  };

  const pieData = categorieData.map((c) => ({
    name: c.categorie,
    amount: c.montant,
    color: c.color,
    legendFontColor: colors.textSec,
    legendFontSize: 12,
  }));

  const patrimoineData =
    patrimoineTotal > 0
      ? [
          {
            name: 'Courant',
            amount: soldeStockage.total,
            color: colors.primary,
            legendFontColor: colors.textSec,
            legendFontSize: 12,
          },
          {
            name: 'Épargne',
            amount: soldeEpargne,
            color: colors.epargne,
            legendFontColor: colors.textSec,
            legendFontSize: 12,
          },
        ]
      : [];

  const epargneLineData = {
    labels:
      epargneEvolution.length > 0
        ? epargneEvolution.map((e) => {
            const d = new Date(e.date);
            return String(d.getDate());
          })
        : [],
    datasets: [
      {
        data:
          epargneEvolution.length > 0
            ? epargneEvolution.map((e) => e.solde)
            : [0],
        color: () => colors.epargne,
        strokeWidth: 2,
      },
    ],
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <MonthSelector
            month={month}
            year={year}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        </View>
        <TouchableOpacity
          style={styles.pdfButton}
          onPress={generatePDF}
          disabled={pdfLoading}
          activeOpacity={0.7}
        >
          {pdfLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="document-text-outline" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 }]}
      >

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Compte Courant</Text>

        <View style={styles.statGrid2}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Report</Text>
            <Text style={[styles.statValue, { color: colors.textSec }]}>
              {formatAr(previousMonthSolde.courant)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Solde final</Text>
            <Text
              style={[
                styles.statValue,
                { color: soldeCourantFinal >= 0 ? colors.entree : colors.sortie },
              ]}
            >
              {formatAr(soldeCourantFinal)}
            </Text>
          </View>
        </View>
        <View style={styles.statGrid2}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Entrées</Text>
            <Text style={[styles.statValue, { color: colors.entree }]}>
              +{formatAr(summary.total_entrees)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Sorties</Text>
            <Text style={[styles.statValue, { color: colors.sortie }]}>
              -{formatAr(summary.total_sorties)}
            </Text>
          </View>
        </View>

        {tauxEpargne !== null && (
          <View style={styles.tauxCard}>
            <Text style={styles.tauxLabel}>Taux d'épargne possible</Text>
            <Text
              style={[
                styles.tauxValue,
                { color: tauxEpargne >= 0 ? colors.entree : colors.sortie },
              ]}
            >
              {tauxEpargne.toFixed(1)}%
            </Text>
          </View>
        )}

        <Text style={styles.chartTitle}>Entrées vs Sorties par semaine</Text>
        <BarChart
          data={barChartData}
          width={screenWidth - 48}
          height={200}
          yAxisLabel=""
          yAxisSuffix=""
          chartConfig={{
            backgroundColor: colors.card,
            backgroundGradientFrom: colors.surface,
            backgroundGradientTo: colors.card,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(${parseInt(colors.text.slice(1,3),16)}, ${parseInt(colors.text.slice(3,5),16)}, ${parseInt(colors.text.slice(5,7),16)}, ${opacity})`,
            labelColor: () => colors.textSec,
            propsForBackgroundLines: { stroke: colors.border, strokeWidth: 0.5 },
            propsForLabels: { fontSize: 11, fontWeight: '500' },
            barPercentage: 0.6,
          }}
          style={styles.chart}
          withCustomBarColorFromData
          flatColor
          fromZero
        />

        {pieData.length > 0 && (
          <>
            <Text style={styles.chartTitle}>Répartition des sorties par catégorie</Text>
            <PieChart
              data={pieData}
              width={screenWidth - 48}
              height={200}
              chartConfig={{
                backgroundColor: colors.card,
                backgroundGradientFrom: colors.surface,
                backgroundGradientTo: colors.card,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(${parseInt(colors.text.slice(1,3),16)}, ${parseInt(colors.text.slice(3,5),16)}, ${parseInt(colors.text.slice(5,7),16)}, ${opacity})`,
                labelColor: () => colors.textSec,
              }}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="15"
              style={styles.chart}
            />
          </>
        )}

        <Text style={styles.chartTitle}>Solde par portefeuille</Text>
        <View style={styles.stockageTable}>
          {(['espece', 'mobile_money', 'banque'] as const).map((s) => (
            <View key={s} style={styles.stockageRow}>
              <View
                style={[
                  styles.stockageDot,
                  {
                    backgroundColor: (colors.stockages as Record<string, string>)[s],
                  },
                ]}
              />
              <Text style={styles.stockageLabel}>
                {stockageLabels[s]}
              </Text>
              <Text
                style={[
                  styles.stockageMontant,
                  soldeStockage[s] < 0 && { color: colors.sortie },
                ]}
              >
                {formatAr(soldeStockage[s])}
              </Text>
            </View>
          ))}
        </View>

        {topDepenses.length > 0 && (
          <>
            <Text style={styles.chartTitle}>Top 5 dépenses</Text>
            {topDepenses.map((d, i) => (
              <View key={d.id} style={styles.topDepense}>
                <View style={styles.topDepenseLeft}>
                  <View style={styles.topDepenseRank}>
                    <Text style={styles.topDepenseRankText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topDepenseCategorie}>{d.categorie}</Text>
                    {d.description ? (
                      <Text style={styles.topDepenseDesc} numberOfLines={1}>
                        {d.description}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.topDepenseMontant}>
                  {formatAr(d.montant)}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Compte Épargne</Text>

        <View style={styles.statGrid2}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Report</Text>
            <Text style={[styles.statValue, { color: colors.textSec }]}>
              {formatAr(previousMonthSolde.epargne)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Solde final</Text>
            <Text
              style={[
                styles.statValue,
                { color: soldeEpargneFinal >= 0 ? colors.epargne : colors.sortie },
              ]}
            >
              {formatAr(soldeEpargneFinal)}
            </Text>
          </View>
        </View>
        <View style={styles.statGrid2}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Ajouté</Text>
            <Text style={[styles.statValue, { color: colors.epargne }]}>
              +{formatAr(epargneSummary.total_entrees)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Retiré</Text>
            <Text style={[styles.statValue, { color: colors.warning }]}>
              -{formatAr(epargneSummary.total_sorties)}
            </Text>
          </View>
        </View>

        <Text style={styles.chartTitle}>Évolution du solde</Text>
        {epargneEvolution.length > 1 ? (
          <LineChart
            data={epargneLineData}
            width={screenWidth - 48}
            height={200}
            chartConfig={{
              backgroundColor: colors.card,
              backgroundGradientFrom: colors.surface,
              backgroundGradientTo: colors.card,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(${parseInt(colors.text.slice(1,3),16)}, ${parseInt(colors.text.slice(3,5),16)}, ${parseInt(colors.text.slice(5,7),16)}, ${opacity})`,
              labelColor: () => colors.textSec,
              propsForBackgroundLines: { stroke: colors.border, strokeWidth: 0.5 },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: colors.epargne,
              },
              propsForLabels: { fontSize: 11, fontWeight: '500' },
              fillShadowGradientFrom: colors.epargne,
              fillShadowGradientFromOpacity: 0.4,
              fillShadowGradientTo: colors.epargne,
              fillShadowGradientToOpacity: 0.05,
            }}
            style={styles.chart}
            bezier
            fromZero
          />
        ) : (
          <EmptyState iconName="trending-up-outline" message="Pas assez de données pour le graphique" />
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vue Globale</Text>

        <View style={styles.patrimoineCard}>
          <Text style={styles.patrimoineLabel}>Patrimoine total</Text>
          <Text style={styles.patrimoineValue}>{formatAr(patrimoineTotal)}</Text>
        </View>

          {patrimoineTotal > 0 && (
          <PieChart
            data={patrimoineData}
            width={screenWidth - 48}
            height={200}
            chartConfig={{
              backgroundColor: colors.card,
              backgroundGradientFrom: colors.surface,
              backgroundGradientTo: colors.card,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(${parseInt(colors.text.slice(1,3),16)}, ${parseInt(colors.text.slice(3,5),16)}, ${parseInt(colors.text.slice(5,7),16)}, ${opacity})`,
              labelColor: () => colors.textSec,
            }}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="15"
            style={styles.chart}
          />
        )}
      </View>
    </ScrollView>
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    scroll: {
      paddingBottom: 32,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    pdfButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    section: {
      paddingHorizontal: 16,
      marginTop: 8,
    },
    sectionTitle: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 12,
    },
    statGrid: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    statGrid2: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    statCard: {
      flex: 1,
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
    },
    statLabel: {
      color: c.textSec,
      fontSize: 11,
      fontWeight: '500',
      marginBottom: 4,
    },
    statValue: {
      fontSize: 14,
      fontWeight: '700',
    },
    tauxCard: {
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    tauxLabel: {
      color: c.textSec,
      fontSize: 14,
    },
    tauxValue: {
      fontSize: 22,
      fontWeight: '800',
    },
    chartTitle: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
      marginTop: 8,
    },
    chart: {
      borderRadius: 10,
      marginBottom: 16,
    },
    stockageTable: {
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    stockageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    stockageDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 10,
    },
    stockageLabel: {
      color: c.text,
      fontSize: 14,
      flex: 1,
    },
    stockageMontant: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
    },
    topDepense: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.card,
      borderRadius: 8,
      padding: 12,
      marginBottom: 6,
    },
    topDepenseLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    topDepenseRank: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    topDepenseRankText: {
      color: c.textSec,
      fontSize: 12,
      fontWeight: '700',
    },
    topDepenseCategorie: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
    },
    topDepenseDesc: {
      color: c.textSec,
      fontSize: 12,
      marginTop: 1,
    },
    topDepenseMontant: {
      color: c.sortie,
      fontSize: 14,
      fontWeight: '700',
    },
    divider: {
      height: 1,
      backgroundColor: c.border,
      marginVertical: 20,
      marginHorizontal: 16,
    },
    patrimoineCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    patrimoineLabel: {
      color: c.textSec,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    patrimoineValue: {
      color: c.text,
      fontSize: 32,
      fontWeight: '800',
      marginTop: 4,
    },
  });
}
