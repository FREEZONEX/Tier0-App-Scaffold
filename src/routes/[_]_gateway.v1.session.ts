import { createFileRoute } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";
import { parseGatewayUser } from "@/lib/gateway";

const GATEWAY_SESSION_READY_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta http-equiv="Cache-Control" content="no-store">
</head><body><script>
window.parent.postMessage({type:'tier0.preview.gatewaySession',ok:true},'*');
</script></body></html>`;

function prefersHtml(headers: Headers): boolean {
  if (headers.get("sec-fetch-dest") === "iframe") return true;
  return headers.get("accept")?.includes("text/html") ?? false;
}

export const Route = createFileRoute("/__gateway/v1/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (prefersHtml(request.headers)) {
          return new Response(GATEWAY_SESSION_READY_HTML, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
            },
          });
        }

        const user = await getCurrentUser();
        const gatewayUser = user ? null : parseGatewayUser(request.headers);
        const session = user
          ? {
              userId: user.id,
              username: user.username,
              displayName: user.displayName,
              email: user.email ?? "",
              role: user.role,
            }
          : gatewayUser?.role
            ? {
                userId: gatewayUser.id,
                username: gatewayUser.name,
                displayName: gatewayUser.name,
                email: gatewayUser.email ?? "",
                role: gatewayUser.role,
              }
            : null;

        return Response.json(
          { session },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
