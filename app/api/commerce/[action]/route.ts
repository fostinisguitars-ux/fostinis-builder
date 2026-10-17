import { env } from "cloudflare:workers";
import { createCommerceService } from "@/lib/commerce/service.mjs";
type Context = { params: Promise<{action: string}> };
async function route(request: Request, context: Context) {
  const {action} = await context.params;
  return createCommerceService(env)(request, action);
}
export const GET = route;
export const POST = route;
