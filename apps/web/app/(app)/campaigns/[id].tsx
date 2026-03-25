import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams, Link } from 'expo-router';
import { useQuery, useMutation } from '@apollo/client';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CAMPAIGN_QUERY, META_PAGES_QUERY } from '../../../src/graphql/queries';
import {
  DELETE_CAMPAIGN_MUTATION,
  LAUNCH_META_AD_MUTATION,
} from '../../../src/graphql/mutations';
import { Button, Card, Badge, Input } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { useIsMobile } from '../../../src/hooks/useIsMobile';
import { spacing, fontSize, radius, fonts } from '../../../src/theme';
import type { ColorPalette } from '../../../src/theme';
import type { Campaign, GeneratedAd } from '@toolkit/shared';

type Tab = 'ads' | 'campaign';

function AdVideoThumb({ videoUrl, fallback }: { videoUrl: string; fallback: React.ReactNode }) {
  const [errored, setErrored] = useState(false);
  if (errored) return <>{fallback}</>;
  return React.createElement('video', {
    src: videoUrl,
    muted: true,
    playsInline: true,
    loop: true,
    autoPlay: true,
    preload: 'metadata',
    onError: () => setErrored(true),
    style: {
      width: '100%',
      height: 160,
      objectFit: 'cover',
      display: 'block',
      pointerEvents: 'none',
    },
  });
}

const makeStyles = (colors: ColorPalette, isMobile: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgCard },
    container: {
      padding: isMobile ? spacing.md : spacing.xl,
      gap: spacing.lg,
      maxWidth: 900,
      width: '100%',
      alignSelf: 'center',
    },

    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    topLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.full,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleBlock: { flex: 1, gap: 2 },
    pageTitle: {
      fontFamily: fonts.extraBold,
      fontSize: isMobile ? fontSize.xl : fontSize.xxl,
      color: colors.textPrimary,
    },
    artistName: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
    },

    tabRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      paddingLeft: spacing.md,
      paddingRight: spacing.md,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      marginBottom: -1,
    },
    tabActive: { borderBottomColor: colors.primary },
    tabLabel: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
      color: colors.textMuted,
    },
    tabLabelActive: { color: colors.primary },

    // Ads grid
    adGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    adCard: {
      width: isMobile ? '100%' : ('47%' as any),
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
    },
    adThumb: {
      height: 160,
      backgroundColor: colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    adThumbVideo: {
      height: 160,
      width: '100%',
    },
    adBody: { padding: spacing.md, gap: spacing.xs },
    adLabel: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.textPrimary },
    adStyle: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
    adOverlay: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    adActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },

    // Campaign config
    campaignSection: { gap: spacing.md },
    sectionTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSize.lg,
      color: colors.textPrimary,
    },
    connectHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.bgElevated,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    connectHintText: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      flex: 1,
    },

    formRow: { flexDirection: isMobile ? 'column' : 'row', gap: spacing.md },
    formHalf: { flex: 1 },

    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.bgElevated,
      borderRadius: radius.lg,
    },
    statusLabel: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },

    dangerZone: { gap: spacing.sm },
    dangerTitle: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.xs,
      color: colors.error,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },

    emptyInner: {
      alignItems: 'center',
      gap: spacing.md,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xxl,
    },
    emptyIconBox: {
      width: 64,
      height: 64,
      borderRadius: radius.full,
      backgroundColor: colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.textPrimary },
    emptySubtext: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    muted: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
    errorText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.error },
    successText: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
      color: colors.success,
    },
  });

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'info' {
  if (status === 'LAUNCHED') return 'success';
  if (status === 'READY') return 'info';
  if (status === 'GENERATING') return 'warning';
  return 'default';
}

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const styles = useMemo(() => makeStyles(colors, isMobile), [colors, isMobile]);

  const [activeTab, setActiveTab] = useState<Tab>('ads');
  const [metaBudget, setMetaBudget] = useState('10');
  const [metaDuration, setMetaDuration] = useState('7');
  const [metaAudience, setMetaAudience] = useState('');
  const [metaMessage, setMetaMessage] = useState('');
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const { data, loading, error } = useQuery(CAMPAIGN_QUERY, { variables: { id }, skip: !id });
  const { data: pagesData } = useQuery(META_PAGES_QUERY);

  const [deleteCampaign, { loading: deleting }] = useMutation(DELETE_CAMPAIGN_MUTATION);
  const [launchMetaAd, { loading: launching }] = useMutation(LAUNCH_META_AD_MUTATION);

  const campaign: Campaign | undefined = data?.campaign;
  const ads: GeneratedAd[] = campaign?.generatedAds ?? [];
  const metaPages = pagesData?.metaPages ?? [];

  function handleDelete() {
    Alert.alert(
      t('campaigns.detail.deleteCampaign'),
      t('campaigns.detail.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteCampaign({ variables: { id } });
            router.replace('/(app)/campaigns');
          },
        },
      ]
    );
  }

  async function handleLaunchMeta() {
    if (!selectedAdId) return;
    const page = metaPages[0];
    if (!page) return;
    setLaunchError(null);
    try {
      await launchMetaAd({
        variables: {
          campaignId: id,
          adId: selectedAdId,
          pageId: page.id,
          instagramActorId: page.instagramActorId,
          campaignName: `${campaign?.trackTitle} — ${campaign?.artistName}`,
          dailyBudgetCents: Math.round(parseFloat(metaBudget || '10') * 100),
          durationDays: parseInt(metaDuration || '7', 10),
          message: metaMessage,
        },
      });
      setLaunched(true);
    } catch (e: any) {
      setLaunchError(e?.message ?? 'Failed to launch campaign');
    }
  }

  if (loading) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.container}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </ScrollView>
    );
  }

  if (error || !campaign) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.container}>
        <Text style={styles.errorText}>{t('campaigns.detail.notFound')}</Text>
      </ScrollView>
    );
  }

  return (
    <>
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/(app)/campaigns')} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.titleBlock}>
            <Text style={styles.pageTitle} numberOfLines={1}>{campaign.trackTitle}</Text>
            <Text style={styles.artistName}>{campaign.artistName}</Text>
          </View>
        </View>
        <Badge label={campaign.status} variant={statusVariant(campaign.status)} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['ads', 'campaign'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {t(`campaigns.detail.tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── ADS TAB ── */}
      {activeTab === 'ads' && (
        <>
          {ads.length === 0 ? (
            <View style={styles.emptyInner}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="film-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyText}>{t('campaigns.emptyTitle')}</Text>
              <Text style={styles.emptySubtext}>{t('campaigns.emptySubtitle')}</Text>
              <Button
                label={t('campaigns.createCampaign')}
                onPress={() => router.push('/(app)/campaigns/new')}
              />
            </View>
          ) : (
            <View style={styles.adGrid}>
              {ads.map((ad, i) => (
                <View key={ad.id} style={[styles.adCard, selectedAdId === ad.id && { borderColor: colors.primary }]}>
                  <TouchableOpacity onPress={() => setSelectedAdId(selectedAdId === ad.id ? null : ad.id)} activeOpacity={0.9}>
                    <View style={styles.adThumb}>
                      {ad.videoUrl ? (
                        <AdVideoThumb
                          videoUrl={ad.videoUrl}
                          fallback={<Ionicons name="film-outline" size={36} color={colors.primary} />}
                        />
                      ) : (
                        <Ionicons name="film-outline" size={36} color={colors.primary} />
                      )}
                    </View>
                  </TouchableOpacity>
                  <View style={styles.adBody}>
                    <Text style={styles.adLabel}>{t('campaigns.new.adVariant', { n: i + 1 })}</Text>
                    <Text style={styles.adStyle}>{ad.visualStyle}</Text>
                    {ad.textOverlay ? <Text style={styles.adOverlay}>"{ad.textOverlay}"</Text> : null}
                    <View style={styles.adActions}>
                      {ad.videoUrl ? (
                        <Button
                          label={t('campaigns.detail.download')}
                          size="sm"
                          variant="secondary"
                          onPress={() => typeof window !== 'undefined' && window.open(ad.videoUrl!, '_blank')}
                        />
                      ) : null}
                      {campaign.status !== 'LAUNCHED' && (
                        <Button
                          label="Éditer"
                          size="sm"
                          variant="ghost"
                          onPress={() => router.push({ pathname: '/(app)/campaigns/new', params: { editCampaignId: campaign.id } })}
                        />
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {ads.length > 0 && (
            <Button
              label="+ New Campaign"
              variant="secondary"
              onPress={() => router.push('/(app)/campaigns/new')}
            />
          )}
        </>
      )}

      {/* ── CAMPAIGN TAB ── */}
      {activeTab === 'campaign' && (
        <View style={styles.campaignSection}>
          <Text style={styles.sectionTitle}>{t('campaigns.detail.campaignSectionMeta')}</Text>

          {metaPages.length === 0 ? (
            <View style={styles.connectHint}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
              <Text style={styles.connectHintText}>{t('campaigns.detail.metaConnectHint')}</Text>
              <Link href="/(app)/settings" asChild>
                <TouchableOpacity>
                  <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.sm, color: colors.primary }}>
                    {t('campaigns.detail.goToSettings')}
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          ) : null}

          {ads.length > 0 && (
            <Card padding="md">
              <View style={{ gap: spacing.sm }}>
                <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.sm, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Select ad to launch
                </Text>
                {ads.map((ad, i) => (
                  <TouchableOpacity
                    key={ad.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: spacing.md,
                      borderRadius: radius.lg,
                      borderWidth: 1.5,
                      borderColor: selectedAdId === ad.id ? colors.primary : colors.border,
                      backgroundColor: selectedAdId === ad.id ? colors.primaryBg : colors.bgElevated,
                    }}
                    onPress={() => setSelectedAdId(selectedAdId === ad.id ? null : ad.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="film-outline" size={20} color={selectedAdId === ad.id ? colors.primary : colors.textMuted} />
                    <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.sm, color: colors.textPrimary, flex: 1 }}>
                      {t('campaigns.new.adVariant', { n: i + 1 })} · {ad.visualStyle}
                    </Text>
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selectedAdId === ad.id ? colors.primary : colors.border, backgroundColor: selectedAdId === ad.id ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {selectedAdId === ad.id && <Ionicons name="checkmark" size={12} color={colors.white} />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
          )}

          <View style={styles.formRow}>
            <View style={styles.formHalf}>
              <Input
                label={t('campaigns.detail.metaBudgetLabel')}
                value={metaBudget}
                onChangeText={setMetaBudget}
                placeholder={t('campaigns.detail.metaBudgetPlaceholder')}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.formHalf}>
              <Input
                label={t('campaigns.detail.metaDurationLabel')}
                value={metaDuration}
                onChangeText={setMetaDuration}
                placeholder={t('campaigns.detail.metaDurationPlaceholder')}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Input
            label={t('campaigns.detail.metaAudienceLabel')}
            value={metaAudience}
            onChangeText={setMetaAudience}
            placeholder={t('campaigns.detail.metaAudiencePlaceholder')}
          />

          <Input
            label={t('campaigns.detail.metaMessageLabel')}
            value={metaMessage}
            onChangeText={setMetaMessage}
            placeholder={t('campaigns.detail.metaMessagePlaceholder')}
            multiline
          />

          {launchError ? <Text style={styles.errorText}>{launchError}</Text> : null}
          {launched ? <Text style={styles.successText}>{t('campaigns.detail.metaLaunched')}</Text> : null}

          {!launched && (
            <Button
              label={launching ? t('campaigns.detail.metaLaunching') : t('campaigns.detail.metaLaunchBtn')}
              onPress={handleLaunchMeta}
              loading={launching}
              disabled={!selectedAdId || metaPages.length === 0}
            />
          )}

          <View style={styles.dangerZone}>
            <Text style={styles.dangerTitle}>{t('common.delete')}</Text>
            <Button
              label={t('campaigns.detail.deleteCampaign')}
              variant="danger"
              onPress={handleDelete}
              loading={deleting}
            />
          </View>
        </View>
      )}
    </ScrollView>

    </>
  );
}
