import type { SearchResult, SearchTag } from './searchEngine'
import { highlightParts } from './highlight'
import styles from './GlobalSearch.module.css'

const TAG_CLASS: Record<SearchTag, string> = {
  PARTY: styles.tagParty,
  AGREEMENT: styles.tagAgreement,
  INVENTORY: styles.tagInventory,
  CHALLAN: styles.tagChallan,
  BILL: styles.tagBill,
}

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((p, i) =>
        p.match ? <mark key={i} className={styles.mark}>{p.text}</mark> : <span key={i}>{p.text}</span>,
      )}
    </>
  )
}

/** Parties matched by site show the site instead of code/GST; agreements append it. */
function leadText(r: SearchResult): string {
  return r.viaSite && r.tag === 'PARTY' ? '' : r.subtitle
}

interface Props {
  id: string
  result: SearchResult
  query: string
  selected: boolean
  onHover: () => void
  onPick: () => void
}

export function SearchResultRow({ id, result, query, selected, onHover, onPick }: Props) {
  const lead = leadText(result)
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      className={`${styles.row} ${selected ? styles.rowSelected : ''}`}
      onMouseMove={selected ? undefined : onHover}
      onClick={onPick}
      title={result.tag === 'AGREEMENT' ? result.href.replace('/agreements/', '') : undefined}
    >
      <span className={`${styles.tag} ${TAG_CLASS[result.tag]}`}>{result.tag}</span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>
          <Highlighted text={result.title} query={query} />
          {result.badge && (
            <span className={`${styles.badge} ${result.badge === 'delivery' ? styles.badgeDelivery : styles.badgeReturn}`}>
              {result.badge}
            </span>
          )}
        </span>
        {(lead || result.viaSite) && (
          <span className={styles.rowSub}>
            {lead && <Highlighted text={lead} query={query} />}
            {lead && result.viaSite && ' · '}
            {result.viaSite && (
              <>
                <span className={styles.viaLabel}>via site: </span>
                <Highlighted text={result.viaSite} query={query} />
              </>
            )}
          </span>
        )}
      </span>
    </li>
  )
}
