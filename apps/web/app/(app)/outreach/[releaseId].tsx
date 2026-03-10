import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation } from '@apollo/client';
import { Ionicons } from '@expo/vector-icons';
import { OUTREACH_QUERY, CONTACTS_QUERY, RELEASE_QUERY } from '../../../src/graphql/queries';
import {
  GENERATE_OUTREACH_EMAIL_MUTATION,
  CREATE_OUTREACH_MUTATION,
  UPDATE_OUTREACH_STATUS_MUTATION,
  SEND_OUTREACH_EMAIL_MUTATION,
  DELETE_OUTREACH_MUTATION,
} from '../../../src/graphql/mutations';
import { Button, Card, OutreachStatusBadge, Input } from '../../../src/components/ui';
import { colors, spacing, fontSize, radius } from '../../../src/theme';
import type { Contact, ContactType, Outreach, OutreachStatus } from '@toolkit/shared';

const STATUS_OPTIONS: OutreachStatus[] = ['NOT_CONTACTED', 'SENT', 'REPLIED', 'FEATURED'];
const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  BLOG: 'Blog',
  RADIO: 'Radio',
  PLAYLIST: 'Playlist',
  JOURNALIST: 'Journalist',
};

export default function OutreachScreen() {
  const { releaseId } = useLocalSearchParams<{ releaseId: string }>();
  const [showGenerator, setShowGenerator] = useState(false);
  const [showAssigner, setShowAssigner] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<{ subject: string; body: string } | null>(null);

  const { data: outreachData, refetch } = useQuery(OUTREACH_QUERY, {
    variables: { releaseId },
    skip: !releaseId,
  });
  const { data: releaseData } = useQuery(RELEASE_QUERY, { variables: { id: releaseId }, skip: !releaseId });
  const { data: contactsData } = useQuery(CONTACTS_QUERY);

  const [updateStatus] = useMutation(UPDATE_OUTREACH_STATUS_MUTATION);
  const [sendEmail] = useMutation(SEND_OUTREACH_EMAIL_MUTATION);
  const [deleteOutreach] = useMutation(DELETE_OUTREACH_MUTATION);

  const outreaches: Outreach[] = outreachData?.outreach ?? [];
  const contacts: Contact[] = contactsData?.contacts ?? [];
  const release = releaseData?.release;

  async function handleStatusChange(id: string, status: OutreachStatus) {
    await updateStatus({ variables: { id, status } });
    refetch();
  }

  async function handleSend(id: string) {
    try {
      await sendEmail({ variables: { id } });
      refetch();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this outreach?')) return;
    await deleteOutreach({ variables: { id } });
    refetch();
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        <Text style={styles.backText}>Release</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Outreach</Text>
          {release && (
            <Text style={styles.subtitle}>
              {release.artistName} — {release.title}
            </Text>
          )}
        </View>
        <Button label="Generate Email" onPress={() => setShowGenerator(true)} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {STATUS_OPTIONS.map((status) => {
          const count = outreaches.filter((o) => o.status === status).length;
          const colors_map: Record<OutreachStatus, string> = {
            NOT_CONTACTED: colors.textMuted,
            SENT: colors.info,
            REPLIED: colors.warning,
            FEATURED: colors.success,
          };
          return (
            <Card key={status} padding="md" style={styles.statCard}>
              <Text style={[styles.statCount, { color: colors_map[status] }]}>{count}</Text>
              <Text style={styles.statLabel}>{status.replace('_', ' ')}</Text>
            </Card>
          );
        })}
      </View>

      {outreaches.length === 0 && (
        <Card padding="xl" style={styles.emptyCard}>
          <View style={styles.emptyInner}>
            <Text style={styles.emptyEmoji}>✉️</Text>
            <Text style={styles.emptyTitle}>No outreach yet</Text>
            <Text style={styles.emptySubtitle}>
              Generate AI-written emails for blogs, radio stations, and playlist curators
            </Text>
            <Button label="Generate first email" onPress={() => setShowGenerator(true)} style={{ marginTop: spacing.md }} />
          </View>
        </Card>
      )}

      <View style={styles.outreachList}>
        {outreaches.map((item) => (
          <OutreachCard
            key={item.id}
            outreach={item}
            onStatusChange={handleStatusChange}
            onSend={handleSend}
            onDelete={handleDelete}
          />
        ))}
      </View>

      {releaseId && (
        <>
          <GenerateEmailModal
            visible={showGenerator}
            releaseId={releaseId}
            onClose={() => setShowGenerator(false)}
            onGenerated={(email) => {
              setGeneratedEmail(email);
              setShowGenerator(false);
              setShowAssigner(true);
            }}
          />
          <AssignContactModal
            visible={showAssigner}
            contacts={contacts}
            releaseId={releaseId}
            generatedEmail={generatedEmail}
            onClose={() => { setShowAssigner(false); setGeneratedEmail(null); }}
            onSaved={() => { setShowAssigner(false); setGeneratedEmail(null); refetch(); }}
          />
        </>
      )}
    </ScrollView>
  );
}

function OutreachCard({
  outreach,
  onStatusChange,
  onSend,
  onDelete,
}: {
  outreach: Outreach;
  onStatusChange: (id: string, status: OutreachStatus) => void;
  onSend: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card padding="md" style={styles.outreachCard}>
      <TouchableOpacity onPress={() => setExpanded((x) => !x)}>
        <View style={styles.outreachHeader}>
          <View style={styles.outreachMeta}>
            {outreach.contact ? (
              <Text style={styles.contactName}>{outreach.contact.name}</Text>
            ) : (
              <Text style={styles.contactName}>No contact linked</Text>
            )}
            <Text style={styles.outreachSubject} numberOfLines={1}>{outreach.subject}</Text>
          </View>
          <View style={styles.outreachRight}>
            <OutreachStatusBadge status={outreach.status} />
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.outreachExpanded}>
          <View style={styles.emailPreview}>
            <Text style={styles.emailSubjectLabel}>Subject:</Text>
            <Text style={styles.emailSubject}>{outreach.subject}</Text>
            <Text style={styles.emailBody}>{outreach.body}</Text>
          </View>

          <View style={styles.statusSelector}>
            <Text style={styles.selectorLabel}>Status:</Text>
            <View style={styles.statusOptions}>
              {STATUS_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusChip, outreach.status === s ? styles.statusChipActive : undefined]}
                  onPress={() => onStatusChange(outreach.id, s)}
                >
                  <Text style={[styles.statusChipText, outreach.status === s ? styles.statusChipTextActive : undefined]}>
                    {s.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.cardActions}>
            {outreach.contact && outreach.status === 'NOT_CONTACTED' && (
              <Button
                label="Send Email"
                onPress={() => onSend(outreach.id)}
                size="sm"
              />
            )}
            <Button
              label="Delete"
              onPress={() => onDelete(outreach.id)}
              variant="danger"
              size="sm"
            />
          </View>
        </View>
      )}
    </Card>
  );
}

function GenerateEmailModal({
  visible,
  releaseId,
  onClose,
  onGenerated,
}: {
  visible: boolean;
  releaseId: string;
  onClose: () => void;
  onGenerated: (email: { subject: string; body: string }) => void;
}) {
  const [contactType, setContactType] = useState<ContactType>('BLOG');
  const [contactName, setContactName] = useState('');
  const [loading, setLoading] = useState(false);

  const [generateOutreachEmail] = useMutation(GENERATE_OUTREACH_EMAIL_MUTATION);

  async function handleGenerate() {
    setLoading(true);
    try {
      const { data } = await generateOutreachEmail({
        variables: {
          releaseId,
          contactType,
          contactName: contactName || undefined,
        },
      });
      onGenerated(data.generateOutreachEmail as { subject: string; body: string });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.header}>
            <Text style={modal.title}>Generate Outreach Email</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={modal.body}>
            <View>
              <Text style={modal.label}>Recipient type</Text>
              <View style={modal.typeRow}>
                {(['BLOG', 'RADIO', 'PLAYLIST', 'JOURNALIST'] as ContactType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[modal.typeChip, contactType === t ? modal.typeChipActive : undefined]}
                    onPress={() => setContactType(t)}
                  >
                    <Text style={[modal.typeChipText, contactType === t ? modal.typeChipTextActive : undefined]}>
                      {CONTACT_TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Input
              label="Recipient name (optional)"
              value={contactName}
              onChangeText={setContactName}
              placeholder="Max"
              hint="Used to personalize the greeting"
            />
            <Button
              label="Generate with AI"
              onPress={handleGenerate}
              loading={loading}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AssignContactModal({
  visible,
  contacts,
  releaseId,
  generatedEmail,
  onClose,
  onSaved,
}: {
  visible: boolean;
  contacts: Contact[];
  releaseId: string;
  generatedEmail: { subject: string; body: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [subject, setSubject] = useState(generatedEmail?.subject ?? '');
  const [body, setBody] = useState(generatedEmail?.body ?? '');
  const [loading, setLoading] = useState(false);

  const [createOutreach] = useMutation(CREATE_OUTREACH_MUTATION);

  React.useEffect(() => {
    setSubject(generatedEmail?.subject ?? '');
    setBody(generatedEmail?.body ?? '');
  }, [generatedEmail]);

  async function handleSave() {
    if (!selectedContact) {
      alert('Please select a contact');
      return;
    }
    setLoading(true);
    try {
      await createOutreach({
        variables: { releaseId, contactId: selectedContact, subject, body },
      });
      onSaved();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <ScrollView>
          <View style={modal.sheetLarge}>
            <View style={modal.header}>
              <Text style={modal.title}>Review & Assign Contact</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={modal.body}>
              <Input label="Subject" value={subject} onChangeText={setSubject} />
              <Input label="Body" value={body} onChangeText={setBody} multiline numberOfLines={12} />

              <Text style={modal.label}>Assign to contact</Text>
              <View style={styles.contactGrid}>
                {contacts.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.contactOption, selectedContact === c.id ? styles.contactOptionActive : undefined]}
                    onPress={() => setSelectedContact(c.id)}
                  >
                    <Text style={styles.contactOptionName}>{c.name}</Text>
                    <Text style={styles.contactOptionEmail}>{c.email}</Text>
                  </TouchableOpacity>
                ))}
                {contacts.length === 0 && (
                  <Text style={styles.muted}>No contacts yet. Add some in the Contacts tab.</Text>
                )}
              </View>

              <Button label="Save Outreach" onPress={handleSave} loading={loading} fullWidth size="lg" />
              <Button label="Skip (save without contact)" onPress={onClose} variant="ghost" fullWidth />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, gap: spacing.xl },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backText: { color: colors.textSecondary, fontSize: fontSize.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: fontSize.xxxl, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, alignItems: 'center' },
  statCount: { fontSize: fontSize.xxl, fontWeight: '700' },
  statLabel: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
  emptyCard: { alignItems: 'center' },
  emptyInner: { alignItems: 'center', gap: spacing.sm },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary },
  emptySubtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
  outreachList: { gap: spacing.md },
  outreachCard: {},
  outreachHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  outreachMeta: { flex: 1, gap: 2, marginRight: spacing.md },
  contactName: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  outreachSubject: { fontSize: fontSize.sm, color: colors.textSecondary },
  outreachRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  outreachExpanded: { marginTop: spacing.md, gap: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  emailPreview: {
    backgroundColor: colors.bgElevated, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.sm,
  },
  emailSubjectLabel: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  emailSubject: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  emailBody: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  statusSelector: { gap: spacing.sm },
  selectorLabel: { fontSize: fontSize.sm, color: colors.textMuted },
  statusOptions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  statusChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
  },
  statusChipActive: { backgroundColor: colors.primaryBg, borderColor: colors.primary },
  statusChipText: { fontSize: fontSize.xs, color: colors.textSecondary },
  statusChipTextActive: { color: colors.primary, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  contactGrid: { gap: spacing.sm },
  contactOption: {
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.bgCard,
  },
  contactOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  contactOptionName: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  contactOptionEmail: { fontSize: fontSize.sm, color: colors.textSecondary },
  muted: { color: colors.textMuted, fontSize: fontSize.md },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  sheet: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, width: '100%',
    maxWidth: 480, borderWidth: 1, borderColor: colors.border,
  },
  sheetLarge: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, width: '100%',
    maxWidth: 600, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.xl, alignSelf: 'center',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary },
  body: { padding: spacing.lg, gap: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 },
  typeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  typeChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.primaryBg, borderColor: colors.primary },
  typeChipText: { fontSize: fontSize.sm, color: colors.textSecondary },
  typeChipTextActive: { color: colors.primary, fontWeight: '600' },
});
