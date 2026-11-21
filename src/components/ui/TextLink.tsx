import { Link, type LinkProps } from 'react-router-dom';
import { useRowLinkState } from './rowLink';
import styles from './TextLink.module.css';

export type TextLinkProps = LinkProps;

/**
 * An in-content link to another route (a party name in a detail field, a payment
 * date in a table): accent colour, medium weight, no underline. For button-styled
 * links use `Button to`; for document numbers use `DocNumber to`.
 */
export function TextLink({ className, state, ...rest }: TextLinkProps) {
  const rowState = useRowLinkState(typeof rest.to === 'string' ? rest.to : undefined);
  return (
    <Link
      {...rest}
      state={state ?? rowState}
      className={[styles.link, className ?? ''].filter(Boolean).join(' ')}
    />
  );
}
