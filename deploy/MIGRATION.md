# Migration Vercel → VPS Self-Hosted

## Prérequis

Le VPS Hetzner (CCX23, 4 vCPU, 16GB RAM) héberge déjà le worker Python.
Ce guide ajoute le frontend Next.js sur le même serveur.

## Étape 1 : Setup VPS (une seule fois)

```bash
ssh brieftube-vps "sudo bash -s" < deploy/vps-setup.sh
```

Installe : Node.js 22, pnpm, Caddy, service systemd, script de deploy.

## Étape 2 : Activer le standalone output

Dans `next.config.ts`, ajouter :

```ts
const nextConfig: NextConfig = {
  output: "standalone",  // ← ajouter cette ligne
  // ... reste de la config
};
```

## Étape 3 : Configurer les secrets Infisical

Les variables d'environnement Next.js (Supabase, Stripe, etc.) doivent être dans
Infisical sous le path `/web` (même projet `089a5c93`).

Puis décommenter la ligne `ExecStart` avec Infisical dans le service systemd :
```bash
sudo nano /etc/systemd/system/brieftube-web.service
```

## Étape 4 : Premier deploy

```bash
ssh brieftube-vps '/home/brieftube/deploy-web.sh'
```

Vérifie : `curl http://138.199.220.195:3000`

## Étape 5 : DNS

1. Changer le A record de `brief-tube.com` → `138.199.220.195`
2. Changer le A record de `www.brief-tube.com` → `138.199.220.195`
3. Activer Caddy : `ssh brieftube-vps "sudo systemctl enable --now caddy"`
4. Caddy obtient automatiquement les certificats SSL via Let's Encrypt

## Étape 6 : CI/CD (optionnel)

Ajouter dans `.github/workflows/deploy.yml` :

```yaml
deploy-web:
  runs-on: ubuntu-latest
  needs: [build]
  steps:
    - name: Deploy web to VPS
      run: ssh brieftube-vps '/home/brieftube/deploy-web.sh'
```

## Rollback

Pour revenir sur Vercel :
1. Remettre le DNS vers Vercel
2. `ssh brieftube-vps "sudo systemctl stop brieftube-web caddy"`
3. Retirer `output: "standalone"` de next.config.ts

## Différences vs Vercel

| Feature | Vercel | Self-hosted |
|---------|--------|-------------|
| CDN edge global | ✅ | ❌ (serveur unique EU) |
| PPR streaming | ✅ | ✅ (avec standalone) |
| Auto HTTPS | ✅ | ✅ (Caddy + Let's Encrypt) |
| Deploy preview | ✅ | ❌ |
| Coût | $20/mo Pro | $0 (déjà payé) |
| CPU illimité | ❌ (quotas) | ✅ |

## Notes

- Le standalone output copie uniquement les fichiers nécessaires (~50MB vs ~500MB node_modules)
- Caddy gère le SSL automatiquement (renouvellement inclus)
- Le service Next.js tourne sur port 3000, Caddy proxifie depuis 80/443
- Le worker Python et le web Next.js partagent le même serveur sans conflit
