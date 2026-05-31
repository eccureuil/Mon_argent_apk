import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart, PieChart, LineChart } from 'react-native-chart-kit';
import { useTheme } from '../../hooks/useTheme';
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
      ] = await Promise.all([
        rapport.getMonthlySummary(month, year),
        rapport.getWeeklyBreakdown(month, year),
        rapport.getCategorieBreakdown(month, year),
        rapport.getTopDepenses(month, year, 5),
        getSoldeByStockage(),
        rapport.getEpargneSummary(month, year),
        rapport.getEpargneEvolution(month, year),
        getSolde(),
      ]);

      setSummary(s);
      setWeeklyData(w);
      setCategorieData(c);
      setTopDepenses(t);
      setSoldeStockage(ss);
      setEpargneSummary(es);
      setEpargneEvolution(ee);
      setSoldeEpargne(se);
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

  const tauxEpargne =
    summary.total_entrees > 0
      ? ((summary.total_entrees - summary.total_sorties) / summary.total_entrees) * 100
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

  const patrimoineTotal = soldeStockage.total + soldeEpargne;
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
      <View style={{ paddingTop: insets.top + 8 }}>
        <MonthSelector
          month={month}
          year={year}
          onPrev={handlePrev}
          onNext={handleNext}
        />
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

        <View style={styles.statGrid}>
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
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Solde net</Text>
            <Text
              style={[
                styles.statValue,
                {
                  color:
                    summary.solde_net >= 0 ? colors.entree : colors.sortie,
                },
              ]}
            >
              {formatAr(summary.solde_net)}
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
              {tauxEpargne >= 0 ? '' : ''}
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
            backgroundGradientFrom: colors.card,
            backgroundGradientTo: colors.card,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            labelColor: () => colors.textSec,
            propsForBackgroundLines: { stroke: colors.border },
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
                color: () => colors.text,
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

        <View style={styles.statGrid}>
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
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Solde</Text>
            <Text
              style={[
                styles.statValue,
                { color: epargneSummary.solde_net >= 0 ? colors.epargne : colors.sortie },
              ]}
            >
              {formatAr(epargneSummary.solde_net)}
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
              backgroundGradientFrom: colors.card,
              backgroundGradientTo: colors.card,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
              labelColor: () => colors.textSec,
              propsForBackgroundLines: { stroke: colors.border },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: colors.epargne,
              },
            }}
            style={styles.chart}
            bezier
            fromZero
          />
        ) : (
          <EmptyState emoji="📈" message="Pas assez de données pour le graphique" />
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
              color: () => colors.text,
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

function createStyles(c: Record<string, any>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    scroll: {
      paddingBottom: 32,
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
