/** Estado de carga mientras se recupera la información del usuario en sesión. */
export function ProfileSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="h-36 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl bg-muted"
          />
        ))}
      </div>
    </div>
  );
}
