/**
 * @file ShareLinkManager component
 * @description Allows business owners to create, view, copy, and revoke
 * shareable portal links for a party. Two kit cards: the create form and
 * the links table.
 */
import { useState, useCallback } from 'react';
import styles from './ShareLinkManager.module.css';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetShareLinksQuery,
  useCreateShareLinkMutation,
  useRevokeShareLinkMutation,
} from '../api/shareLinkApi';
import { getErrorMessage } from '../api/baseApi';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Input,
  RowActions,
  Select,
  StatusChip,
  type Column,
} from './ui';
import { formatDate } from '../utils/format';
import type { Site, ShareLink } from '../types';

interface ShareLinkManagerProps {
  partyId: string;
  sites: Site[];
}

function isExpired(link: ShareLink): boolean {
  return !!link.expiresAt && new Date(link.expiresAt) < new Date();
}

/** Lifecycle status shown in the chip: revoked wins over expired. */
function linkStatus(link: ShareLink): string {
  if (link.status === 'revoked') return 'revoked';
  return isExpired(link) ? 'expired' : 'active';
}

const linkName = (link: ShareLink) => link.label || `Link ${link.token.slice(0, 8)}…`;

const scope = (link: ShareLink) =>
  link.siteCode ? <span className="mono">{link.siteCode}</span> : 'All sites';

const date = (d?: string) => (d ? formatDate(d) : '');

export function ShareLinkManager({ partyId, sites }: ShareLinkManagerProps) {
  const { currentBusinessId } = useCurrentBusiness();

  const { data: links } = useGetShareLinksQuery(
    { businessId: currentBusinessId!, partyId },
    { skip: !currentBusinessId }
  );

  const [createShareLink, { isLoading: isCreating }] = useCreateShareLinkMutation();
  const [revokeShareLink] = useRevokeShareLinkMutation();

  const [siteCode, setSiteCode] = useState('');
  const [label, setLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!currentBusinessId) return;
    try {
      await createShareLink({
        businessId: currentBusinessId,
        partyId,
        input: {
          siteCode: siteCode || undefined,
          label: label || undefined,
          expiresAt: expiresAt || undefined,
        },
      }).unwrap();
      setSiteCode('');
      setLabel('');
      setExpiresAt('');
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }, [currentBusinessId, partyId, siteCode, label, expiresAt, createShareLink]);

  const handleRevoke = useCallback(
    async (linkId: string) => {
      if (
        !currentBusinessId ||
        !confirm('Revoke this share link? It will stop working immediately.')
      )
        return;
      try {
        await revokeShareLink({ businessId: currentBusinessId, partyId, linkId }).unwrap();
      } catch (err) {
        alert(getErrorMessage(err));
      }
    },
    [currentBusinessId, partyId, revokeShareLink]
  );

  const handleCopy = useCallback((token: string, linkId: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(linkId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const shareLinks = links?.data || [];

  /** Copy + revoke for live links; revoked links have no actions. */
  const actions = (link: ShareLink) =>
    link.status === 'revoked' ? null : (
      <RowActions
        primary={
          <Button size="sm" onClick={() => handleCopy(link.token, link._id)}>
            {copiedId === link._id ? 'Copied' : 'Copy link'}
          </Button>
        }
        items={[{ label: 'Revoke', tone: 'danger', onClick: () => handleRevoke(link._id) }]}
      />
    );

  const columns: Column<ShareLink>[] = [
    { key: 'label', header: 'Link', render: linkName },
    { key: 'scope', header: 'Scope', nowrap: true, render: scope },
    { key: 'views', header: 'Views', mono: true, align: 'right', render: l => l.accessCount },
    { key: 'created', header: 'Created', nowrap: true, render: l => date(l.createdAt) },
    {
      key: 'expires',
      header: 'Expires',
      nowrap: true,
      hideOnMobile: true,
      render: l => date(l.expiresAt),
    },
    {
      key: 'lastViewed',
      header: 'Last viewed',
      nowrap: true,
      hideOnMobile: true,
      render: l => date(l.lastAccessedAt),
    },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: l => <StatusChip status={linkStatus(l)} />,
    },
    { key: 'actions', header: '', align: 'right', nowrap: true, render: actions },
  ];

  return (
    <>
      <Card title="New share link">
        <div className={styles.createRow}>
          <Field label="Site scope" className={styles.scope}>
            <Select value={siteCode} onChange={e => setSiteCode(e.target.value)}>
              <option value="">All sites</option>
              {sites.map(s => (
                <option key={s.code} value={s.code}>
                  {s.code}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Label" className={styles.label}>
            <Input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. For Rajesh"
            />
          </Field>
          <Field label="Expires" className={styles.expires}>
            <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </Field>
          <Button variant="primary" icon="plus" onClick={handleCreate} loading={isCreating}>
            Create link
          </Button>
        </div>
      </Card>

      <Card title="Share links" count={shareLinks.length} padded={false}>
        <DataTable
          aria-label="Share links"
          columns={columns}
          rows={shareLinks}
          rowKey={l => l._id}
          empty={<EmptyState title="No share links yet" />}
          mobile={{
            title: linkName,
            badge: l => <StatusChip status={linkStatus(l)} />,
            meta: l => [
              <span key="scope">{scope(l)}</span>,
              <span key="views">
                <span className="mono">{l.accessCount}</span> views
              </span>,
              <span key="created">Created {date(l.createdAt)}</span>,
              l.expiresAt && <span key="expires">Expires {date(l.expiresAt)}</span>,
            ],
            actions,
          }}
        />
      </Card>
    </>
  );
}
