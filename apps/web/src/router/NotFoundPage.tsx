/** Not lazy: trivial and reachable from every unmatched URL, so it shouldn't itself
 *  round-trip through a chunk fetch. */
export default function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold">404</h1>
      <p className="text-sm text-muted-foreground">Trang không tồn tại.</p>
    </div>
  );
}
