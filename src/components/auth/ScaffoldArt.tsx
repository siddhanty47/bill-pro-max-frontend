import styles from './ScaffoldArt.module.css';

const STANDARDS_X = [60, 167, 273, 380];
const LEDGERS_Y = [360, 260, 160, 60];
const COUPLER_ROWS = [260, 160, 60];

export function ScaffoldArt() {
  return (
    <svg className={styles.scaf} viewBox="0 0 520 400" aria-hidden="true" focusable="false">
      <g>
        {STANDARDS_X.map(x => (
          <path key={x} className={styles.pipe} d={`M${x} 360V60`} />
        ))}
      </g>
      <g className={styles.ledgers}>
        {LEDGERS_Y.map(y => (
          <path key={y} className={styles.pipe} d={`M60 ${y}H380`} />
        ))}
      </g>
      <path className={styles.brace} d="M60 360 L167 260 L273 160 L380 60" />
      <path className={styles.brace} d="M60 256 H380 M60 156 H380" />
      {COUPLER_ROWS.map((y, row) => (
        <g key={y} className={styles[`row${row}`]}>
          {STANDARDS_X.map(x => (
            <circle key={x} className={styles.coupler} cx={x} cy={y} r={4} />
          ))}
        </g>
      ))}
      <g className={styles.ann}>
        <path className={styles.dim} d="M60 380H380M60 374v12M380 374v12" />
        <text x="190" y="396">
          4.5 m · 3 bays
        </text>
        <path className={styles.dim} d="M40 60V360M34 60h12M34 360h12" />
        <text x="-240" y="32" transform="rotate(-90)">
          6.0 m
        </text>
      </g>
    </svg>
  );
}
