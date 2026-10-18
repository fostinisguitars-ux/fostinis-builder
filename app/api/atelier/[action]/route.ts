import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { createAtelierService } from "@/lib/atelier/service.mjs";
type Context = { params: Promise<{action: string}> };
async function route(request: Request, context: Context) {
  const {action} = await context.params;
  const identity = ['session', 'admin', 'admin-journal'].includes(action) ? await getChatGPTUser() : null;
  return createAtelierService(env, {identity})(request, action);
}
export const GET = route;
export const POST = route;
