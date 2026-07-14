
THIS IS OUR FIGMA DESIGN ---------->  https://www.figma.com/design/R40i0zCyGWzdj8m9BGoFt9/TipTop365?node-id=0%3A1&t=K3vQ86aWzMXPPvjt-1

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Seed & demo accounts (E1.6)

`npm run db:seed` populates the database per plan §12.7 (idempotent — safe to
re-run): Sarajevo + Banja Luka, the service/addon catalog, pricing config v1,
a promo code (`DOBRODOSLI10`), 10 demo bookings across all statuses, and:

| Account | Email | Role |
|---|---|---|
| Amar Admin | `admin@demo.tiptop365.ba` | admin |
| Lejla Kovač | `lejla@demo.tiptop365.ba` | customer |
| Adnan Hadžić | `adnan@demo.tiptop365.ba` | customer (Airbnb host, 3 properties) |
| Amina / Selma / Dragana / Jasmin | `<name>@demo.tiptop365.ba` | cleaner (verified; FBiH / student / RS / obrt) |
| Emir / Mirsad | `<name>@demo.tiptop365.ba` | cleaner (unverified; Mirsad carries a 48 KM cash-commission debt) |

Demo users have fake `demo-*` Firebase UIDs — they exist in Postgres for
fixtures/screens. Linking real Firebase Auth logins to them (so you can sign
in as these accounts) is part of the E11.3 fresh-machine setup; the full
README rewrite (env vars, architecture pointers) also lands there.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
