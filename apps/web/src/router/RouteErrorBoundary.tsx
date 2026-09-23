import { useRouteError } from "react-router-dom";

/**
 * Catches everything that escapes a route. Without this, react-router renders its own
 * default error page — stack trace and all — to the end user.
 *
 * The most common case here is a stale chunk after a deploy: lazyPage already retried
 * once, so landing here means that retry failed too. Still offers a manual button,
 * because reloading really is the correct fix — only a fresh index.html knows the new
 * chunk hashes.
 */
export default function RouteErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : String(error ?? "");
  // Vite/the browser has no dedicated error code for this case; the message string is
  // the only thing that tells it apart.
  const isStaleChunk =
    /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(
      message,
    );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">
        {isStaleChunk ? "Đã có bản cập nhật mới" : "Trang gặp sự cố"}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {isStaleChunk
          ? "Ứng dụng vừa được cập nhật trong lúc bạn đang mở. Tải lại để dùng bản mới nhất."
          : "Đã có lỗi ngoài dự kiến. Tải lại trang hoặc quay lại sau ít phút."}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Tải lại trang
      </button>
      {import.meta.env.DEV && message ? (
        <pre className="max-w-full overflow-x-auto text-left text-xs text-muted-foreground">
          {message}
        </pre>
      ) : null}
    </div>
  );
}
