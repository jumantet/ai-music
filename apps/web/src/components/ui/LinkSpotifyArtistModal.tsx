import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useLazyQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SPOTIFY_SEARCH_ARTISTS_PUBLIC_QUERY } from '../../graphql/queries';
import { spacing, fontSize, radius, fonts } from '../../theme';
import type { ColorPalette } from '../../theme';

type ArtistRow = { id: string; name: string; imageUrl?: string | null };

export function LinkSpotifyArtistModal({
  visible,
  onClose,
  onSelectArtist,
  linking,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectArtist: (a: ArtistRow) => void;
  linking?: boolean;
  colors: ColorPalette;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ArtistRow[]>([]);
  const [searchError, setSearchError] = useState('');

  const [runSearch, { loading: searching }] = useLazyQuery(SPOTIFY_SEARCH_ARTISTS_PUBLIC_QUERY, {
    fetchPolicy: 'network-only',
  });

  useEffect(() => {
    if (!visible) return;
    setQ('');
    setResults([]);
    setSearchError('');
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const h = setTimeout(() => {
      setSearchError('');
      runSearch({ variables: { query } }).then((r) => {
        if (r.error) {
          setResults([]);
          setSearchError(
            r.error.networkError
              ? t('dashboard.catalogLinkSearchErrorNetwork')
              : t('dashboard.catalogLinkSearchError')
          );
          return;
        }
        setSearchError('');
        setResults(r.data?.spotifySearchArtistsPublic ?? []);
      });
    }, 420);
    return () => clearTimeout(h);
  }, [q, visible, runSearch, t]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.65)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.lg,
          }}
        >
          <TouchableWithoutFeedback>
            <View
              style={{
                backgroundColor: colors.bgCard,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                width: '100%',
                maxWidth: 400,
                maxHeight: '80%' as any,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing.md,
                  paddingTop: spacing.md,
                  paddingBottom: spacing.sm,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: fontSize.lg,
                    color: colors.textPrimary,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {t('dashboard.catalogModalTitle')}
                </Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm }}>
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder={t('dashboard.catalogSearchPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: fontSize.md,
                    color: colors.textPrimary,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                  }}
                />
                <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted }}>
                  {t('dashboard.catalogSearchHint')}
                </Text>
                {searchError ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.error }}>
                    {searchError}
                  </Text>
                ) : null}
                <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                  {searching ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.lg }} />
                  ) : !searchError && !searching && results.length === 0 && q.trim().length >= 2 ? (
                    <Text
                      style={{
                        fontFamily: fonts.regular,
                        fontSize: fontSize.sm,
                        color: colors.textMuted,
                        paddingVertical: spacing.md,
                      }}
                    >
                      {t('dashboard.catalogEmptyArtists')}
                    </Text>
                  ) : (
                    results.map((a) => (
                      <TouchableOpacity
                        key={a.id}
                        onPress={() => onSelectArtist(a)}
                        disabled={linking}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.sm,
                          paddingVertical: spacing.sm,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        }}
                      >
                        {a.imageUrl ? (
                          <Image source={{ uri: a.imageUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                        ) : (
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              backgroundColor: colors.bgElevated,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons name="person" size={22} color={colors.textMuted} />
                          </View>
                        )}
                        <Text
                          style={{
                            fontFamily: fonts.semiBold,
                            fontSize: fontSize.md,
                            color: colors.textPrimary,
                            flex: 1,
                          }}
                          numberOfLines={2}
                        >
                          {a.name}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
