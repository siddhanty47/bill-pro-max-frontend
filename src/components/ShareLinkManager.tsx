/**
 * @file ShareLinkManager component
 * @description Allows business owners to create, view, copy, and revoke
 * shareable portal links for a party.
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
import type { Site, ShareLink } from '../types';

interface ShareLinkManagerProps {
  partyId: string;
  sites: Site[];
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

function isExpired(link: ShareLink): boolean {
  return !!link.expiresAt && new Date(link.expiresAt) < new Date();
}

export function ShareLinkManager({ partyId, sites }: ShareLinkManagerProps) {
  const { currentBusinessId } = useCurrentBusiness();

  const { data: links } = useGetShareLinksQuery(
    { businessId: currentBusinessId!, partyId },
    { skip: !currentBusinessId },
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
      if (!currentBusinessId || !confirm('Revoke this share link? It will stop working immediately.')) return;
      try {
        await revokeShareLink({ businessId: currentBusinessId, partyId, linkId }).unwrap();
      } catch (err) {
        alert(getErrorMessage(err));
      }
    },
    [currentBusinessId, partyId, revokeShareLink],
  );

  const handleCopy = useCallback((token: string, linkId: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(linkId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const shareLinks = links?.data || [];

  return (
    <div className={styles.container}>
      {/* Create form */}
      <div className={styles.createRow}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Site scope</span>
          <select
            value={siteCode}
            onChange={(e) => setSiteCode(e.target.value)}
            className={styles.select}
          >
            <option value="">All sites</option>
            {sites.map((s) => (
              <option key={s.code} value={s.code}>{s.code}</option>
            ))}
          </select>
        </div>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Label (optional)</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. For Rajesh"
            className={styles.input}
          />
        </div>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Expires (optional)</span>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={styles.input}
          />
        </div>
        <button
          className="btn btn-sm btn-primary"
          onClick={handleCreate}
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : '+ Create Link'}
        </button>
      </div>

      {/* Links list */}
      {shareLinks.length > 0 ? (
        shareLinks.map((link) => {
          const expired = isExpired(link);
          const revoked = link.status === 'revoked';
          return (
            <div key={link._id} className={styles.linkRow}>
              <div className={styles.linkInfo}>
                <span className={styles.linkLabel}>
                  {link.label || `Link ${link.token.slice(0, 8)}...`}
                  {revoked && <span className={styles.revokedBadge}>Revoked</span>}
                  {!revoked && expired && <span className={styles.expiredBadge}>Expired</span>}
                </span>
                <span className={styles.linkMeta}>
                  <span>Scope: {link.siteCode || 'All sites'}</span>
                  <span>Views: {link.accessCount}</span>
                  <span>Created: {formatDate(link.createdAt)}</span>
                  {link.expiresAt && <span>Expires: {formatDate(link.expiresAt)}</span>}
                  {link.lastAccessedAt && <span>Last viewed: {formatDate(link.lastAccessedAt)}</span>}
                </span>
              </div>
              <div className={styles.linkActions}>
                {!revoked && (
                  <>
                    <button
                      className={`${styles.copyBtn} ${copiedId === link._id ? styles.copied : ''}`}
                      onClick={() => handleCopy(link.token, link._id)}
                    >
                      {copiedId === link._id ? 'Copied!' : 'Copy URL'}
                    </button>
                    <button
                      className={styles.revokeBtn}
                      onClick={() => handleRevoke(link._id)}
                    >
                      Revoke
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <p className="text-empty">No share links created yet.</p>
      )}
    </div>
  );
}
