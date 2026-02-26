# BriefTube — Development Priorities

**Last updated:** 2026-02-26
**Framework:** AARRR (Acquisition → Activation → Retention → Revenue → Referral)
**Status legend:** ✅ Done · ⚠️ Partial · ❌ Not started

---

## Bilan produit actuel

**Ce qui fonctionne bien :**
- Produit core solide — RSS → Gemini → TTS → Telegram, multi-langue, multi-chaîne
- Lifecycle emails complets (trial J-3/J-1/expired, activation, re-engagement, referral trial)
- Billing Stripe avec plan mensuel + annuel, cancel flow + offre de rétention
- Posthog installé — funnel visible
- SEO pages chaînes en place (acquisition organique amorcée)

**Ce qui bloque la croissance :**
1. **Boucle virale absente** — les résumés restent privés dans Telegram. Zero partage, zero acquisition organique hors SEO.
2. **Telegram obligatoire** — gros point de friction. Des utilisateurs potentiels n'ont pas Telegram ou refusent de l'installer. Cela limite l'adressable market.
3. **Délai trop long avant la première valeur** — un user s'inscrit, ajoute une chaîne, attend 12-24h sa première livraison. Beaucoup partent avant. Benchmark SaaS : si un user n'est pas activé à J+1, il ne convertira probablement jamais.
4. **Reward parrainage non déployé** — le mécanisme existe, mais Stripe ne crédite pas le parrain. C'est une promesse non tenue qui détruit la confiance.
5. **Découverte de contenu nulle** — l'utilisateur doit connaître des chaînes à l'avance. Pas de suggestions, pas de trending, pas de "les autres suivent aussi".

---

## Benchmarks clés à retenir

| Métrique | Benchmark B2C SaaS | Objectif BriefTube |
|----------|-------------------|-------------------|
| Trial → Paid CVR | 2–5% | > 10% (product-led) |
| Activation rate (J+1) | 37% médian | > 60% |
| Churn mensuel | 5–8% | < 4% |
| NRR | 106% médian | > 110% (upsell annuel) |
| Time to first value | < 10 min idéal | Actuellement 12-24h ← problème critique |

---

## P0 — Bloqueurs critiques (toujours actifs)

---

### ⚠️ P0-4 · Referral reward automation (Stripe)

**Problème :** Le parrain voit "Tu gagnes 1 mois gratuit par parrainage" mais ce crédit n'est jamais appliqué dans Stripe. Promesse non tenue = destruction de confiance.
**Impact :** Chaque utilisateur qui parraine et ne reçoit pas son crédit devient un ex-ambassadeur actif négatif.
**Fix :**
- Créer un coupon Stripe `REFERRAL_CREDIT_1MONTH`
- Sur `referrals` : ajouter colonne `rewarded_at`
- Dans le webhook `customer.subscription.updated` : si le filleul passe en `active`, appliquer le crédit au parrain via `stripe.customers.createBalanceTransaction`

---

## N1 — Viral loop : résumés partageables

> **Impact estimé : +30–50% acquisitions organiques**
> C'est le levier le plus sous-exploité du produit. Chaque résumé livré est une opportunité d'acquisition qui part à la poubelle.

---

### N1-1 · Lien public par résumé ❌

**Problème :** Quand un user reçoit un résumé dans Telegram, il ne peut pas le partager. Pourtant il voudrait dire "j'ai écouté ça ce matin" sur Twitter/LinkedIn.
**Opportunité :** Les fichiers audio sont déjà uploadés sur Supabase Storage avec une URL. Il suffit d'une page web légère qui les lit.
**Implementation :**
- Route `/s/[videoId]` — page publique, sans auth requise
- Affiche : titre de la vidéo, chaîne, lecteur audio, résumé texte (optionnel)
- CTA : "Get your own AI audio summaries → BriefTube"
- Le bot Telegram envoie le lien après chaque audio : "Listen on web → brief-tube.com/s/abc123"
- Effet de bord : indexé par Google → SEO bonus sur chaque vidéo populaire

---

### N1-2 · "Powered by BriefTube" watermark sur audio partagé ❌

**Quand un user partage le lien, BriefTube est visible.**
- Chaque écoute sur `/s/[videoId]` = impression de marque
- "Powered by BriefTube" en footer + CTA signup
- Objectif : 5% des visiteurs de pages partagées s'inscrivent

---

## N2 — Activation : réduire le Time to First Value

> **Impact estimé : +20–30% trial conversion**
> "Si un user n'est pas activé à J+1, il ne convertira probablement jamais." — benchmark SaaS

---

### N2-1 · Résumé de bienvenue immédiat ❌

**Problème :** L'user ajoute sa première chaîne, et attend. Si la chaîne n'a pas posté depuis 2 jours, il attend encore. Ce vide tue la motivation.
**Fix :** Quand un user ajoute sa première chaîne, déclencher immédiatement le traitement de la **dernière vidéo disponible** (même si déjà traitée pour d'autres users). Le livrer dans Telegram dans les 5 minutes.
- Signal clair : "Bienvenue ! Voici un exemple de ce que tu recevras."
- Worker : exposer un endpoint `/process-now?channel_id=X&user_id=Y`
- Ne pas attendre le prochain cycle RSS

---

### N2-2 · Prévisualisation sans Telegram ❌

**Problème :** L'user s'inscrit mais ne connecte pas Telegram. Il ne voit jamais le produit.
**Fix :** Après onboarding sans Telegram, montrer dans le dashboard un **résumé exemple** (hardcodé ou d'une chaîne populaire) avec le lecteur audio. Message : "Voici ce que tu recevras dans Telegram — connecte-le pour le recevoir automatiquement."

---

### N2-3 · Améliorer l'email d'activation (plus de contexte) ⚠️

**Actuellement :** Email envoyé à J+1 si Telegram non connecté.
**Amélioration :** Inclure dans l'email un lien audio d'exemple jouable directement ("Écoute ce résumé dans ton navigateur"). L'AHA moment arrive par email, sans Telegram.

---

## N3 — Retention : réduire la dépendance à Telegram

> **Impact estimé : -30% churn, +40% addressable market**

---

### N3-1 · Web player & bibliothèque complète ❌

**Actuellement :** Les résumés audio ne sont accessibles que via Telegram. Si l'user manque la notif, il doit scroller dans son historique Telegram.
**Fix :** Le dashboard affiche tous les résumés comme une bibliothèque permanente et jouable.
- Tri par chaîne, par date, par durée
- Lecteur audio inline (déjà fait dans SummariesFeed — à étendre)
- "Continue listening" — reprendre là où on s'est arrêté (localStorage)
- Valeur : BriefTube devient une app à part entière, pas juste un bot

---

### N3-2 · Email digest hebdomadaire (alternative à Telegram) ❌

**Cible :** Users sans Telegram ou qui veulent une alternative.
**Format :** Email hebdomadaire (lundi 8h) listant les 5-10 nouveaux résumés de la semaine avec un lecteur audio inline dans l'email.
**Valeur :** Supprime la barrière Telegram pour les nouveaux marchés (US, UK, utilisateurs corporate).
**Note :** Changement worker significatif — livrer après que Telegram soit 100% stable.

---

### N3-3 · Découverte de chaînes (trending, suggestions) ❌

**Problème :** Un user avec 1-2 chaînes peu actives reçoit peu de résumés → perd la valeur → churn.
**Fix :** Section "Découvrir" dans le dashboard :
- "Top 10 chaînes les plus suivies sur BriefTube" (données déjà en DB)
- "Tes chaînes similaires" (basé sur catégorie YouTube de ses chaînes actuelles)
- "Chaîne active de la semaine" (celle qui a posté le plus)
- Ajouter en 1 clic → engagement → rétention

---

### N3-4 · Notification push web ❌

**Quand un nouveau résumé arrive :** Envoyer une notification push dans le navigateur (Web Push API).
- Opt-in lors du premier résumé
- "MrBeast vient de sortir une vidéo — ton résumé est prêt"
- Alternative légère à Telegram pour les users desktop

---

## N4 — Revenue : maximiser la valeur par user

---

### N4-1 · Lifetime Deal ❌

**Pourquoi :** Injection de cash immédiate, base de fans engagés, parfait pour launch sur Product Hunt / Indie Hackers.
**Prix cible :** $149–179 (équivaut à 16-20 mois d'abonnement mensuel)
**Timing :** Après avoir un solide produit (maintenant). Limiter à 200 places pour créer la rareté.
**Channels :** AppSumo, Deals for Founders, Indie Hackers, Twitter/X

---

### N4-2 · Plan famille / groupe (2-5 users) ❌

**Pourquoi :** Un seul user qui aime le produit peut convaincre son cercle. Pricing groupé = barrière de sortie plus haute.
**Prix cible :** $14/mois pour 3 users (vs $27 séparément)
**Note :** Nécessite multi-user sur un même compte ou une table `invitations`.

---

### N4-3 · Upgrade en cours de trial (offre urgente à J+5) ❌

**Actuellement :** Email J-3 et J-1. Mais aucun incentive fort à convertir avant l'expiration.
**Fix :** À J+5 du trial (2 jours avant la fin), envoyer un email avec une **offre limitée 48h** : "-20% sur le premier mois si tu upgrades maintenant". Stripe coupon à durée limitée.
**Benchmark :** Les triggers comportementaux convertissent 67% mieux que les triggers calendaires.

---

### N4-4 · Upsell annuel post-conversion ❌

**Quand un user passe en Pro mensuel :** Après 30 jours (à la première renewal), envoyer un email : "Passe à l'annuel et économise $28/an". Moment optimal : juste après avoir payé son premier mois = prouvé qu'il garde l'abonnement.

---

## N5 — Referral : activer le bouche-à-oreille

---

### N5-1 · Corriger P0-4 (reward Stripe) ⚠️

Voir P0-4 ci-dessus — priorité absolue avant de pousser le referral.

---

### N5-2 · Referral via Telegram bot ❌

**Après chaque résumé livré :** Le bot inclut occasionnellement (1 fois par semaine) : "Tu aimes BriefTube ? Partage ce lien et gagne 1 mois gratuit : brief-tube.com/r/[code]"
**Timing :** Seulement après 3+ résumés reçus (user établi, pas au premier).

---

### N5-3 · Referral public — "Écoute ce que j'ai écouté" ❌

**Avec N1-1 (lien public par résumé) :** Ajouter dans Telegram un bouton "Partager" qui génère un tweet pré-rempli : "Je viens d'écouter le résumé de [vidéo] en 3 min grâce à @BriefTube — brief-tube.com/s/[id]".
**Twitter/X Cards :** La page `/s/[videoId]` doit avoir des meta OG cards pour un aperçu riche.

---

## N6 — Acquisition : diversifier les canaux

---

### N6-1 · Product Hunt launch ❌

**Quand :** Préparer un launch structuré. BriefTube a suffisamment de features pour un launch complet.
**Préparation :**
- Trailer vidéo 60s
- GIF animé du flow (signup → résumé dans Telegram en 3 étapes)
- 20+ reviews de beta users
- Hunter influent

---

### N6-2 · Content marketing (blog + SEO) ❌

**Strategy :**
- Articles "Les 10 meilleures chaînes YouTube sur [niche]" → capturer intent long-tail
- "Comment écouter YouTube en voiture" → intent très fort
- "Résumés YouTube en français" → niche FR forte
- Chaque article contient un CTA vers la page chaîne correspondante sur BriefTube

---

### N6-3 · Distribution via communautés Telegram ❌

**Opportunité :** Des milliers de groupes Telegram sur la tech, la finance, l'entrepreneuriat. Les admins cherchent du contenu.
**Approche :** Partenariat avec des groupes Telegram — offrir BriefTube Pro gratuit à l'admin en échange d'un post présentant le bot.

---

## Ordre d'exécution recommandé

```
IMMÉDIAT (semaine courante) :
  ├── ⚠️  P0-4  Stripe referral reward (promesse non tenue → urgence)
  └── ❌  P1-6  Summary quality controls (dernier P1 restant)

COURT TERME (2-4 semaines) :
  ├── ❌  N2-1  Résumé de bienvenue immédiat (time to value)
  ├── ❌  N1-1  Lien public par résumé (viral loop)
  └── ❌  N3-3  Découverte de chaînes dans le dashboard

MOYEN TERME (1-2 mois) :
  ├── ❌  N3-1  Web player & bibliothèque complète
  ├── ❌  N4-1  Lifetime Deal (Product Hunt prep)
  ├── ❌  N4-3  Offre urgente J+5 pendant trial
  └── ❌  N6-1  Product Hunt launch

LONG TERME (2-3 mois) :
  ├── ❌  N3-2  Email digest hebdomadaire (alternative Telegram)
  ├── ❌  N4-2  Plan famille / groupe
  └── ❌  N6-2  Content marketing + blog
```

---

## Success Metrics

| Métrique | Objectif 30j | Objectif 90j |
|----------|-------------|-------------|
| Trial → Paid CVR | > 8% | > 12% |
| Activation J+1 (1er résumé reçu) | > 50% | > 65% |
| Churn mensuel | < 6% | < 4% |
| Résumés partagés / résumés livrés | > 5% | > 15% |
| % signups via referral/viral | > 10% | > 25% |
| MRR growth | +15%/mois | +25%/mois |
