import { promises as dns } from "node:dns";
import { isIP } from "node:net";

function privateV4(address) {
  const p = address.split(".").map(Number);
  if (p.length !== 4) return true;
  const [a,b,c] = p;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) || a >= 224;
}

export function isPrivateIp(address) {
  const family = isIP(address);
  if (family === 4) return privateV4(address);
  if (family !== 6) return true;
  const n = address.toLowerCase();
  if (n === "::" || n === "::1" || n.startsWith("fe80:") || n.startsWith("fc") || n.startsWith("fd") || n.startsWith("ff")) return true;
  if (n.startsWith("::ffff:")) return privateV4(n.slice(7));
  return false;
}

export async function validateBrowserUrl(raw) {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "");
  const domains = (process.env.BROWSER_ALLOWED_DOMAINS || "").split(",").map(x => x.trim().toLowerCase().replace(/^\.+|\.+$/g, "")).filter(Boolean);
  if (url.protocol !== "https:") throw new Error("Only HTTPS browser URLs are allowed.");
  if (url.username || url.password) throw new Error("Browser URLs cannot contain credentials.");
  if (url.port && url.port !== "443") throw new Error("Non-standard browser ports are blocked.");
  if (isIP(host)) throw new Error("IP-literal browser URLs are blocked.");
  if (!domains.length) throw new Error("Browser allowlist is not configured.");
  if (!domains.some(d => host === d || host.endsWith("." + d))) throw new Error("This browser domain is not on the allowlist.");
  let records;
  try { records = await dns.lookup(host, { all: true, verbatim: true }); }
  catch { throw new Error("Browser hostname could not be resolved."); }
  if (!records.length || records.some(r => isPrivateIp(r.address))) throw new Error("Browser hostname resolves to a private or reserved address.");
  return url.toString();
}
