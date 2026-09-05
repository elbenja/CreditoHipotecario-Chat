export function Icon({
  name,
  size = 16,
  className = '',
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <i
      className={`hgi hgi-stroke hgi-${name} ${className}`}
      style={{ fontSize: size }}
      aria-hidden="true"
    />
  );
}
