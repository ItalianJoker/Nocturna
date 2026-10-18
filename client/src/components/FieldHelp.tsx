/**
 * Accessible helper under opaque selects/fields — visible on mobile (no hover).
 */

interface FieldHelpProps {
  id: string;
  children: string;
}

export function FieldHelp({ id, children }: FieldHelpProps) {
  if (!children) return null;
  return (
    <p
      id={id}
      className="mt-1 text-[0.7rem] leading-snug text-stone-500"
      role="note"
    >
      {children}
    </p>
  );
}
