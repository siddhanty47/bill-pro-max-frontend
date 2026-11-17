import { Link, type LinkProps } from 'react-router-dom';
import styles from './TextLink.module.css';

export type TextLinkProps = LinkProps;

/**
 * An in-content link to another route (a party name in a detail field, a payment
 * date in a table): accent colour, medium weight, no underline. For button-styled
 * links use `Button to`; for document numbers use `DocNumber to`.
 */
export function TextLink({ className, ...rest }: TextLinkProps) {
  return <Link {...rest} className={[styles.link, className ?? ''].filter(Boolean).join(' ')} />;
}
