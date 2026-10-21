# ZE PADEL — relais Gmail de test

Ce script permet à ZE PADEL de demander à ton compte Google d'envoyer un e-mail sans acheter de nom de domaine ni stocker ton mot de passe Gmail.

## Important

- Ce relais est **verrouillé en mode TEST**.
- Il n'accepte que `guillaume.compte@gmail.com` et `williamdurand84@gmail.com`.
- Il limite le test à 10 destinataires par jour.
- Il ne prend pas de destinataires en copie.
- Aucun envoi aux joueurs du tournoi n'est possible avec cette version du script.
- Ne mets jamais le secret dans GitHub, dans un message ou dans le code de la page web.

## Installation dans ton compte Google

1. Ouvre [Google Apps Script](https://script.google.com/home/start) avec le compte Gmail qui devra expédier les convocations.
2. Crée un **Nouveau projet** et nomme-le `ZE PADEL - Envoi mail`.
3. Dans `Code.gs`, remplace le contenu par le code du fichier `Code.gs` de ce dossier et enregistre.
4. Dans **Paramètres du projet** (roue dentée), ajoute une propriété de script :
   - Nom : `ZE_PADEL_API_SECRET`
   - Valeur : un secret aléatoire long (au moins 32 caractères), généré par ton gestionnaire de mots de passe.
5. Dans l'éditeur, ouvre les paramètres de fuseau horaire du projet et choisis `Europe/Paris`.
6. Clique sur **Déployer → Nouveau déploiement → Application Web**.
7. Choisis **Exécuter en tant que : moi** et, pour l'accès, **Tout le monde** si Google propose cette option. L'URL sera publiquement joignable, mais chaque requête d'envoi doit aussi présenter le secret stocké dans les propriétés du script.
8. Clique sur **Déployer** et accepte les autorisations d'envoi d'e-mail demandées par Google.
9. Copie l'URL de déploiement qui se termine par `/exec`. Ne la remplace pas par l'URL de test `/dev`.

Si Google ne propose pas l'accès « Tout le monde », n'essaie pas de rendre le script public par une autre méthode : dis-le-moi et nous adapterons la configuration.

## Après le déploiement

Transmets-moi uniquement l'URL `/exec`. Ne transmets pas le secret ici. Nous configurerons le secret directement dans les paramètres de Cloudflare comme secret Worker, avec exactement la même valeur que `ZE_PADEL_API_SECRET`.

En ouvrant l'URL `/exec` dans le navigateur, une réponse JSON doit indiquer que le relais ZE PADEL est disponible en mode `TEST_ONLY`. Cette vérification seule n'envoie aucun message.

## Quota

Google indique actuellement une limite Apps Script de 100 destinataires d'e-mail par jour pour les comptes personnels Gmail. Le script applique une limite supplémentaire et plus basse de 10 destinataires de test par jour. Les quotas peuvent évoluer : voir [les quotas officiels Apps Script](https://developers.google.com/apps-script/guides/services/quotas).
