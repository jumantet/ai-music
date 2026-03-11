import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@apollo/client';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  CREATE_RELEASE_MUTATION,
  GET_UPLOAD_URL_MUTATION,
  SET_RELEASE_COVER_MUTATION,
  SET_RELEASE_TRACK_MUTATION,
} from '../../../src/graphql/mutations';
import { ME_QUERY } from '../../../src/graphql/queries';
import { Button, Input, Card } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { spacing, fontSize, radius, fonts } from '../../../src/theme';
import type { ColorPalette } from '../../../src/theme';

type Step = 'info' | 'media' | 'done';

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    container: { padding: spacing.xl, gap: spacing.xl, maxWidth: 640, width: '100%', alignSelf: 'center' },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    backText: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: fontSize.md },
    title: { fontFamily: fonts.extraBold, fontSize: fontSize.xxxl, color: colors.textPrimary },
    steps: { flexDirection: 'row', gap: spacing.xl },
    stepIndicator: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    stepDot: {
      width: 28, height: 28, borderRadius: radius.full,
      backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    stepDotActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
    stepDotCompleted: { backgroundColor: colors.primary, borderColor: colors.primary },
    stepNum: { fontFamily: fonts.bold, fontSize: fontSize.xs, color: colors.textMuted },
    stepLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textSecondary },
    form: { gap: spacing.md },
    sectionTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.textPrimary },
    stepHint: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary },
    errorBox: {
      backgroundColor: colors.errorBg, borderRadius: radius.md,
      padding: spacing.md, borderWidth: 1, borderColor: colors.error,
    },
    errorText: { fontFamily: fonts.regular, color: colors.error, fontSize: fontSize.sm },
    row: { flexDirection: 'row', gap: spacing.md },
    flex: { flex: 1 },
    uploadBox: {
      borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
      borderRadius: radius.lg, padding: spacing.xl,
      alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgCard,
      width: 160, height: 160, alignSelf: 'center',
    },
    uploadBoxWide: { width: '100%', height: 120 },
    uploadLabel: { fontFamily: fonts.semiBold, fontSize: fontSize.md, color: colors.textPrimary, textAlign: 'center' },
    uploadHint: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
    coverPreview: { width: '100%', height: '100%', borderRadius: radius.md },
    uploadingText: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  });

export default function NewReleaseScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState<Step>('info');
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [genre, setGenre] = useState('');
  const [mood, setMood] = useState('');
  const [city, setCity] = useState('');
  const [influences, setInfluences] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [trackUri, setTrackUri] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);

  const [createRelease] = useMutation(CREATE_RELEASE_MUTATION, { refetchQueries: [ME_QUERY] });
  const [getUploadUrl] = useMutation(GET_UPLOAD_URL_MUTATION);
  const [setReleaseCover] = useMutation(SET_RELEASE_COVER_MUTATION);
  const [setReleaseTrack] = useMutation(SET_RELEASE_TRACK_MUTATION);

  async function handleCreateRelease() {
    if (!title || !artistName) { setError(t('releases.new.errorRequired')); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await createRelease({
        variables: { input: { title, artistName, genre: genre || undefined, mood: mood || undefined, city: city || undefined, influences: influences || undefined, shortBio: shortBio || undefined } },
      });
      setReleaseId(data.createRelease.id);
      setStep('media');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function pickAndUploadCover() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setCoverUri(asset.uri);
    if (!releaseId) return;
    setMediaLoading(true);
    try {
      const contentType = 'image/jpeg';
      const { data: urlData } = await getUploadUrl({ variables: { releaseId, fileType: 'cover', contentType } });
      const { uploadUrl, fileUrl } = urlData.getUploadUrl;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
      await setReleaseCover({ variables: { releaseId, fileUrl } });
    } catch (e) {
      console.error('Cover upload failed:', e);
    } finally {
      setMediaLoading(false);
    }
  }

  async function pickAndUploadTrack() {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !releaseId) return;
      setTrackUri(file.name);
      setMediaLoading(true);
      try {
        const { data: urlData } = await getUploadUrl({ variables: { releaseId, fileType: 'track', contentType: file.type || 'audio/mpeg' } });
        const { uploadUrl, fileUrl } = urlData.getUploadUrl;
        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        await setReleaseTrack({ variables: { releaseId, fileUrl } });
      } catch (e) {
        console.error('Track upload failed:', e);
      } finally {
        setMediaLoading(false);
      }
    };
    input.click();
  }

  function handleDone() {
    if (releaseId) router.replace(`/(app)/releases/${releaseId}` as any);
    else router.back();
  }

  const stepLabels: Record<Step, string> = {
    info: t('releases.new.stepDetails'),
    media: t('releases.new.stepMedia'),
    done: t('releases.new.stepDone'),
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        <Text style={styles.backText}>{t('releases.new.back')}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t('releases.new.title')}</Text>

      <View style={styles.steps}>
        {(['info', 'media', 'done'] as Step[]).map((s, i) => (
          <View key={s} style={styles.stepIndicator}>
            <View style={[
              styles.stepDot,
              step === s ? styles.stepDotActive : undefined,
              (step === 'media' && i === 0) || (step === 'done' && i <= 1) ? styles.stepDotCompleted : undefined,
            ]}>
              <Text style={styles.stepNum}>{i + 1}</Text>
            </View>
            <Text style={styles.stepLabel}>{stepLabels[s]}</Text>
          </View>
        ))}
      </View>

      {step === 'info' && (
        <Card padding="lg">
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>{t('releases.new.sectionDetails')}</Text>
            {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
            <Input label={t('releases.new.trackTitle')} value={title} onChangeText={setTitle} placeholder={t('releases.new.trackTitlePlaceholder')} />
            <Input label={t('releases.new.artistName')} value={artistName} onChangeText={setArtistName} placeholder={t('releases.new.artistNamePlaceholder')} />
            <View style={styles.row}>
              <View style={styles.flex}><Input label={t('releases.new.genre')} value={genre} onChangeText={setGenre} placeholder={t('releases.new.genrePlaceholder')} /></View>
              <View style={styles.flex}><Input label={t('releases.new.mood')} value={mood} onChangeText={setMood} placeholder={t('releases.new.moodPlaceholder')} /></View>
            </View>
            <Input label={t('releases.new.city')} value={city} onChangeText={setCity} placeholder={t('releases.new.cityPlaceholder')} />
            <Input label={t('releases.new.influences')} value={influences} onChangeText={setInfluences} placeholder={t('releases.new.influencesPlaceholder')} />
            <Input label={t('releases.new.bio')} value={shortBio} onChangeText={setShortBio} multiline numberOfLines={3} placeholder={t('releases.new.bioPlaceholder')} />
            <Button label={t('releases.new.continueBtn')} onPress={handleCreateRelease} loading={loading} fullWidth size="lg" />
          </View>
        </Card>
      )}

      {step === 'media' && (
        <Card padding="lg">
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>{t('releases.new.sectionMedia')}</Text>
            <Text style={styles.stepHint}>{t('releases.new.mediaHint')}</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={pickAndUploadCover} disabled={mediaLoading}>
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={styles.coverPreview} />
              ) : (
                <>
                  <Ionicons name="image-outline" size={36} color={colors.textMuted} />
                  <Text style={styles.uploadLabel}>{t('releases.new.uploadCoverLabel')}</Text>
                  <Text style={styles.uploadHint}>{t('releases.new.uploadCoverHint')}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.uploadBox, styles.uploadBoxWide]} onPress={pickAndUploadTrack} disabled={mediaLoading}>
              {trackUri ? (
                <>
                  <Ionicons name="checkmark-circle" size={36} color={colors.success} />
                  <Text style={styles.uploadLabel}>{trackUri}</Text>
                  <Text style={styles.uploadHint}>{t('releases.new.trackUploaded')}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="musical-note-outline" size={36} color={colors.textMuted} />
                  <Text style={styles.uploadLabel}>{t('releases.new.uploadTrackLabel')}</Text>
                  <Text style={styles.uploadHint}>{t('releases.new.uploadTrackHint')}</Text>
                </>
              )}
            </TouchableOpacity>
            {mediaLoading ? <Text style={styles.uploadingText}>{t('releases.new.uploading')}</Text> : null}
            <Button label={t('releases.new.continueRelease')} onPress={handleDone} fullWidth size="lg" />
            <Button label={t('releases.new.skip')} onPress={handleDone} variant="ghost" fullWidth />
          </View>
        </Card>
      )}
    </ScrollView>
  );
}
