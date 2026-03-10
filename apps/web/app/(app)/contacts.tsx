import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useQuery, useMutation } from '@apollo/client';
import { Ionicons } from '@expo/vector-icons';
import { CONTACTS_QUERY } from '../../src/graphql/queries';
import {
  CREATE_CONTACT_MUTATION,
  UPDATE_CONTACT_MUTATION,
  DELETE_CONTACT_MUTATION,
} from '../../src/graphql/mutations';
import { Button, Card, Badge, Input } from '../../src/components/ui';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, fontSize, radius, fonts } from '../../src/theme';
import type { ColorPalette } from '../../src/theme';
import type { Contact, ContactType } from '@toolkit/shared';

const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  BLOG: 'Blog',
  RADIO: 'Radio',
  PLAYLIST: 'Playlist',
  JOURNALIST: 'Journalist',
};

const TYPE_BADGE_VARIANT: Record<ContactType, 'info' | 'warning' | 'success' | 'default'> = {
  BLOG: 'info',
  RADIO: 'warning',
  PLAYLIST: 'success',
  JOURNALIST: 'default',
};

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    container: { padding: spacing.xl, gap: spacing.xl },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    titleAccent: { width: 4, height: 28, borderRadius: 2, backgroundColor: colors.primary },
    title: { fontFamily: fonts.extraBold, fontSize: fontSize.xxxl, color: colors.textPrimary },
    filters: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    filterChip: {
      paddingLeft: spacing.md, paddingRight: spacing.md,
      paddingTop: spacing.xs + 2, paddingBottom: spacing.xs + 2,
      borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.bgCard,
    },
    filterChipActive: { backgroundColor: colors.primaryBg, borderColor: colors.primary },
    filterText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textSecondary },
    filterTextActive: { color: colors.primary, fontFamily: fonts.semiBold },
    muted: { color: colors.textMuted, fontFamily: fonts.regular },
    emptyInner: { alignItems: 'center', gap: spacing.sm },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.textPrimary },
    emptySubtitle: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
    contactList: { gap: spacing.md },
    contactRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    avatar: {
      width: 40, height: 40, borderRadius: radius.full,
      backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    avatarText: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.textSecondary },
    contactInfo: { flex: 1, gap: 4 },
    contactName: { fontFamily: fonts.semiBold, fontSize: fontSize.md, color: colors.textPrimary },
    contactEmail: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary },
    contactWebsite: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
    contactActions: { flexDirection: 'row', gap: spacing.xs },
    iconBtn: { padding: spacing.xs },
    contactNotes: {
      fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted,
      marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
    },
    // modal
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    sheet: {
      backgroundColor: colors.bgCard, borderRadius: radius.xl,
      width: '100%', maxWidth: 480, borderWidth: 1, borderColor: colors.border, maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    modalTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.textPrimary },
    form: { padding: spacing.lg, gap: spacing.md },
    typeLabel: { fontFamily: fonts.semiBold, fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
    typeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    typeChip: {
      paddingLeft: spacing.md, paddingRight: spacing.md,
      paddingTop: spacing.xs + 2, paddingBottom: spacing.xs + 2,
      borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard,
    },
    typeChipActive: { backgroundColor: colors.primaryBg, borderColor: colors.primary },
    typeChipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textSecondary },
    typeChipTextActive: { color: colors.primary, fontFamily: fonts.semiBold },
  });

function ContactFormModal({
  visible, contact, onClose, onSaved, colors, styles,
}: {
  visible: boolean;
  contact: Contact | null;
  onClose: () => void;
  onSaved: () => void;
  colors: ColorPalette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [name, setName] = useState(contact?.name ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [type, setType] = useState<ContactType>(contact?.type ?? 'BLOG');
  const [website, setWebsite] = useState(contact?.website ?? '');
  const [notes, setNotes] = useState(contact?.notes ?? '');
  const [loading, setLoading] = useState(false);

  const [createContact] = useMutation(CREATE_CONTACT_MUTATION, { refetchQueries: [CONTACTS_QUERY] });
  const [updateContact] = useMutation(UPDATE_CONTACT_MUTATION, { refetchQueries: [CONTACTS_QUERY] });

  React.useEffect(() => {
    setName(contact?.name ?? '');
    setEmail(contact?.email ?? '');
    setType(contact?.type ?? 'BLOG');
    setWebsite(contact?.website ?? '');
    setNotes(contact?.notes ?? '');
  }, [contact]);

  async function handleSave() {
    if (!name || !email) return;
    setLoading(true);
    try {
      if (contact) {
        await updateContact({ variables: { id: contact.id, input: { name, email, type, website: website || undefined, notes: notes || undefined } } });
      } else {
        await createContact({ variables: { input: { name, email, type, website: website || undefined, notes: notes || undefined } } });
      }
      onSaved();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{contact ? 'Edit Contact' : 'Add Contact'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <View style={styles.form}>
              <Input label="Name *" value={name} onChangeText={setName} placeholder="Pitchfork Editorial" />
              <Input label="Email *" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="contact@pitchfork.com" />
              <View>
                <Text style={styles.typeLabel}>Type</Text>
                <View style={styles.typeRow}>
                  {(['BLOG', 'RADIO', 'PLAYLIST', 'JOURNALIST'] as ContactType[]).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, type === t ? styles.typeChipActive : undefined]}
                      onPress={() => setType(t)}
                    >
                      <Text style={[styles.typeChipText, type === t ? styles.typeChipTextActive : undefined]}>
                        {CONTACT_TYPE_LABELS[t]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <Input label="Website" value={website} onChangeText={setWebsite} placeholder="https://pitchfork.com" />
              <Input label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={3} placeholder="Covers indie rock, psych..." />
              <Button label={contact ? 'Save Changes' : 'Add Contact'} onPress={handleSave} loading={loading} fullWidth />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ContactsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, loading, refetch } = useQuery(CONTACTS_QUERY);
  const [deleteContact] = useMutation(DELETE_CONTACT_MUTATION, { refetchQueries: [CONTACTS_QUERY] });
  const [filterType, setFilterType] = useState<ContactType | 'ALL'>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const contacts: Contact[] = data?.contacts ?? [];
  const filtered = filterType === 'ALL' ? contacts : contacts.filter((c) => c.type === filterType);

  async function handleDelete(id: string) {
    if (!confirm('Delete this contact?')) return;
    await deleteContact({ variables: { id } });
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Contacts</Text>
        <Button label="Add Contact" onPress={() => { setEditingContact(null); setShowForm(true); }} />
      </View>

      <View style={styles.filters}>
        {(['ALL', 'BLOG', 'RADIO', 'PLAYLIST', 'JOURNALIST'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterChip, filterType === type ? styles.filterChipActive : undefined]}
            onPress={() => setFilterType(type)}
          >
            <Text style={[styles.filterText, filterType === type ? styles.filterTextActive : undefined]}>
              {type === 'ALL' ? 'All' : CONTACT_TYPE_LABELS[type]}
              {type !== 'ALL' ? ` (${contacts.filter((c) => c.type === type).length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <Text style={styles.muted}>Loading...</Text> : null}

      {!loading && filtered.length === 0 ? (
        <Card padding="xl">
          <View style={styles.emptyInner}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No contacts yet</Text>
            <Text style={styles.emptySubtitle}>Add blogs, radio stations, and playlist curators you want to reach out to</Text>
            <Button label="Add first contact" onPress={() => setShowForm(true)} style={{ marginTop: spacing.md }} />
          </View>
        </Card>
      ) : null}

      <View style={styles.contactList}>
        {filtered.map((contact) => (
          <Card key={contact.id} padding="md">
            <View style={styles.contactRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{contact.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactEmail}>{contact.email}</Text>
                {contact.website ? <Text style={styles.contactWebsite} numberOfLines={1}>{contact.website}</Text> : null}
                <Badge label={CONTACT_TYPE_LABELS[contact.type]} variant={TYPE_BADGE_VARIANT[contact.type]} />
              </View>
              <View style={styles.contactActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => { setEditingContact(contact); setShowForm(true); }}>
                  <Ionicons name="pencil" size={16} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(contact.id)}>
                  <Ionicons name="trash" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
            {contact.notes ? <Text style={styles.contactNotes} numberOfLines={2}>{contact.notes}</Text> : null}
          </Card>
        ))}
      </View>

      <ContactFormModal
        visible={showForm}
        contact={editingContact}
        onClose={() => { setShowForm(false); setEditingContact(null); }}
        onSaved={refetch}
        colors={colors}
        styles={styles}
      />
    </ScrollView>
  );
}
