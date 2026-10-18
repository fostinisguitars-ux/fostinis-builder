import { env } from "cloudflare:workers";
import { createCommerceService } from "@/lib/commerce/service.mjs";
import { createCustomOrderService } from "@/lib/commerce/custom-orders.mjs";
import { getChatGPTUser } from "@/app/chatgpt-auth";
type Context = { params: Promise<{action: string}> };
async function route(request: Request, context: Context) {
  const {action} = await context.params;
  if (action.startsWith('custom-')) {
    const identity = action === 'custom-admin' ? await getChatGPTUser() : null;
    return createCustomOrderService(env, {identity})(request, action);
  }
  return createCommerceService(env)(request, action);
}
export const GET = route;
export const POST = route;
