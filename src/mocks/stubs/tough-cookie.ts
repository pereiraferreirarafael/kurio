/**
 * Substituto mínimo do `tough-cookie` SOMENTE no bundle do navegador.
 *
 * O MSW usa `tough-cookie` para a loja de cookies de `HttpResponse`/`cookies`, mas este app autentica
 * por Bearer token e não usa cookies. O pacote real (com `tldts`) pesa ~70 KB gzip e ficava no
 * caminho crítico de carregamento (LCP mobile). Testes em Node usam o pacote real.
 * Se um dia o mock precisar de cookies, remova o alias em vite.config.ts.
 */
export class Cookie {
  static fromJSON() {
    return null
  }
  toJSON() {
    return {}
  }
}

export class MemoryCookieStore {
  idx: Record<string, Record<string, Record<string, Cookie>>> = {}
}

export class CookieJar {
  constructor(_store?: MemoryCookieStore) {}
  getCookiesSync() {
    return []
  }
  async setCookie() {
    return null
  }
}
