/**
 * Web Storage polyfill for the Vitest jsdom environment (Node 22+/26 대응).
 *
 * Node 22+ 부터 globalThis에 native `localStorage`/`sessionStorage` accessor가 노출되는데,
 * `--localstorage-file` 플래그가 없으면 이 getter가 `undefined`를 반환하면서 jsdom이
 * 제공해야 할 Storage를 가린다 (descriptor는 `configurable: true`). 그 결과 jsdom 단위
 * 테스트에서 `localStorage.clear()` 같은 호출이 "Cannot read properties of undefined"로
 * 깨진다 (Node 26 기준 전체 vitest 22+ 파일 fail). v3.50까지는 Node 버전이 낮아 미발생.
 *
 * 핵심: 단위 테스트 27곳이 `vi.spyOn(Storage.prototype, 'setItem')`으로 quota throw를
 * mock한다. 따라서 polyfill은 반드시 **Storage.prototype 기반**이어야 spy가 인스턴스
 * 메서드를 가로챈다. Storage.prototype 메서드를 in-memory로 정의하고(configurable+writable
 * 이라 덮어쓰기 가능) localStorage/sessionStorage를 `Object.create(Storage.prototype)`
 * 인스턴스로 주입한다. localStorage가 정상 동작하는 환경이면 polyfill은 건너뛴다(no-op).
 */

interface StorageConstructorLike {
  prototype: Storage;
}

function isUnavailable(name: 'localStorage' | 'sessionStorage'): boolean {
  try {
    return (globalThis as Record<string, unknown>)[name] == null;
  } catch {
    // native getter가 throw하는 경우도 unavailable로 간주
    return true;
  }
}

function installInMemoryStorage(): void {
  const StorageCtor = (globalThis as { Storage?: StorageConstructorLike }).Storage;
  if (!StorageCtor) return;
  const proto = StorageCtor.prototype as unknown as object;

  const backings = new WeakMap<object, Map<string, string>>();
  const backing = (self: object): Map<string, string> => {
    let map = backings.get(self);
    if (!map) {
      map = new Map<string, string>();
      backings.set(self, map);
    }
    return map;
  };

  Object.defineProperties(proto, {
    clear: {
      value(this: object): void {
        backing(this).clear();
      },
      configurable: true,
      writable: true,
    },
    getItem: {
      value(this: object, key: string): string | null {
        const map = backing(this);
        return map.has(key) ? (map.get(key) as string) : null;
      },
      configurable: true,
      writable: true,
    },
    key: {
      value(this: object, index: number): string | null {
        return Array.from(backing(this).keys())[index] ?? null;
      },
      configurable: true,
      writable: true,
    },
    removeItem: {
      value(this: object, key: string): void {
        backing(this).delete(key);
      },
      configurable: true,
      writable: true,
    },
    setItem: {
      value(this: object, key: string, value: string): void {
        backing(this).set(key, String(value));
      },
      configurable: true,
      writable: true,
    },
  });

  // `length`는 native Storage.prototype에서 configurable:false라 prototype 덮어쓰기가
  // 막힌다 → 각 인스턴스 own property로 정의해 native getter를 가린다 (home.ts/statsCache.ts
  // 의 `localStorage.length` + `key(i)` 순회가 정확히 동작하도록).
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    const instance = Object.create(proto) as Storage;
    Object.defineProperty(instance, 'length', {
      get(this: object): number {
        return backing(this).size;
      },
      configurable: true,
    });
    Object.defineProperty(globalThis, name, {
      value: instance,
      configurable: true,
      writable: true,
    });
  }
}

if (isUnavailable('localStorage') || isUnavailable('sessionStorage')) {
  installInMemoryStorage();
}
