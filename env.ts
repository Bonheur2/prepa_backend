import dns from 'dns';
import dotenv from 'dotenv';

// Mirrors Next.js's env-loading convention, which the rest of this project
// (and its docs/tooling) were set up around: `.env` first, then `.env.local`
// (gitignored, real secrets) overriding it.
//
// This MUST be its own module, imported first (not inline calls mixed with
// other imports in the same file): esbuild-based tools like `tsx` hoist all
// `import` statements above interleaved non-import code, so inline
// `dotenv.config()` calls written "before" a later `import` can actually run
// *after* it at runtime. Import order between multiple `import` statements is
// preserved, so making this side effect its own first import is what
// actually guarantees it runs before anything that reads `process.env`.
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

// Neon's DNS returns both A and AAAA records. Node tries IPv6 first by
// default, and any environment whose IPv6 egress is broken or absent
// (many containers/networks -- not just this one) burns the full connect
// timeout on each unreachable AAAA address before falling back to IPv4,
// which can make every DB connection attempt slow or fail outright.
dns.setDefaultResultOrder('ipv4first');
