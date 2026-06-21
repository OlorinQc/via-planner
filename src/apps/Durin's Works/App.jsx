import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";

// ─── FONTS ────────────────────────────────────────────────────────────────────
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap";

// ─── THEME (identical to Palantir) ────────────────────────────────────────────
const T = {
  bg:'#080a10', s1:'#0f1219', s2:'#141824', s3:'#1a1f2e',
  bd:'rgba(255,255,255,0.06)', bd2:'rgba(255,255,255,0.11)', bd3:'rgba(255,255,255,0.03)',
  tx:'#dde1ec', tx2:'#7e8a9e', tx3:'#3e4a5a',
  acc:'#5b9cf6', acc2:'#a8b8d0',
  g:'#3fb68b', y:'#d4922a', r:'#d95f5f',
  hdr:'#0a0c14',
  font:"'IBM Plex Sans', system-ui, sans-serif",
  mono:"'IBM Plex Mono', monospace",
  serif:"'Cinzel', serif",
};

// ─── PRIORITY PALETTE ─────────────────────────────────────────────────────────
const PRIORITY = {
  'Urgent':        { bg:'rgba(217,95,95,0.18)',   tx:'#d95f5f',  border:'rgba(217,95,95,0.35)' },
  'Danger':        { bg:'rgba(217,95,95,0.11)',   tx:'#e07050',  border:'rgba(217,95,95,0.22)' },
  'Défaut':        { bg:'rgba(212,146,42,0.13)',  tx:'#d4922a',  border:'rgba(212,146,42,0.28)' },
  'Avertissement': { bg:'rgba(212,186,42,0.10)',  tx:'#b8960a',  border:'rgba(212,186,42,0.22)' },
  'Surveillance':  { bg:'rgba(91,156,246,0.10)',  tx:'#5b9cf6',  border:'rgba(91,156,246,0.22)' },
  'Info':          { bg:'rgba(168,184,208,0.09)', tx:'#a8b8d0',  border:'rgba(168,184,208,0.18)' },
  'Limité':        { bg:'rgba(62,74,90,0.18)',    tx:'#7e8a9e',  border:'rgba(62,74,90,0.30)' },
  'Hors mandat':   { bg:'rgba(62,74,90,0.10)',    tx:'#3e4a5a',  border:'rgba(62,74,90,0.18)' },
  '—':             { bg:'rgba(62,74,90,0.07)',    tx:'#3e4a5a',  border:'rgba(62,74,90,0.14)' },
};
const PRIORITY_ORDER = { 'Urgent':0,'Danger':1,'Défaut':2,'Avertissement':3,'Surveillance':4,'Info':5,'Limité':6,'Hors mandat':7,'—':8 };

const WSTATUS = {
  'À faire':    { bg:'rgba(212,146,42,0.13)',  tx:'#d4922a' },
  'En cours':   { bg:'rgba(91,156,246,0.12)',  tx:'#5b9cf6' },
  'Fait':       { bg:'rgba(63,182,139,0.12)',  tx:'#3fb68b' },
  'Reporté':    { bg:'rgba(62,74,90,0.18)',    tx:'#7e8a9e' },
  'À confirmer':{ bg:'rgba(168,184,208,0.10)', tx:'#a8b8d0' },
  'Sans objet': { bg:'rgba(62,74,90,0.10)',    tx:'#3e4a5a' },
};

const PSTATUS = {
  'À trouver':     { bg:'rgba(212,146,42,0.11)',  tx:'#d4922a' },
  'En recherche':  { bg:'rgba(91,156,246,0.10)',  tx:'#5b9cf6' },
  'Option retenue':{ bg:'rgba(168,184,208,0.11)', tx:'#a8b8d0' },
  'Commandé':      { bg:'rgba(212,146,42,0.15)',  tx:'#d4922a' },
  'Livré':         { bg:'rgba(63,182,139,0.10)',  tx:'#3fb68b' },
  'Installé':      { bg:'rgba(63,182,139,0.18)',  tx:'#3fb68b' },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const isUrgentTiming = t => {
  if (!t) return false;
  const tl = t.toLowerCase();
  return tl.includes('jour 1') || tl.includes('dès prise') || tl.includes('urgent');
};

const timingStyle = t => {
  if (!t) return { bg:'rgba(62,74,90,0.10)', tx:T.tx3 };
  const tl = t.toLowerCase();
  if (tl.includes('jour 1') || tl.includes('dès prise')) return { bg:'rgba(217,95,95,0.16)', tx:T.r };
  if (tl.includes('urgent')) return { bg:'rgba(217,95,95,0.11)', tx:T.r };
  if (tl.includes('2026')) return { bg:'rgba(212,146,42,0.12)', tx:T.y };
  if (tl.includes('2027') || tl.includes('plus tard')) return { bg:'rgba(91,156,246,0.10)', tx:T.acc };
  if (tl.includes('avant') || tl.includes('après')) return { bg:'rgba(168,184,208,0.10)', tx:T.acc2 };
  return { bg:'rgba(62,74,90,0.12)', tx:T.tx2 };
};

const currentSeason = () => {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'Printemps';
  if (m >= 5 && m <= 7) return 'Été';
  if (m >= 8 && m <= 10) return 'Automne';
  return 'Hiver';
};

const seasonMatch = (season, current) => {
  if (!season) return false;
  const sl = season.toLowerCase();
  const cl = current.toLowerCase();
  if (sl === "toute l'année" || sl === 'annuel') return true;
  if (sl.includes(cl)) return true;
  if (sl.includes('printemps + automne') && (cl === 'printemps' || cl === 'automne')) return true;
  return false;
};

const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-CA', { month:'short', day:'numeric', year:'numeric' }) : '—';
const today = () => new Date().toISOString().split('T')[0];

// ─── STATIC DATA ──────────────────────────────────────────────────────────────

const SYSTEMS = [
  { id:'s1', name:'Drainage extérieur et terrassement', zone:'Extérieur — périmètre',
    ceQueOnSait:"Des pentes négatives ont été observées autour de la maison à l'avant, à l'arrière et sur les côtés. Le dégagement entre le sol et le revêtement est insuffisant à plusieurs endroits (minimum requis: 6-8 po). Des margelles sont absentes aux fenêtres basses du sous-sol. Des arbres/cèdres sont proches de la fondation.",
    pourquoi:"L'eau qui revient vers la maison sollicite anormalement les fondations, risque de créer des infiltrations et de la détérioration à long terme.",
    timing:'Été 2026', composantes:['SITE-001','SITE-002','AMEN-002','FND-007'], source:'INSP-P17; INSP-P21; INSP-P27',
    notes:'Attention au drain français lors des travaux', priority:'Urgent',
    actions:[
      { id:'a1-1', desc:"Corriger les pentes négatives pour que le terrain s'éloigne des fondations (pente minimale 5% sur les 2 premiers mètres).", timing:'Été 2026', composantes:['SITE-001'], source:'INSP-P27', notes:'Ne pas remblayer en contact avec le drain français', priority:'Urgent' },
      { id:'a1-2', desc:"Abaisser le niveau du sol pour maintenir 6-8 po de dégagement et installer des margelles aux fenêtres basses du sous-sol.", timing:'Été 2026', composantes:['SITE-002','FEN-003'], source:'INSP-P17; INSP-P21', notes:'Coordonner avec correction des pentes', priority:'Urgent' },
      { id:'a1-3', desc:"Évaluer et corriger la position des cèdres (retrait, recul ou élagage sévère) pour réduire rétention d'humidité près de la fondation.", timing:'Été 2026', composantes:['AMEN-002'], source:'INSP-P26-27; NOTES-VISITE', notes:'', priority:'Avertissement' },
    ]},
  { id:'s2', name:'Enveloppe extérieure – maçonnerie, fenêtres et étanchéité', zone:'Extérieur — murs, ouvertures',
    ceQueOnSait:"Plusieurs enjeux interconnectés sur l'enveloppe: fissures en Z, briques humides, joints d'allèges craqués, chantepleure obstrué par un crochet, anneau dans la brique, dégagement sous revêtement (déclin aluminium), seuil de porte trop bas, calfeutrage détérioré, larmiers et weep holes à vérifier.",
    pourquoi:"L'eau mal gérée autour de l'enveloppe crée de l'humidité derrière les murs, des moisissures et une dégradation progressive des matériaux.",
    timing:'Été 2026', composantes:['ENV-001','ENV-002','ENV-003','MAS-002','BRIQ-001','FEN-ALL-001','FEN-LAR-001','CALF-001','PORTE-001'],
    source:'INSP-P14-19', notes:"Regrouper en un seul chantier d'enveloppe avec un maçon", priority:'Urgent',
    actions:[
      { id:'a2-1', desc:"Mandater un maçon pour évaluer les fissures en Z, nettoyer les briques humides et corriger les pentes d'égouttement du parement.", timing:'Été 2026', composantes:['ENV-001','ENV-002','MAC-002'], source:'INSP-P16', notes:'Maçon requis', priority:'Avertissement' },
      { id:'a2-2', desc:"Refaire les joints de mortier des allèges par du scellant flexible (meilleure tolérance à l'expansion thermique). Vérifier tous les joints extérieurs et refaire au besoin.", timing:'Été 2026', composantes:['ENV-002','CALF-001'], source:'INSP-P18', notes:'Priorité pour prévenir infiltrations', priority:'Défaut' },
      { id:'a2-3', desc:"Retirer le crochet du chantepleure et vérifier l'état du solin derrière la brique à cet endroit.", timing:'Été 2026', composantes:['MAS-002','ENV-003'], source:'INSP-P18', notes:'Simple à corriger', priority:'Avertissement' },
      { id:'a2-4', desc:"Ajouter des trous d'évacuation (weep holes) dans le caulking au bas des allèges/tôle sous les fenêtres. Vérifier les larmiers du premier étage pour confirmer l'évacuation.", timing:'Été 2026', composantes:['FEN-ALL-001','FEN-LAR-001','MAS-001'], source:'INSP-P14; NOTES-VISITE', notes:'Éviter de boucher ces ouvertures avec du scellant', priority:'Urgent' },
      { id:'a2-5', desc:"Retirer l'anneau métallique vissé dans le mur de brique et reboucher/resceller.", timing:'Été 2026', composantes:['BRIQ-001'], source:'NOTES-VISITE', notes:'Correction simple - 30 min', priority:'Défaut' },
      { id:'a2-6', desc:"Corriger le dégagement insuffisant au bas du revêtement d'aluminium au-dessus des ouvertures (espace d'écoulement manquant selon inspection).", timing:'Été 2026', composantes:['ENV-003'], source:'INSP-P14', notes:'Réparation urgente selon rapport', priority:'Urgent' },
      { id:'a2-7', desc:"Corriger le seuil de porte extérieure trop près du sol pour prévenir infiltrations.", timing:'Été 2026', composantes:['PORTE-001'], source:'INSP-P20', notes:'', priority:'Défaut' },
    ]},
  { id:'s3', name:'Toiture et entretoit', zone:'Toiture / entretoit',
    ceQueOnSait:"La toiture a été refaite en 2017 (bardeaux Landmark CertainTeed, pente 6/12, garantie 10 ans main-d'œuvre). Solins déficients autour des pénétrations, platelage pourri localement, jonction toit-mur arrière droit à resceller, gouttière gauche fissurée.",
    pourquoi:"Même une toiture récente peut laisser entrer l'eau par les pénétrations mal scellées. Le platelage pourri indique des infiltrations passées.",
    timing:'Été 2026', composantes:['TOIT-001','TOIT-002','TOIT-003','TOIT-004','GOUT-001'],
    source:'INSP-P29-30; INSP-P12', notes:'', priority:'Défaut',
    actions:[
      { id:'a3-1', desc:"Resceller les solins autour des pénétrations de toiture (évents, mât électrique, etc.) avec du ciment plastique. Poser des solins appropriés lors de la prochaine réfection.", timing:'Été 2026', composantes:['TOIT-003','TOIT-004'], source:'INSP-P30', notes:'Entretien annuel à intégrer dans maintenance', priority:'Défaut' },
      { id:'a3-2', desc:"Refaire le joint de la jonction toit-mur à l'arrière droit (triangle en tôle semble défait).", timing:'Été 2026', composantes:['TOIT-002'], source:'NOTES-VISITE', notes:"Point critique d'infiltration", priority:'Défaut' },
      { id:'a3-3', desc:"Évaluer et remplacer les sections de platelage atteintes par la pourriture.", timing:'Été 2026', composantes:['TOIT-003'], source:'INSP-P12', notes:'Consulter un entrepreneur en charpente', priority:'Défaut' },
      { id:'a3-4', desc:"Réparer ou remplacer la gouttière fissurée côté gauche. Option recommandée: remplacer par un format 4x4 pour meilleure capacité. Corriger aussi les exutoires pour qu'ils s'éloignent à plus de 4 pieds des fondations.", timing:'Été 2026', composantes:['GOUT-001'], source:'INSP-P29; NOTES-EXT-01', notes:'Nettoyage saisonnier aussi dans maintenance', priority:'Défaut' },
    ]},
  { id:'s4', name:'Fondations et dalle de béton', zone:'Fondation / sous-sol',
    ceQueOnSait:"Historique de réparations de fissures (1994, 2016, ~2023). Attaches de coffrage non scellées avec efflorescence. Crépi fissuré. Trou dans la dalle du sous-sol. Le rapport d'inspection recommande une expertise par spécialiste avant la fin de la condition d'inspection.",
    pourquoi:"Les fissures actives ou non scellées permettent l'infiltration d'eau. L'efflorescence indique un passage d'humidité. Une expertise confirme l'ampleur des correctifs nécessaires.",
    timing:'Été 2026', composantes:['FND-001','FND-002','FND-003','FND-004','FND-005','FND-006','FND-007','DALLE-001','BET-001'],
    source:'INSP-P07-10', notes:'Point le plus structurant du rapport', priority:'Urgent',
    actions:[
      { id:'a4-1', desc:"Mandater un spécialiste en fondations/structure pour évaluer les fissures, l'efflorescence, les attaches de coffrage, et valider l'imperméabilisation et le drainage.", timing:'Urgent — dès prise de possession', composantes:['FND-005'], source:'INSP-P08-09', notes:'Expertise requise avant de décider les travaux', priority:'Urgent' },
      { id:'a4-2', desc:"Couper et sceller les attaches de coffrage visibles non protégées pour prévenir les infiltrations.", timing:'Été 2026', composantes:['FND-005'], source:'INSP-P08', notes:'À faire après expertise', priority:'Urgent' },
      { id:'a4-3', desc:"Réparer les sections de crépi fissurées ou décollées pour restaurer la protection de la fondation.", timing:'Été 2026', composantes:['FND-006'], source:'INSP-P07', notes:'À faire après expertise', priority:'Défaut' },
      { id:'a4-4', desc:"Réparer le trou observé dans la dalle du sous-sol (atelier) pour prévenir émanations de gaz et infiltrations. Récupérer et classer le rapport de pyrite de 2007.", timing:'Été 2026', composantes:['DALLE-001'], source:'INSP-P10', notes:'Rapport pyrite 2007 disponible dans les documents', priority:'Défaut' },
      { id:'a4-5', desc:"Colmater les fissures de la dalle de béton avant pour limiter les infiltrations et retarder la détérioration par gel/dégel.", timing:'Été 2026', composantes:['BET-001'], source:'INSP-P04; NOTES-VISITE', notes:'Travail simple — 1/2 journée', priority:'Défaut' },
    ]},
  { id:'s5', name:'Patio et terrasse', zone:'Arrière — patio',
    ceQueOnSait:"Le patio présente plusieurs enjeux: balustrade non sécuritaire (danger), poutres pourries, membrane humidité absente à la jonction terrasse-mur, équerres/pénétrations non scellées dans le mur. La solive du patio est ancrée dans la maçonnerie.",
    pourquoi:"La balustrade représente un risque immédiat de chute. Les poutres pourries et la membrane absente peuvent entraîner une dégradation structurelle rapide et des infiltrations derrière le mur.",
    timing:'Été 2026 / Plus tard', composantes:['PAT-SEC-001','PAT-STR-001','PAT-ET-001','PAT-ET-002','CLOT-001'],
    source:'INSP-P23-24; NOTES-VISITE', notes:'', priority:'Danger',
    actions:[
      { id:'a5-1', desc:"Solidifier ou remplacer rapidement la balustrade non sécuritaire. Priorité absolue sécurité.", timing:'Urgent — jour 1', composantes:['PAT-SEC-001'], source:'INSP-P23', notes:'Danger potentiel', priority:'Danger' },
      { id:'a5-2', desc:"Sceller tous les équerres et points de pénétration des poutres dans le mur avec du scellant flexible.", timing:'Été 2026', composantes:['PAT-ET-001'], source:'NOTES-VISITE', notes:'Travail simple, quelques heures', priority:'Surveillance' },
      { id:'a5-3', desc:"Vérifier la présence d'une membrane contre l'humidité à la jonction terrasse-mur et remplacer les éléments de bois endommagés.", timing:'Été 2026', composantes:['PAT-ET-002'], source:'INSP-P24', notes:'Peut nécessiter une ouverture de la jonction', priority:'Avertissement' },
      { id:'a5-4', desc:"Remplacer la poutre pourrie à droite du patio. Inspecter et remplacer ou renforcer les autres poutres endommagées.", timing:'Été 2027', composantes:['PAT-STR-001'], source:'NOTES-VISITE', notes:'Projet plus lourd à planifier', priority:'Défaut' },
      { id:'a5-5', desc:"Solidifier la barrière en bois, particulièrement la section directement devant la porte patio.", timing:'Été 2026', composantes:['CLOT-001'], source:'NOTES-VISITE', notes:'Risque sécurité', priority:'Défaut' },
    ]},
  { id:'s6', name:'Plomberie', zone:'Maison',
    ceQueOnSait:"Plusieurs correctifs de sécurité et de prévention: valve principale rotative à remplacer, conduits oxydés, brise-vide absent, clapets anti-retour non localisés, chauffe-eau en fin de vie (2015, ~40$/mois location), bac chauffe-eau non raccordé, valves manquantes au lavabo SS et au bar, flexibles à inspecter.",
    pourquoi:"Les correctifs de sécurité (valve, clapets) sont prioritaires pour la gestion d'urgence. Le chauffe-eau 2015 représente un risque de dégâts d'eau si non remplacé rapidement.",
    timing:'Été 2026', composantes:['PLOM-006','PLOM-007','PL-EXT-001','PL-EXT-002','CLAP-001','CH-EAU-001','PLOM-002','PLOM-003','PLOM-004'],
    source:'INSP-P31-38', notes:'Mandater un plombier pour groupe de travaux', priority:'Urgent',
    actions:[
      { id:'a6-1', desc:"Repérer et identifier la valve principale (sous l'escalier au sous-sol). Remplacer la valve rotative par une valve à poignée (levier) pour faciliter les interventions d'urgence.", timing:'Été 2026', composantes:['PLOM-006'], source:'INSP-P31-32', notes:"Localisée sous le palier d'escalier", priority:'Défaut' },
      { id:'a6-2', desc:"Remplacer le robinet extérieur, installer un brise-vide (dispositif anti-retour) et repérer la valve de fermeture hivernale.", timing:'Été 2026', composantes:['PL-EXT-001','PL-EXT-002'], source:'INSP-P33-34', notes:"Fermer avant l'hiver", priority:'Défaut' },
      { id:'a6-3', desc:"Vérifier la présence des clapets anti-retour (drain de plancher, appareils sanitaires, conduite principale). Pour les assurances: statut inconnu jusqu'à confirmation. Installer si absents.", timing:'Été 2026', composantes:['CLAP-001'], source:'INSP-P36-37; DV', notes:'Peut être sous faux plancher', priority:'Défaut' },
      { id:'a6-4', desc:"Remplacer rapidement le chauffe-eau 2015 (fin de vie). Raccorder le bac de sûreté au drain de la salle de bain adjacente (passage sous plancher).", timing:'Été 2026 — urgent', composantes:['CH-EAU-001'], source:'INSP-P37-38', notes:'Ne pas tarder selon le rapport', priority:'Urgent' },
      { id:'a6-5', desc:"Faire vérifier les conduits oxydés par un maître plombier. Planifier le remplacement progressif des sections à risque.", timing:'Été 2026', composantes:['PLOM-007'], source:'INSP-P35', notes:'Réseau vieillissant depuis 1979', priority:'Urgent' },
      { id:'a6-6', desc:"Installer des valves d'arrêt (eau chaude et froide) sur le lavabo de la salle de bain du sous-sol et sur la plomberie du bar.", timing:'Été 2026', composantes:['PLOM-002','PLOM-003'], source:'NOTES-VISITE', notes:'Simple à combiner avec autres travaux plomberie', priority:'Avertissement' },
      { id:'a6-7', desc:"Inspecter et remplacer au besoin les flexibles tressés (sous le lavabo et près de la toilette, salle de bain étage).", timing:'Été 2026', composantes:['PLOM-004'], source:'NOTES-VISITE', notes:'Remplacement préventif si doute', priority:'Avertissement' },
    ]},
  { id:'s7', name:'Électricité', zone:'Maison',
    ceQueOnSait:"Panneau Siemens 150A remplacé en 2016 (2 092,55 $). Disjoncteurs non tous étiquetés. Mât électrique sous tension excessive (manque d'attaches). Deux jonctions aluminium-cuivre au sous-sol. Prises présentant des risques (polarité, GFCI, peinture).",
    pourquoi:"Ces correctifs touchent la sécurité des occupants et la conformité. Une seule visite groupée d'un électricien permet de tout régler.",
    timing:'Été 2026', composantes:['ELEC-EXT-001','ELEC-001','ELEC-ALCU-001','ELEC-PRISE-001'],
    source:'INSP-P39-43', notes:'', priority:'Danger',
    actions:[
      { id:'a7-1', desc:"Ajouter une ou deux attaches métalliques (brackets) au mât électrique pour réduire la tension sur le conduit.", timing:'Été 2026', composantes:['ELEC-EXT-001'], source:'INSP-P39; NOTES-VISITE', notes:'Électricien requis', priority:'Défaut' },
      { id:'a7-2', desc:"Identifier et étiqueter tous les disjoncteurs (incluant la climatisation). Vérifier et corriger l'accessibilité du panneau (espace libre 3 pieds, hauteur conforme).", timing:'Été 2026', composantes:['ELEC-001'], source:'INSP-P40-41', notes:"Travail simple d'étiquetage + vérification", priority:'Danger' },
      { id:'a7-3', desc:"Faire vérifier par un électricien les deux jonctions aluminium-cuivre visibles. Utiliser des connecteurs CU/AL et de la pâte antioxydante.", timing:'Été 2026', composantes:['ELEC-ALCU-001'], source:'INSP-P41; NOTES-VISITE', notes:'Seulement 2 jonctions à vérifier', priority:'Avertissement' },
      { id:'a7-4', desc:"Corriger les prises à risque: déplacer ou protéger les prises près de la plomberie (GFCI), corriger la polarité inversée, remplacer les prises peintes, installer protection GFCI dans la salle de bain.", timing:'Été 2026', composantes:['ELEC-PRISE-001'], source:'INSP-P42-43', notes:'Mandater un maître électricien', priority:'Danger' },
    ]},
  { id:'s8', name:'Chauffage et sécurité incendie', zone:'Maison',
    ceQueOnSait:"Plinthes problématiques: pièces sans chauffage, plinthes peintes, plinthe sous prise, rideaux en contact. Luminaire non protégé dans garde-robe bureau. Avertisseurs fumée et CO à valider.",
    pourquoi:"Ces points touchent directement la sécurité incendie et le confort thermique.",
    timing:'Été 2026', composantes:['HVAC-002','CHAUFF-001','SEC-001','SEC-003'],
    source:'INSP-P44-46', notes:'', priority:'Danger',
    actions:[
      { id:'a8-1', desc:"Corriger les plinthes problématiques: ajouter une plinthe dans la salle de rangement du sous-sol, remplacer les plinthes peintes, relocaliser les plinthes sous des prises électriques.", timing:'Été 2026', composantes:['HVAC-002','CHAUFF-001'], source:'INSP-P44-45', notes:'Électricien pour plinthe salle rangement', priority:'Défaut' },
      { id:'a8-2', desc:"S'assurer que les rideaux du salon ne touchent pas les plinthes de chauffage. Distance sécuritaire obligatoire pour prévenir incendie.", timing:'Dès prise de possession', composantes:['HVAC-002'], source:'INSP-P45', notes:'Simple à corriger', priority:'Danger' },
      { id:'a8-3', desc:"Installer un globe protecteur ou un luminaire fermé sur le luminaire à porcelaine du garde-robe du bureau.", timing:'Été 2026', composantes:['SEC-001'], source:'INSP-P46', notes:'5 min — 15 $ de matériel', priority:'Danger' },
      { id:'a8-4', desc:"Vérifier la présence et le bon fonctionnement des avertisseurs de fumée et de monoxyde de carbone. Se référer aux specs du fabricant pour le nombre et l'emplacement.", timing:'Jour 1', composantes:['SEC-003'], source:'INSP-P54', notes:'', priority:'Danger' },
    ]},
  { id:'s9', name:'Ventilation – hotte, conduits et salles de bain', zone:'Cuisine / entretoit / maison',
    ceQueOnSait:"Hotte évacue dans l'entretoit (urgence). Sélecteur de vitesses de la hotte défectueux. Conduit de sécheuse en plastique. Plusieurs conduits reliés à un seul registre. Conduits non isolés. Salle de bain étage sans ventilateur.",
    pourquoi:"La hotte dans l'entretoit est un risque majeur d'humidité, moisissures et condensation. Les conduits partagés augmentent les risques d'incendie et de moisissures.",
    timing:'Été 2026', composantes:['HOTTE-001','VENT-001','VENT-002','VENT-003','VENT-ATT-001','SDBET-VENT-001'],
    source:'INSP-P62-64; INSP-P61', notes:'Regrouper en un seul chantier ventilation', priority:'Urgent',
    actions:[
      { id:'a9-1', desc:"Corriger d'urgence l'évacuation de la hotte: installer un conduit rigide métallique passant au-dessus des armoires jusqu'à une sortie murale côté patio. Isoler le conduit dans l'entretoit. Réparer le sélecteur de vitesses.", timing:'Été 2026 — URGENT', composantes:['HOTTE-001'], source:'INSP-P62-63', notes:'Réparation urgente; solution murale recommandée', priority:'Urgent' },
      { id:'a9-2', desc:"Remplacer le conduit de sécheuse en plastique par un conduit rigide en acier galvanisé. Limiter les coudes et la distance. Séparer du conduit de salle de bain (pas de Y). Donner à chaque conduit son propre registre extérieur.", timing:'Été 2026', composantes:['VENT-001','VENT-003'], source:'INSP-P63-64', notes:'Sécurité incendie', priority:'Défaut' },
      { id:'a9-3', desc:"Isoler les 3 à 6 pieds précédant les sorties extérieures de tous les conduits pour réduire la condensation.", timing:'Été 2026', composantes:['VENT-002'], source:'NOTES-VISITE', notes:'À coordonner avec autres travaux ventilation', priority:'Défaut' },
      { id:'a9-4', desc:"Installer un ventilateur d'extraction avec sortie extérieure dans la salle de bain du premier étage. Coordonner avec les travaux de la hotte si possible.", timing:'Été 2026', composantes:['SDBET-VENT-001'], source:'INSP-P61', notes:'Électricien requis', priority:'Avertissement' },
    ]},
  { id:'s10', name:'Isolation – entretoit et fondation', zone:'Entretoit / sous-sol',
    ceQueOnSait:"Isolant déplacé dans l'entretoit, résistance thermique faible, trappe d'accès mal isolée, déflecteurs insuffisants. Sous-sol: isolant combustible sans protection ignifuge, laine en contact avec fondation, solive de rive non isolée.",
    pourquoi:"L'isolation déficiente entraîne des pertes de chaleur, des risques de condensation, de digues de glace et des problèmes de sécurité incendie (isolant combustible).",
    timing:'Été 2026 / Plus tard', composantes:['ISO-001','ISO-002','ISO-FND-001','VENT-ATT-001'],
    source:'INSP-P55-60', notes:'Coordonner avec ventilation', priority:'Danger',
    actions:[
      { id:'a10-1', desc:"Replacer l'isolant déplacé. Améliorer l'étanchéité du plafond (sceller ouvertures, ventilateurs, sorties de plomberie). Isoler et étanchéifier la trappe d'accès (joint néoprène + poids).", timing:'Été 2026', composantes:['ISO-002'], source:'INSP-P55-56', notes:'Peut se faire en même temps que ventilation', priority:'Défaut' },
      { id:'a10-2', desc:"Repositionner le ventilateur de toiture (près du faîte). Obturer les sorties concurrentes. Installer des déflecteurs pour dégager la ventilation par les soffites. Ajouter ventilation aux pignons.", timing:'Été 2026', composantes:['VENT-ATT-001'], source:'INSP-P57-58', notes:'Spécialiste en ventilation recommandé', priority:'Défaut' },
      { id:'a10-3', desc:"Ajouter de l'isolant en vrac dans l'entretoit pour atteindre les normes actuelles (R-40 à R-50). Ne pas obstruer les soffites.", timing:'Été 2026 / Plus tard', composantes:['ISO-001'], source:'INSP-P56', notes:'Subventions possibles — vérifier programmes disponibles', priority:'Avertissement' },
      { id:'a10-4', desc:"Recouvrir l'isolant combustible d'un matériau ignifuge (ex: gypse firecode). Créer un espace d'air entre la laine de verre et la fondation. Isoler la solive de rive (rim joist) au palier.", timing:'Plus tard', composantes:['ISO-FND-001'], source:'INSP-P59-60', notes:'Sécurité incendie + humidité', priority:'Danger' },
    ]},
  { id:'s11', name:'Salles de bain', zone:'Premier étage / sous-sol',
    ceQueOnSait:"Salle de bain RDC: ne pas utiliser comme douche (murs en gypse non protégés), dosseret absent autour du bain. Salle de bain sous-sol: test d'étanchéité de la douche requis.",
    pourquoi:"L'utilisation d'une douche sur des murs non protégés causerait des dégâts d'eau immédiats. Le dosseret absent peut déjà avoir causé des infiltrations derrière le mur.",
    timing:'Été 2026', composantes:['SDBET-001','SDBET-002','SDBSS-001'],
    source:'INSP-P32-33; NOTES-VISITE', notes:'', priority:'Défaut',
    actions:[
      { id:'a11-1', desc:"Installer un dosseret / protection murale complète (panneaux acryliques, tuile avec membrane) autour du bain pour permettre l'utilisation comme douche. NE PAS utiliser comme douche avant cette correction.", timing:'Été 2026', composantes:['SDBET-001'], source:'INSP-P32', notes:'Obligatoire avant usage', priority:'Défaut' },
      { id:'a11-2', desc:"Maintenir et refaire au besoin le joint de scellant à la base et autour du bain pour prévenir infiltrations.", timing:'Dès prise de possession', composantes:['SDBET-001'], source:'INSP-P33', notes:'Entretien régulier requis', priority:'Défaut' },
      { id:'a11-3', desc:"Effectuer un test d'étanchéité complet de la douche du sous-sol (arroser murs et porte, vérifier fuites extérieures et plancher adjacent).", timing:'Dès prise de possession', composantes:['SDBSS-001'], source:'NOTES-VISITE', notes:"Test à faire avant de finir d'installer", priority:'Défaut' },
    ]},
  { id:'s12', name:"Climatisation et chauffage d'appoint", zone:'RDC / Toiture',
    ceQueOnSait:"Climatiseur mural Carrier mini-split 12 000 BTU installé en 2008. Dernier entretien documenté: mai 2024. Contrat annulé en 2025. Fiche signalétique absente. Non testé en inspection hivernale. Foyer/cheminée hors mandat d'inspection; réparations cheminée en 2018 (1 066,68 $).",
    pourquoi:"Le climatiseur doit être validé avant la saison chaude. Le foyer/cheminée doit être vérifié par un spécialiste avant tout usage.",
    timing:'Après prise de possession', composantes:['HVAC-001','MAC-001'],
    source:'INSP-P47-49', notes:'', priority:'Limité',
    actions:[
      { id:'a12-1', desc:"Vérifier le bon fonctionnement du climatiseur en saison chaude. Vérifier les dégagements d'installation. Nettoyer ou changer le filtre.", timing:"Avant l'été 2026", composantes:['HVAC-001'], source:'INSP-P48-49', notes:'', priority:'Limité' },
      { id:'a12-2', desc:"Faire vérifier par un spécialiste en chauffage la conformité, le bon fonctionnement et la sécurité du foyer et de la cheminée avant tout usage intensif.", timing:'Avant usage', composantes:['MAC-001'], source:'INSP-P47', notes:"Hors mandat d'inspection; spécialiste requis", priority:'Hors mandat' },
    ]},
  { id:'s13', name:'Intérieur – structure et finition', zone:'Intérieur',
    ceQueOnSait:"Fissures sur gypse (cause à identifier). Escaliers: contremarches inégales, garde-corps insuffisant. Risque amiante potentiel (bâtiment 1979, avant 1985). Sous l'escalier: étriers recommandés.",
    pourquoi:"Les fissures de gypse peuvent indiquer un mouvement structural. Les escaliers représentent un danger de chute.",
    timing:'Été 2026 / Plus tard', composantes:['GYPS-001','ESC-001','STR-001'],
    source:'INSP-P51-53', notes:'', priority:'Danger',
    actions:[
      { id:'a13-1', desc:"Identifier la cause des fissures sur le gypse (mouvement structural, infiltration ou mauvaise installation) et corriger. Si des travaux invasifs sont prévus, considérer un test amiante (bâtiment pré-1985).", timing:'Été 2026', composantes:['GYPS-001'], source:'INSP-P52', notes:'Test amiante si rénovation importante', priority:'Défaut' },
      { id:'a13-2', desc:"Corriger les contremarches inégales et le garde-corps insuffisant. Menuisier qualifié requis.", timing:'Été 2026', composantes:['ESC-001'], source:'INSP-P53', notes:'Danger potentiel', priority:'Danger' },
      { id:'a13-3', desc:"Ajouter des étriers (joist hangers) sur les poutres sous l'escalier pour renforcer les assemblages (optionnel mais recommandé).", timing:'Été 2026', composantes:['STR-001'], source:'NOTES-VISITE', notes:'Optionnel — faible coût', priority:'Défaut' },
    ]},
  { id:'s14', name:'Cuisine et aménagement intérieur', zone:'Cuisine / extérieur',
    ceQueOnSait:"Îlot mal nivelé à remplacer. Armoires vieillissantes (peinture prévue). Corde à linge fixée à la maison.",
    pourquoi:"L'îlot instable est un danger et nuit à l'usage. La corde à linge fixée peut endommager le revêtement et créer des infiltrations.",
    timing:'Été 2026 / Plus tard', composantes:['KIT-001','KIT-002','AMEN-001'],
    source:'NOTES-KIT; NOTES-VISITE', notes:'', priority:'—',
    actions:[
      { id:'a14-1', desc:"Retirer l'îlot actuel mal nivelé dès la prise de possession et le remplacer (voir onglet Achats pour sourcing IKEA SEKTION).", timing:'Dès prise de possession', composantes:['KIT-001'], source:'NOTES-KIT', notes:'Sourcing en cours dans onglet Achats', priority:'—' },
      { id:'a14-2', desc:"Peindre les armoires pour rafraîchissement. Planifier remplacement à moyen terme.", timing:'Plus tard', composantes:['KIT-002'], source:'NOTES-KIT', notes:'', priority:'—' },
      { id:'a14-3', desc:"Déplacer la corde à linge sur un poteau indépendant ancré au sol.", timing:'Été 2026', composantes:['AMEN-001'], source:'INSP-P16; NOTES-VISITE', notes:'Simple', priority:'Avertissement' },
    ]},
  { id:'s15', name:'Vérifications Jour 1 – prise de possession', zone:'Maison entière',
    ceQueOnSait:"Actions simples et rapides à effectuer dès la prise de possession pour documenter l'état de départ et identifier les urgences non visibles.",
    pourquoi:"Établir le baseline et ne pas être pris par surprise lors de la première utilisation.",
    timing:'Jour 1', composantes:['HVAC-001','SEC-003','PLOM-006','CLAP-001','ELEC-001'],
    source:'Notes visite', notes:'', priority:'Urgent',
    actions:[
      { id:'a15-1', desc:"Tester tous les éléments inclus (électroménagers, lumières, plomberie, fenêtres, serrures).", timing:'Jour 1', composantes:[], source:'Notes', notes:'', priority:'Urgent' },
      { id:'a15-2', desc:"Vérifier et tester les avertisseurs fumée et CO.", timing:'Jour 1', composantes:['SEC-003'], source:'INSP-P54', notes:'', priority:'Danger' },
      { id:'a15-3', desc:"Localiser et étiqueter la valve principale d'eau (sous l'escalier).", timing:'Jour 1', composantes:['PLOM-006'], source:'INSP-P31', notes:'', priority:'Défaut' },
      { id:'a15-4', desc:"Rechercher visuellement les clapets anti-retour (sous l'escalier et sous-sol).", timing:'Jour 1', composantes:['CLAP-001'], source:'INSP-P36-37', notes:'', priority:'Limité' },
      { id:'a15-5', desc:"Confirmer que l'espace devant le panneau électrique est libre (3 pieds).", timing:'Jour 1', composantes:['ELEC-001'], source:'INSP-P40', notes:'', priority:'Danger' },
    ]},
];

const MAINTENANCE = [
  { id:'M-01', season:'Printemps', zone:'Toiture', task:'Inspecter les scellants et les pénétrations', detail:"Monter au toit et vérifier l'état des joints autour des entrées d'air, sorties d'air (évents, hotte, sécheuse) et jonctions sensibles. Refaire le scellant si fissuré.", notes:'' },
  { id:'M-02', season:'Printemps + automne', zone:'Extérieur', task:'Nettoyer les gouttières', detail:"Vider les gouttières, vérifier que les descentes évacuent l'eau loin des fondations (plus de 4 pieds). Inspecter la gouttière gauche (ancienne fissure).", notes:'' },
  { id:'M-03', season:'Hiver', zone:'Entrée avant / façade', task:'Déneiger les zones critiques', detail:"Éviter l'accumulation de neige contre les fenêtres, la porte et la dalle avant. Pas de contact prolongé neige/mur.", notes:'' },
  { id:'M-04', season:'Après grosses tempêtes', zone:'Toiture', task:'Déneiger le toit si accumulation excessive', detail:"Limiter la surcharge de neige et prévenir la formation de digues de glace. Le poids de la neige a causé un léger affaissement du plafond dans le corridor.", notes:'Lié à OBS-001' },
  { id:'M-05', season:'Printemps', zone:'Fenêtres extérieures', task:'Inspecter le calfeutrage', detail:"Repérer les joints craqués ou décollés autour des fenêtres et portes extérieures. Refaire rapidement pour prévenir infiltrations.", notes:'' },
  { id:'M-06', season:'Printemps', zone:'Patio', task:'Vérifier les équerres, le bois et les garde-corps', detail:"Inspecter les points d'ancrage des équerres (scellant), vérifier l'état du bois du patio, confirmer que les garde-corps sont rigides.", notes:'Lié à PAT-ET-001; PAT-SEC-001' },
  { id:'M-07', season:'Printemps', zone:'Salle de bain sous-sol', task:"Tester l'étanchéité de la douche", detail:"Faire couler l'eau abondamment sur les murs et la porte. Vérifier l'absence de fuite à l'extérieur et inspecter le plancher adjacent.", notes:'Lié à SDBSS-001' },
  { id:'M-08', season:"Toute l'année", zone:'Salle de bain étage', task:"Éviter les produits chimiques agressifs sous l'évier", detail:"Ne pas entreposer de produits corrosifs (nettoyants acides, solvants) à proximité des flexibles et tuyaux de la salle de bain.", notes:'Lié à PLOM-004' },
  { id:'M-09', season:'Automne', zone:'Ventilation', task:'Vérifier et nettoyer les sorties extérieures', detail:"S'assurer que les sorties de ventilation (sécheuse, SDB, hotte une fois corrigée) ne sont pas obstruées par de la charpie ou des feuilles.", notes:'' },
  { id:'M-10', season:"Toute l'année", zone:'Salon / chauffage', task:'Maintenir la distance rideaux–calorifères', detail:"Vérifier qu'aucun textile ne touche les plinthes de chauffage, surtout dans le salon.", notes:'Lié à OBS-002' },
  { id:'M-11', season:'Printemps', zone:'Sous-sol', task:'Inspecter la plomberie visible', detail:"Regarder autour du chauffe-eau, des valves, des flexibles et de la plomberie visible. Repérer fuites, corrosion ou suintements.", notes:'Lié à PLOM-007; CH-EAU-001' },
  { id:'M-12', season:'Printemps', zone:'Corridor des chambres', task:'Surveiller le plafond', detail:"Vérifier si le léger affaissement visible a évolué ou si de nouvelles fissures sont apparues.", notes:'Lié à OBS-001' },
  { id:'M-13', season:'Printemps', zone:'Fondations / périmètre', task:'Surveiller efflorescence, fissures et crépi', detail:"Faire un tour complet du périmètre extérieur et du sous-sol. Repérer nouvelle humidité, efflorescence, fissure ou suintement.", notes:'Lié à FND-005; FND-006' },
  { id:'M-14', season:'Octobre', zone:'Sécurité', task:'Tester avertisseurs fumée et CO', detail:"Tester chaque appareil, changer les piles si requis. Se référer aux specs du fabricant pour le nombre et l'emplacement requis.", notes:'Lié à SEC-003' },
  { id:'M-15', season:'Avant premiers gels', zone:'Plomberie extérieure', task:'Fermer le robinet extérieur et hiverner', detail:"Localiser et fermer la valve de coupure du robinet extérieur. Purger si la configuration l'exige.", notes:'Lié à PL-EXT-002' },
  { id:'M-16', season:'Printemps', zone:'Chauffe-eau', task:'Vérifier la cuvette et drainer le chauffe-eau', detail:"Confirmer que la cuvette est sèche et le drain libre. Drainer partiellement le chauffe-eau selon les recommandations du fabricant pour éliminer les dépôts.", notes:'Lié à CH-EAU-001' },
  { id:'M-17', season:'Printemps', zone:'Fenêtres basses / margelles', task:'Nettoyer les margelles et vérifier le drainage', detail:"Enlever débris et confirmer que l'eau ne peut pas s'accumuler contre les fenêtres du sous-sol.", notes:'Lié à SITE-002; FEN-003' },
  { id:'M-18', season:'Printemps', zone:'Portes extérieures', task:'Lubrifier les coupe-froid et inspecter les seuils', detail:"Appliquer un lubrifiant silicone sur les coupe-froid. Vérifier que les seuils sont dégagés du sol et en bon état.", notes:'Lié à PORTE-001' },
  { id:'M-19', season:"Toute l'année", zone:'Plomberie visible', task:'Vérifier corrosion, suintements et flexibles', detail:"Regarder rapidement les sections visibles de cuivre, les raccords oxydés et les flexibles tressés.", notes:'Lié à PLOM-007' },
  { id:'M-20', season:'Printemps', zone:'Patio', task:'Vérifier rigidité des garde-corps et protection du bois', detail:"S'assurer que rien ne bouge. Appliquer un produit de protection si le bois est exposé.", notes:'Lié à PAT-SEC-001; PAT-STR-001' },
  { id:'M-21', season:'Printemps', zone:'Électricité', task:'Tester les prises GFCI / DDFT', detail:"Appuyer sur test/reset à chaque prise GFCI (zones humides: cuisines, salles de bain, extérieur).", notes:'Lié à ELEC-PRISE-001' },
  { id:'M-22', season:'Automne', zone:'Entretoit', task:'Inspecter trappe, isolant déplacé et condensation', detail:"Ouvrir la trappe et vérifier l'isolant, l'absence de givre ou d'humidité anormale, l'état des déflecteurs.", notes:'Lié à ISO-002; VENT-ATT-001' },
  { id:'M-23', season:'Printemps', zone:'Climatisation', task:'Vérifier et entretenir le climatiseur mural', detail:"Nettoyer ou changer le filtre. Vérifier les dégagements. Faire appel à un technicien si performance dégradée.", notes:'Lié à HVAC-001' },
  { id:'M-24', season:'Annuel', zone:'Sécurité / entretien', task:'Lubrifier serrures et charnières extérieures', detail:"Appliquer de la graisse ou du lubrifiant silicone sur toutes les serrures et charnières des portes extérieures.", notes:'Lié à SEC-001' },
];

const SHOPPING_SEED = [
  { project:'Îlot de cuisine', article:'SEKTION – base cabinet avec étagères / 2 portes, blanc/Ringhult blanc, 76x61x76 cm', magasin:'IKEA', prix_unitaire:224, qty:2, status:'En recherche', lien:'https://www.ikea.com/ca/en/p/sektion-base-cabinet-with-shelves-2-doors-white-ringhult-white-s79456681/', notes:"Option 1 – armoire profonde", is_seed:true, sort_order:1 },
  { project:'Îlot de cuisine', article:'SEKTION – base cabinet avec étagères / 2 portes, blanc/Veddinge blanc, 76x37x76 cm', magasin:'IKEA', prix_unitaire:164, qty:2, status:'En recherche', lien:'https://www.ikea.com/ca/en/p/sektion-base-cabinet-with-shelves-2-doors-white-veddinge-white-s09464868/', notes:"Option 2 – armoire plus mince", is_seed:true, sort_order:2 },
  { project:'Îlot de cuisine', article:'LOCKEBO – comptoir en composite de verre sur mesure', magasin:'IKEA', prix_unitaire:80, qty:20, status:'En recherche', lien:'https://www.ikea.com/ca/en/rooms/kitchen/lockebo-custom-glass-composite-kitchen-countertops-pubcc603c80/', notes:"Quantité à ajuster selon dimensions finales", is_seed:true, sort_order:3 },
  { project:'Salle de bain étage', article:'Panneau acrylique / système direct-to-stud pour bain-douche', magasin:'', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"Protection murale obligatoire avant usage comme douche (SDBET-001)", is_seed:true, sort_order:10 },
  { project:'Salle de bain étage', article:'Bain encastré de remplacement', magasin:'', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"À magasiner – dimensions actuelles à mesurer", is_seed:true, sort_order:11 },
  { project:'Salle de bain étage', article:'Robinetterie bain/douche', magasin:'', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"À sélectionner selon style retenu", is_seed:true, sort_order:12 },
  { project:'Salle de bain étage', article:"Ventilateur d'extraction avec sortie extérieure", magasin:'', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"À coordonner avec travaux hotte (SDBET-VENT-001)", is_seed:true, sort_order:13 },
  { project:'Peinture intérieure', article:'Peinture – pièces principales (salon, couloir, chambres)', magasin:'', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"Marque, quantité et couleurs à déterminer pièce par pièce", is_seed:true, sort_order:20 },
  { project:'Peinture intérieure', article:'Apprêt / primer si murs en gypse ancien', magasin:'', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"À évaluer selon état des murs (GYPS-001)", is_seed:true, sort_order:21 },
  { project:'Isolation entretoit', article:'Isolant en vrac (cellulose soufflée ou laine minérale) – viser R-40 à R-50', magasin:'', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"Soumission d'entrepreneur en isolation recommandée (ISO-001)", is_seed:true, sort_order:30 },
  { project:'Hotte de cuisine', article:'Conduit rigide en acier galvanisé + coudes + sortie murale', magasin:'Rona / Home Depot', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"Correctif urgent – hotte évacue dans l'entretoit (HOTTE-001)", is_seed:true, sort_order:40 },
  { project:'Sécurité incendie', article:'Globe protecteur pour luminaire à porcelaine (garde-robe bureau)', magasin:'Rona / IKEA', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"SEC-001 – correction simple", is_seed:true, sort_order:50 },
  { project:'Sécurité incendie', article:'Avertisseur de fumée / CO supplémentaire si manquant', magasin:'Canadian Tire', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"SEC-003 – vérifier nombre et emplacements requis", is_seed:true, sort_order:51 },
  { project:'Plomberie', article:'Valve à poignée (levier) pour entrée d\'eau principale', magasin:'Rona / plombier', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"PLOM-006 – remplacer valve rotative", is_seed:true, sort_order:60 },
  { project:'Plomberie', article:'Brise-vide / vacuum breaker pour robinet extérieur', magasin:'Rona / plombier', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"PL-EXT-002", is_seed:true, sort_order:61 },
  { project:'Plomberie', article:'Flexibles tressés de remplacement (lavabo + toilette étage)', magasin:'Rona / plombier', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"PLOM-004 – préventif", is_seed:true, sort_order:62 },
  { project:'Extérieur', article:'Scellant extérieur polymère (calfeutrage général)', magasin:'Rona / Home Depot', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"CALF-001 – pour joints de fenêtres et ouvertures", is_seed:true, sort_order:70 },
  { project:'Extérieur', article:'Produit de protection pour le bois du patio', magasin:'Rona / Home Depot', prix_unitaire:null, qty:1, status:'À trouver', lien:'', notes:"PAT-STR-001 – traiter bois restant après remplacement", is_seed:true, sort_order:71 },
];

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
const ss = {
  btn: { background:T.s2, border:`1px solid ${T.bd2}`, borderRadius:5, padding:'3px 9px', fontSize:11, fontWeight:500, color:T.tx2, cursor:'pointer', fontFamily:T.font },
  pill: (bg, tx) => ({ background:bg, color:tx, borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:600, whiteSpace:'nowrap', display:'inline-block' }),
};

const PriorityBadge = ({ p }) => {
  const c = PRIORITY[p] || PRIORITY['—'];
  return <span style={{ ...ss.pill(c.bg, c.tx), fontSize:9, padding:'1px 6px' }}>{p || '—'}</span>;
};
const WStatusBadge = ({ s }) => {
  const c = WSTATUS[s] || WSTATUS['À faire'];
  return <span style={ss.pill(c.bg, c.tx)}>{s}</span>;
};
const PStatusBadge = ({ s }) => {
  const c = PSTATUS[s] || PSTATUS['À trouver'];
  return <span style={ss.pill(c.bg, c.tx)}>{s}</span>;
};
const TimingBadge = ({ t }) => {
  if (!t) return null;
  const c = timingStyle(t);
  return <span style={{ ...ss.pill(c.bg, c.tx), fontSize:9 }}>{t}</span>;
};

// ─── RESPONSIVE SHELL HOOK ──────────────────────────────────────────────────────
function useIsDesktop() {
  const q = '(min-width: 820px)';
  const get = () => typeof window !== 'undefined' && window.matchMedia(q).matches;
  const [d, setD] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = e => setD(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on); };
  }, []);
  return d;
}

// ─── PROJETS HELPERS ────────────────────────────────────────────────────────────
const money = n => n == null ? 'à chiffrer' : n.toLocaleString('fr-CA', { style:'currency', currency:'CAD', maximumFractionDigits:0 });

const sysProgress = (sys, statuses) => {
  const total = sys.actions.length;
  const done = sys.actions.filter(a => (statuses[a.id] || a.status) === 'Fait').length;
  return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
};

const orderActions = acts => acts.slice().sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));

// ─── DATE HELPERS (scheduling) ──────────────────────────────────────────────────
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toISO = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const startOfWeek = d => { const x = new Date(d); const dow = (x.getDay() + 6) % 7; return addDays(x, -dow); };
const weekDates = mon => Array.from({ length:7 }, (_, i) => toISO(addDays(mon, i)));
const DOW_FR = ['lun','mar','mer','jeu','ven','sam','dim'];
const MON_FR = ['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc'];
const dayNum = iso => Number(iso.split('-')[2]);
const monShort = iso => MON_FR[Number(iso.split('-')[1]) - 1];
const todayISO = () => toISO(new Date());
const isToday = iso => iso === todayISO();

// Interim material-to-project association for Session 1. The canonical link is the
// union of action.materialIds (blueprint 3.3), but those are seeded empty until
// Session 4, so we fall back to the material's existing project text.
const MAT_PROJECT_TO_SYS = {
  'Îlot de cuisine':'s14', 'Peinture intérieure':'s14', 'Salle de bain étage':'s11',
  'Isolation entretoit':'s10', 'Hotte de cuisine':'s9', 'Sécurité incendie':'s8',
  'Plomberie':'s6', 'Extérieur':'s2',
};
function projectMaterials(sys, materials) {
  const ids = new Set(sys.actions.flatMap(a => a.materialIds || []));
  let matched = ids.size ? materials.filter(m => ids.has(m.id)) : [];
  if (!matched.length) {
    matched = materials.filter(m => {
      const mapped = MAT_PROJECT_TO_SYS[m.project];
      if (mapped) return mapped === sys.id;
      const p = (m.project || '').toLowerCase();
      return p && sys.name.toLowerCase().includes(p);
    });
  }
  const subtotal = matched.reduce((s, m) => s + (m.prix_unitaire ? m.prix_unitaire * (m.qty || 1) : 0), 0);
  return { matched, subtotal };
}

function runItems(run, materials) {
  const items = (run.materialIds || []).map(id => materials.find(m => m.id === id)).filter(Boolean);
  const subtotal = items.reduce((s, m) => s + (m.prix_unitaire ? m.prix_unitaire * (m.qty || 1) : 0), 0);
  const allBought = items.length > 0 && items.every(m => m.bought);
  return { items, subtotal, allBought };
}

const MatRow = ({ m, onRemove }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 0', borderBottom:`1px solid ${T.bd}` }}>
    <span style={{ flex:1, fontSize:12.5, color:T.tx }}>{m.article}</span>
    {m.qty > 1 && <span style={{ fontSize:11, color:T.tx3, fontFamily:T.mono }}>x{m.qty}</span>}
    <span style={{ fontSize:12, color:T.y, fontFamily:T.mono, minWidth:60, textAlign:'right' }}>
      {money(m.prix_unitaire ? m.prix_unitaire * (m.qty || 1) : null)}
    </span>
    {onRemove && (
      <button onClick={onRemove} title="Retirer du plan" style={{ background:'transparent', border:'none', cursor:'pointer', color:T.tx3, fontSize:14, padding:0, lineHeight:1, flexShrink:0 }}
        onMouseEnter={e => e.currentTarget.style.color = T.r} onMouseLeave={e => e.currentTarget.style.color = T.tx3}>×</button>
    )}
  </div>
);

const SubtotalRow = ({ label, value }) => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:T.s2, border:`1px solid ${T.bd2}`, borderRadius:9, padding:'11px 13px', marginTop:14 }}>
    <span style={{ fontSize:12, color:T.tx2 }}>{label}</span>
    <span style={{ fontSize:16, color:T.y, fontFamily:T.mono, fontWeight:600 }}>{money(value)}</span>
  </div>
);

const PlanBadge = ({ steps }) => {
  const ready = (steps?.length || 0) > 0;
  return (
    <span style={{ fontSize:10, padding:'2px 7px', borderRadius:5,
      background: ready ? 'rgba(63,182,139,0.12)' : 'rgba(62,74,90,0.18)', color: ready ? T.g : T.tx2 }}>
      {ready ? `Plan prêt · ${steps.length} étapes` : 'Plan à venir'}
    </span>
  );
};

const SectionLab = ({ children, style }) => (
  <div style={{ fontSize:10, fontWeight:700, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 8px', ...style }}>{children}</div>
);

const BackBtn = ({ label, onClick }) => (
  <button onClick={onClick} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'none', border:'none', color:T.tx2, fontSize:12, fontFamily:T.font, padding:0, marginBottom:12, cursor:'pointer' }}>‹ {label}</button>
);

// ─── PROJECT LIST ───────────────────────────────────────────────────────────────
function ProjectList({ systems, statuses, selProject, onSelect, embedded }) {
  const ordered = systems.slice().sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
  return (
    <div style={{ padding: embedded ? '10px' : '14px 14px 24px' }}>
      {!embedded && <div style={{ fontSize:10, fontWeight:700, color:T.tx3, letterSpacing:'0.07em', textTransform:'uppercase', margin:'2px 0 4px' }}>Projets</div>}
      {!embedded && <div style={{ fontSize:11, color:T.tx3, marginBottom:12 }}>Choisis un chantier pour voir son plan et ses matériaux.</div>}
      {ordered.map(sys => {
        const pc = PRIORITY[sys.priority] || PRIORITY['—'];
        const { done, total, pct } = sysProgress(sys, statuses);
        const sel = selProject === sys.id;
        return (
          <div key={sys.id} onClick={() => onSelect(sys.id)}
            style={{ background: sel ? T.s2 : T.s1, border:`1px solid ${sel ? T.acc : T.bd}`, borderLeft:`3px solid ${pc.tx}`,
              borderRadius:10, padding:'13px 14px', marginBottom:9, cursor:'pointer' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ fontSize:14.5, fontWeight:600, color:T.tx, lineHeight:1.3, flex:1 }}>{sys.name}</div>
              <span style={{ color:T.tx3, fontSize:18 }}>›</span>
            </div>
            <div style={{ fontSize:11.5, color:T.tx2, margin:'3px 0 9px' }}>{sys.zone}</div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <PriorityBadge p={sys.priority} />
              <span style={{ fontSize:11, color:T.tx3 }}>{total} action{total > 1 ? 's' : ''}</span>
              <span style={{ marginLeft:'auto', fontSize:11, color: done === total && total > 0 ? T.g : T.tx3, fontFamily:T.mono }}>{done}/{total}</span>
            </div>
            <div style={{ height:5, borderRadius:3, background:T.s3, overflow:'hidden', marginTop:9 }}>
              <div style={{ height:'100%', width:`${pct}%`, background:T.g }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── PROJECT DASHBOARD ──────────────────────────────────────────────────────────
function ProjectDashboard({ system, statuses, materials, onOpenAction, onBack }) {
  const { done, total } = sysProgress(system, statuses);
  const acts = orderActions(system.actions);
  const { matched, subtotal } = projectMaterials(system, materials);
  return (
    <div style={{ padding:'14px 16px 28px', maxWidth:760, margin:'0 auto', width:'100%', boxSizing:'border-box' }}>
      {onBack && <BackBtn label="Projets" onClick={onBack} />}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <PriorityBadge p={system.priority} />
        <span style={{ marginLeft:'auto', fontSize:11, color: done === total && total > 0 ? T.g : T.tx3, fontFamily:T.mono }}>{done}/{total} fait</span>
      </div>
      <div style={{ fontSize:18, fontWeight:700, color:T.tx, lineHeight:1.25, marginBottom:4 }}>{system.name}</div>
      <div style={{ fontSize:12, color:T.tx2, marginBottom:14 }}>{system.zone}</div>

      <div style={{ background:T.s1, border:`1px solid ${T.bd}`, borderRadius:9, padding:'11px 12px', marginBottom:10 }}>
        <SectionLab style={{ margin:'0 0 6px' }}>Ce que l'on sait</SectionLab>
        <div style={{ fontSize:12.5, color:T.tx2, lineHeight:1.65 }}>{system.ceQueOnSait}</div>
      </div>
      <div style={{ background:T.s1, border:`1px solid ${T.bd}`, borderRadius:9, padding:'11px 12px', marginBottom:10 }}>
        <SectionLab style={{ margin:'0 0 6px' }}>Pourquoi c'est important</SectionLab>
        <div style={{ fontSize:12.5, color:T.tx2, lineHeight:1.65 }}>{system.pourquoi}</div>
      </div>

      <SectionLab style={{ margin:'18px 0 8px' }}>Actions à réaliser</SectionLab>
      {acts.map(a => {
        const ac = PRIORITY[a.priority] || PRIORITY['—'];
        const st = statuses[a.id] || a.status;
        return (
          <div key={a.id} onClick={() => onOpenAction(a.id)}
            style={{ background:T.s1, border:`1px solid ${T.bd}`, borderLeft:`3px solid ${ac.tx}`, borderRadius:10, padding:'12px 13px', marginBottom:8, cursor:'pointer' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
              <div style={{ flex:1, fontSize:12.5, color: st === 'Fait' ? T.tx3 : T.tx, fontWeight:500, lineHeight:1.45, textDecoration: st === 'Fait' ? 'line-through' : 'none' }}>{a.desc}</div>
              <span style={{ color:T.tx3, fontSize:18, lineHeight:1 }}>›</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:8, flexWrap:'wrap' }}>
              <PriorityBadge p={a.priority} />
              <PlanBadge steps={a.steps} />
              <span style={{ marginLeft:'auto' }}><WStatusBadge s={st} /></span>
            </div>
          </div>
        );
      })}

      <SectionLab style={{ margin:'18px 0 6px' }}>Matériaux du projet</SectionLab>
      {matched.length ? (
        <>
          {matched.map(m => <MatRow key={m.id} m={m} />)}
          <SubtotalRow label="Matériaux de ce projet" value={subtotal} />
        </>
      ) : (
        <div style={{ fontSize:11.5, color:T.tx3, fontStyle:'italic' }}>Aucun matériau lié pour l'instant.</div>
      )}
    </div>
  );
}

// ─── SECTION 7 PLAN PARSER ──────────────────────────────────────────────────────
// Tolerant parser for the authoring format (blueprint section 7). Turns an
// ACTION / PRÉCAUTIONS / ÉTAPES / MATÉRIAUX block into { steps, cautions, materials }.
const stripAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const planHeader = line => {
  const h = stripAccents(line.split(':')[0].trim()).toUpperCase();
  if (h === 'ACTION') return 'action';
  if (h === 'PRECAUTIONS') return 'cautions';
  if (h === 'ETAPES') return 'steps';
  if (h === 'MATERIAUX' || h === 'MATERIEL' || h === 'MATERIELS') return 'materials';
  return null;
};
function parseMaterialLine(line) {
  let str = line.replace(/^[-•*]\s*/, '').trim();
  let magasin = '', prix = null, qty = 1;
  const paren = str.match(/\(([^)]*)\)/);
  if (paren) {
    str = str.replace(paren[0], '').trim();
    paren[1].split(',').forEach(tok => {
      const t = tok.trim();
      if (!t) return;
      const q = t.match(/^x\s*(\d+)$/i);
      const p = t.match(/(\d+(?:[.,]\d+)?)/);
      if (q) qty = parseInt(q[1], 10);
      else if (/[$]/.test(t) || /^~/.test(t)) { if (p) prix = parseFloat(p[1].replace(',', '.')); }
      else if (!magasin) magasin = t;
    });
  }
  const qm = str.match(/\bx\s*(\d+)\b/i);
  if (qm) { qty = parseInt(qm[1], 10); str = str.replace(qm[0], '').trim(); }
  if (prix == null) {
    const pm = str.match(/~?\s*(\d+(?:[.,]\d+)?)\s*\$/);
    if (pm) { prix = parseFloat(pm[1].replace(',', '.')); str = str.replace(pm[0], '').trim(); }
  }
  str = str.replace(/[,\s]+$/, '').trim();
  return { article: str, magasin, prix_unitaire: prix, qty };
}
function parseActionPlan(raw) {
  const lines = (raw || '').split(/\r?\n/);
  const steps = [], cautions = [], materials = [];
  let section = null, cur = null, lastField = null;
  let hasSteps = false, hasCautions = false, hasMaterials = false;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const head = planHeader(trimmed);
    if (head) {
      section = head; cur = null; lastField = null;
      if (head === 'cautions') hasCautions = true;
      if (head === 'steps') hasSteps = true;
      if (head === 'materials') hasMaterials = true;
      continue;
    }
    if (section === 'cautions') {
      const c = trimmed.replace(/^[-•*]\s*/, '').trim();
      if (c) cautions.push(c);
    } else if (section === 'materials') {
      const m = parseMaterialLine(trimmed);
      if (m.article) materials.push(m);
    } else if (section === 'steps') {
      const num = trimmed.match(/^(\d+)[.)]\s*(.*)$/);
      if (num) {
        cur = { text: num[2].trim(), detail: '', material: '', caution: '' };
        steps.push(cur); lastField = 'text';
      } else {
        const sub = trimmed.match(/^(d[ée]tail|mat[ée]riel|material|caution|pr[ée]caution)\s*:\s*(.*)$/i);
        if (sub && cur) {
          const key = stripAccents(sub[1]).toLowerCase();
          const val = sub[2].trim();
          if (key.startsWith('detail')) { cur.detail = val; lastField = 'detail'; }
          else if (key.startsWith('mat')) { cur.material = val; lastField = 'material'; }
          else { cur.caution = val; lastField = 'caution'; }
        } else if (cur) {
          const f = lastField || 'text';
          cur[f] = (cur[f] ? cur[f] + ' ' : '') + trimmed;
        }
      }
    }
  }
  return { steps, cautions, materials, hasSteps, hasCautions, hasMaterials };
}

// ─── QUICK-ADD PARSER (Session 5 capture) ───────────────────────────────────────
// Pure functions: turn one short French sentence into a single proposed change.
// Intent order: run -> log (explicit verb/colon) -> schedule (verb or date) -> material (default).
const DOW_FULL = { dimanche:0, lundi:1, mardi:2, mercredi:3, jeudi:4, vendredi:5, samedi:6 };
const DOW_ABBR = { dim:0, lun:1, mar:2, mer:3, jeu:4, ven:5, sam:6 };
const MONTHS_FULL = { janvier:0, fevrier:1, mars:2, avril:3, mai:4, juin:5, juillet:6, aout:7, septembre:8, octobre:9, novembre:10, decembre:11 };
const STORE_RE = /\bchez\s+([A-ZÀ-Ý][\wÀ-ÿ.'’\-]*(?:\s+[A-ZÀ-Ý][\wÀ-ÿ.'’\-]*){0,2})/;

function parseFrDate(token) {
  if (!token) return null;
  const t = stripAccents(String(token)).toLowerCase().trim();
  if (!t) return null;
  const iso = t.match(/(\d{4}-\d{2}-\d{2})/); if (iso) return iso[1];
  if (/aujourd'?hui|aujourdhui/.test(t)) return todayISO();
  if (/apres[- ]demain/.test(t)) return toISO(addDays(new Date(), 2));
  if (/\bdemain\b/.test(t)) return toISO(addDays(new Date(), 1));
  const dn = t.match(/\b(dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi|dim|lun|mar|mer|jeu|ven|sam)\b/);
  if (dn) { const w = (DOW_FULL[dn[1]] != null) ? DOW_FULL[dn[1]] : DOW_ABBR[dn[1]]; const now = new Date(); const diff = (w - now.getDay() + 7) % 7; return toISO(addDays(now, diff)); }
  const dm = t.match(/\b(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b(?:\s+(\d{4}))?/);
  if (dm) { const day = parseInt(dm[1], 10), mon = MONTHS_FULL[dm[2]]; const now = new Date(); const year = dm[3] ? parseInt(dm[3], 10) : now.getFullYear(); let d = new Date(year, mon, day); if (!dm[3] && toISO(d) < todayISO()) d = new Date(year + 1, mon, day); return toISO(d); }
  const dom = t.match(/\ble\s+(\d{1,2})\b/) || t.match(/^(\d{1,2})$/);
  if (dom) { const day = parseInt(dom[1], 10), now = new Date(); let d = new Date(now.getFullYear(), now.getMonth(), day); if (toISO(d) < todayISO()) d = new Date(now.getFullYear(), now.getMonth() + 1, day); return toISO(d); }
  return null;
}
const DATE_RE = /\d{4}-\d{2}-\d{2}|aujourd'?hui|apres[- ]demain|\bdemain\b|\b(?:dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi|dim|lun|mar|mer|jeu|ven|sam)\b|\b\d{1,2}\s+(?:janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+\d{4})?\b|\ble\s+\d{1,2}\b/;
function findDate(text) {
  const t = stripAccents(String(text || '')).toLowerCase();
  const m = t.match(DATE_RE);
  if (!m) return { iso: null };
  const iso = parseFrDate(m[0]);
  return iso ? { iso, token: m[0] } : { iso: null };
}
function extractMaterial(text) {
  let s = String(text || '').trim().replace(/^(?:ajoute[rz]?|achete[rz]?|acheter|add|mettre|met)\s+/i, '').trim();
  let project = '', magasin = '', prix_unitaire = null, qty = 1;
  const pourM = s.match(/\bpour\s+([^,]+?)\s*$/i);
  if (pourM) { project = pourM[1].trim(); s = s.slice(0, pourM.index).trim(); }
  const chezM = s.match(STORE_RE);
  if (chezM) { magasin = chezM[1].trim(); s = (s.slice(0, chezM.index) + ' ' + s.slice(chezM.index + chezM[0].length)).trim(); }
  const qtyM = s.match(/\bx\s*(\d+)\b/i);
  if (qtyM) { qty = parseInt(qtyM[1], 10); s = (s.slice(0, qtyM.index) + ' ' + s.slice(qtyM.index + qtyM[0].length)).trim(); }
  const prixM = s.match(/~?\s*(\d+(?:[.,]\d+)?)\s*\$/);
  if (prixM) { prix_unitaire = parseFloat(prixM[1].replace(',', '.')); s = (s.slice(0, prixM.index) + ' ' + s.slice(prixM.index + prixM[0].length)).trim(); }
  s = s.replace(/\s{2,}/g, ' ').replace(/[,\s]+$/, '').replace(/^[,\s]+/, '').trim();
  return { article: s, magasin, prix_unitaire, qty, project };
}
function extractRun(text) {
  const s = String(text || '').trim();
  let m = s.match(/^(.*?)\s*(?:dans|à|a)\b\s+(?:la\s+)?courses?\b(.*)$/i);
  if (!m) m = s.match(/^(.*?)\bcourses?\b(.*)$/i);
  let itemsPart = m ? m[1] : s;
  itemsPart = itemsPart.replace(/^(?:ajoute[rz]?|achete[rz]?|acheter|add|mettre|met)\s+/i, '').trim().replace(/[,\s]+$/, '');
  const chezM = s.match(STORE_RE);
  const magasin = chezM ? chezM[1].trim() : '';
  const dt = findDate(s);
  const rawItems = itemsPart.split(/\s+et\s+|,|\+/i).map(x => x.trim()).filter(Boolean);
  const items = rawItems.map(x => { const mm = extractMaterial(x); return { article: mm.article, magasin: mm.magasin, prix_unitaire: mm.prix_unitaire, qty: mm.qty }; }).filter(it => it.article);
  return { items, magasin, dateISO: dt.iso || null };
}
function parseQuickAdd(text) {
  const raw = String(text || '').trim();
  if (!raw) return { intent: null };
  const low = stripAccents(raw).toLowerCase();
  if (/\bcourses?\b/.test(low)) return { intent: 'run', run: extractRun(raw) };
  let lm = raw.match(/^(?:journal|note|noter|consigner|log)\s+sur\s+(.+?)\s*:\s*(.+)$/i);
  if (lm) return { intent: 'log', log: { targetQuery: stripAccents(lm[1]).toLowerCase().trim(), text: lm[2].trim() } };
  lm = raw.match(/^(?:journal|note|noter|consigner|log)\s*:\s*(.+)$/i) || raw.match(/^(?:journal|note|noter|consigner|log)\s+(.+)$/i);
  if (lm) return { intent: 'log', log: { targetQuery: '', text: lm[1].trim() } };
  const schedVerb = /\b(planifie|planifier|cedule|ceduler|programme|programmer|prevoir|prevois)\b/.test(low);
  const dt = findDate(raw);
  if (schedVerb || dt.iso) {
    let q = low.replace(/\b(planifie|planifier|cedule|ceduler|programme|programmer|prevoir|prevois)\b/g, ' ');
    if (dt.token) q = q.replace(dt.token, ' ');
    q = q.replace(/\b(le|la|les|l|pour|au|aux|du|des|de|d|cette|ce|action|tache)\b/g, ' ').replace(/\s+/g, ' ').trim();
    return { intent: 'schedule', schedule: { dateISO: dt.iso || null, targetQuery: q, schedVerb, needDate: !dt.iso } };
  }
  const colon = raw.match(/^(.+?)\s*:\s*(.+)$/);
  if (colon) return { intent: 'log', log: { targetQuery: stripAccents(colon[1]).toLowerCase().trim(), text: colon[2].trim(), soft: true } };
  return { intent: 'material', material: extractMaterial(raw) };
}

// Flatten every action with its system name (for the quick-add target picker).
function flatActions(systems) {
  const all = [];
  (systems || []).forEach(s => (s.actions || []).forEach(a => all.push({ id: a.id, desc: a.desc, sysName: s.name })));
  return all;
}
// Resolve an action by id token or accent-insensitive substring of desc. Returns only real
// matches (best first); empty array when the query is blank or nothing matches, so the caller
// can fall back to the open action or force Karl to pick.
function resolveActions(query, systems) {
  const q = stripAccents(String(query || '')).toLowerCase().trim();
  if (!q) return [];
  const all = flatActions(systems);
  const byId = all.filter(a => a.id.toLowerCase() === q);
  if (byId.length) return byId;
  return all.filter(a => stripAccents(a.desc || '').toLowerCase().includes(q));
}
function resolveMaterial(query, materials) {
  const q = stripAccents(String(query || '')).toLowerCase().trim();
  if (!q) return null;
  const list = materials || [];
  return list.find(m => m.id.toLowerCase() === q)
    || list.find(m => stripAccents(m.article || '').toLowerCase().includes(q))
    || null;
}

// ─── ACTION VIEW (execution screen, Session 3) ──────────────────────────────────
function ActionView({ system, action, status, onStatusChange, onBack, backLabel, schedule, onSchedule,
  materials = [], stepsDone = {}, onToggleStep, onAddLog, onLinkMaterial, onAddMaterial, onUnlinkMaterial, onApplyPlan }) {
  const wc = WSTATUS[status] || WSTATUS['À faire'];
  const steps = action.steps || [];
  const cautions = action.cautions || [];
  const linkedIds = action.materialIds || [];
  const linkedMats = linkedIds.map(id => materials.find(m => m.id === id)).filter(Boolean);
  const matSubtotal = linkedMats.reduce((s, m) => s + (m.prix_unitaire ? m.prix_unitaire * (m.qty || 1) : 0), 0);
  const unlinkedMats = materials.filter(m => !linkedIds.includes(m.id));
  const log = action.log || [];
  const doneOf = s => (s.id && stepsDone[`${action.id}:${s.id}`] != null) ? stepsDone[`${action.id}:${s.id}`] : !!s.done;
  const doneCount = steps.filter(doneOf).length;

  const [expanded, setExpanded] = useState({});
  const [logText, setLogText] = useState('');
  const [matMode, setMatMode] = useState(null);
  const [linkSel, setLinkSel] = useState('');
  const [newMat, setNewMat] = useState({ article:'', magasin:'', prix_unitaire:'', qty:1 });
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteErr, setPasteErr] = useState('');

  useEffect(() => {
    setExpanded({}); setLogText(''); setMatMode(null); setLinkSel('');
    setNewMat({ article:'', magasin:'', prix_unitaire:'', qty:1 });
    setShowPaste(false); setPasteText(''); setPasteErr('');
  }, [action.id]);

  const inpStyle = { background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:5, padding:'6px 9px', fontSize:12, color:T.tx, fontFamily:T.font, outline:'none', boxSizing:'border-box' };
  const fmtLog = iso => { const d = new Date(iso); return `${d.toLocaleDateString('fr-CA', { month:'short', day:'numeric' })} ${d.toLocaleTimeString('fr-CA', { hour:'2-digit', minute:'2-digit' })}`; };

  const submitLog = () => { const t = logText.trim(); if (!t || !onAddLog) return; onAddLog(action.id, t); setLogText(''); };
  const submitLink = () => { if (!linkSel || !onLinkMaterial) return; onLinkMaterial(action.id, linkSel); setLinkSel(''); setMatMode(null); };
  const submitNewMat = () => {
    const article = newMat.article.trim();
    if (!article || !onAddMaterial) return;
    onAddMaterial(action.id, {
      article, magasin: newMat.magasin.trim(),
      prix_unitaire: newMat.prix_unitaire !== '' ? parseFloat(newMat.prix_unitaire) : null,
      qty: parseInt(newMat.qty, 10) || 1,
    }, system.name);
    setNewMat({ article:'', magasin:'', prix_unitaire:'', qty:1 }); setMatMode(null);
  };
  const applyPaste = () => {
    const parsed = parseActionPlan(pasteText);
    if (!parsed.hasSteps && !parsed.hasCautions && !parsed.hasMaterials) {
      setPasteErr('Format non reconnu. Utilise les sections ÉTAPES, PRÉCAUTIONS, MATÉRIAUX.'); return;
    }
    if (onApplyPlan) onApplyPlan(action.id, parsed, system.name);
    setPasteText(''); setShowPaste(false); setPasteErr('');
  };

  const pasteBlock = showPaste && (
    <div style={{ background:T.s1, border:`1px solid ${T.bd2}`, borderRadius:9, padding:'11px 12px', marginBottom:12 }}>
      <SectionLab style={{ margin:'0 0 6px' }}>Coller un plan</SectionLab>
      <div style={{ fontSize:11, color:T.tx3, lineHeight:1.5, marginBottom:8 }}>Sections ÉTAPES (étapes numérotées avec detail: / material: / caution:), PRÉCAUTIONS, MATÉRIAUX.</div>
      <textarea value={pasteText} onChange={e => { setPasteText(e.target.value); if (pasteErr) setPasteErr(''); }} rows={8}
        placeholder={"ÉTAPES:\n  1. ...\n     material: ...\nMATÉRIAUX:\n  - ... x2 (Rona, ~25$)"}
        style={{ width:'100%', boxSizing:'border-box', background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:6, padding:'8px 10px', fontSize:12, color:T.tx, fontFamily:T.mono, outline:'none', lineHeight:1.5, resize:'vertical' }} />
      {pasteErr && <div style={{ fontSize:11, color:T.r, marginTop:6 }}>{pasteErr}</div>}
      <div style={{ display:'flex', gap:7, marginTop:8 }}>
        <button onClick={applyPaste} disabled={!pasteText.trim()} style={{ ...ss.btn, color: pasteText.trim() ? T.g : T.tx3, border:`1px solid ${pasteText.trim() ? T.g + '44' : T.bd}`, background: pasteText.trim() ? 'rgba(63,182,139,0.12)' : T.s3 }}>Appliquer le plan</button>
        <button onClick={() => { setShowPaste(false); setPasteErr(''); }} style={ss.btn}>Annuler</button>
      </div>
    </div>
  );

  return (
    <div style={{ padding:'14px 16px 28px', maxWidth:760, margin:'0 auto', width:'100%', boxSizing:'border-box' }}>
      <BackBtn label={backLabel || system.name} onClick={onBack} />
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <PriorityBadge p={action.priority} />
        <span style={{ marginLeft:'auto' }}><PlanBadge steps={steps} /></span>
      </div>
      <div style={{ fontSize:18, fontWeight:700, color:T.tx, lineHeight:1.25, marginBottom:14 }}>{action.desc}</div>

      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <span style={{ fontSize:11, fontWeight:600, color:T.tx3 }}>Statut</span>
        <select value={status} onChange={e => onStatusChange(action.id, e.target.value)}
          style={{ background:wc.bg, color:wc.tx, border:`1px solid ${wc.tx}44`, borderRadius:5, padding:'5px 9px', fontSize:12, cursor:'pointer', fontFamily:T.font, outline:'none' }}>
          {['À faire','En cours','Fait','Reporté','À confirmer','Sans objet'].map(o => <option key={o}>{o}</option>)}
        </select>
      </div>

      <PlanifierControl value={schedule} onSet={onSchedule} />

      {cautions.length > 0 && (
        <div style={{ background:'rgba(217,95,95,0.07)', border:`1px solid rgba(217,95,95,0.22)`, borderRadius:9, padding:'11px 12px', marginBottom:12 }}>
          <SectionLab style={{ color:T.r, margin:'0 0 6px' }}>Précautions</SectionLab>
          <ul style={{ margin:0, paddingLeft:16 }}>
            {cautions.map((c, i) => <li key={i} style={{ fontSize:12, color:'#e9b0a6', lineHeight:1.6, marginBottom:3 }}>{c}</li>)}
          </ul>
        </div>
      )}

      {steps.length > 0 ? (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:8, margin:'6px 0 6px' }}>
            <SectionLab style={{ margin:0 }}>Étapes</SectionLab>
            <span style={{ fontSize:10.5, color: doneCount === steps.length ? T.g : T.tx3, fontFamily:T.mono, marginLeft:'auto' }}>{doneCount} / {steps.length} faites</span>
          </div>
          <div style={{ marginBottom:8 }}>
            {steps.map((s, i) => {
              const key = s.id || i;
              const done = doneOf(s);
              const open = !!expanded[key];
              const hasDetail = !!s.detail;
              return (
                <div key={key} style={{ display:'flex', gap:10, padding:'11px 0', borderBottom:`1px solid ${T.bd}` }}>
                  <button onClick={() => onToggleStep && onToggleStep(action.id, s.id)} title={done ? 'Marquer à faire' : 'Marquer faite'}
                    style={{ flexShrink:0, width:24, height:24, borderRadius:'50%', background: done ? 'rgba(63,182,139,0.16)' : T.s3, border:`1px solid ${done ? T.g : T.bd2}`, color: done ? T.g : T.acc, fontSize:12, fontWeight:600, fontFamily:T.mono, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}>
                    {done ? '✓' : i + 1}
                  </button>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div onClick={() => hasDetail && setExpanded(p => ({ ...p, [key]: !open }))}
                      style={{ fontSize:13, color: done ? T.tx3 : T.tx, lineHeight:1.45, textDecoration: done ? 'line-through' : 'none', cursor: hasDetail ? 'pointer' : 'default', display:'flex', gap:6, alignItems:'baseline' }}>
                      <span style={{ flex:1 }}>{s.text}</span>
                      {hasDetail && <span style={{ fontSize:10, color:T.tx3, flexShrink:0 }}>{open ? '▾' : '▸'}</span>}
                    </div>
                    {open && s.detail && <div style={{ fontSize:11.5, color:T.tx3, lineHeight:1.55, marginTop:4 }}>{s.detail}</div>}
                    {(s.material || s.caution) && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:6 }}>
                        {s.material && <span style={{ fontSize:10.5, background:'rgba(91,156,246,0.10)', color:T.acc, border:`1px solid rgba(91,156,246,0.22)`, padding:'2px 7px', borderRadius:5 }}>⛬ {s.material}</span>}
                        {s.caution && <span style={{ fontSize:10.5, background:'rgba(217,95,95,0.11)', color:'#e98a78', border:`1px solid rgba(217,95,95,0.25)`, padding:'2px 7px', borderRadius:5 }}>⚠ {s.caution}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={() => setShowPaste(v => !v)} style={{ ...ss.btn, marginBottom:12 }}>Coller un plan (remplacer les étapes)</button>
          {pasteBlock}
        </>
      ) : (
        <>
          <div style={{ background:T.s1, border:`1px solid ${T.bd}`, borderRadius:9, padding:'18px 16px', textAlign:'center', marginBottom:12 }}>
            <div style={{ fontSize:12.5, color:T.tx2, lineHeight:1.6 }}>Le plan détaillé de cette action n'est pas encore rédigé.</div>
            {!showPaste && <button onClick={() => setShowPaste(true)} style={{ ...ss.btn, marginTop:12, color:T.acc, border:`1px solid rgba(91,156,246,0.25)`, background:'rgba(91,156,246,0.08)' }}>+ Coller un plan</button>}
          </div>
          {pasteBlock}
        </>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:8, margin:'18px 0 4px' }}>
        <SectionLab style={{ margin:0 }}>Matériaux</SectionLab>
      </div>
      {linkedMats.length > 0 ? (
        <>
          {linkedMats.map(m => <MatRow key={m.id} m={m} onRemove={() => onUnlinkMaterial && onUnlinkMaterial(action.id, m.id)} />)}
          <SubtotalRow label="Matériaux de cette action" value={matSubtotal} />
        </>
      ) : (
        <div style={{ fontSize:11.5, color:T.tx3, fontStyle:'italic' }}>Aucun matériau lié à cette action.</div>
      )}
      {matMode === null && (
        <button onClick={() => setMatMode(unlinkedMats.length ? 'link' : 'new')} style={{ ...ss.btn, marginTop:10, color:T.acc }}>+ Ajouter un matériau</button>
      )}
      {matMode !== null && (
        <div style={{ background:T.s1, border:`1px solid ${T.bd2}`, borderRadius:9, padding:'11px 12px', marginTop:10 }}>
          <div style={{ display:'flex', gap:6, marginBottom:10 }}>
            <button onClick={() => unlinkedMats.length && setMatMode('link')} disabled={!unlinkedMats.length} style={{ ...ss.btn, color: matMode === 'link' ? T.acc : T.tx3, border:`1px solid ${matMode === 'link' ? T.acc : T.bd2}`, opacity: unlinkedMats.length ? 1 : 0.5 }}>Lier un existant</button>
            <button onClick={() => setMatMode('new')} style={{ ...ss.btn, color: matMode === 'new' ? T.acc : T.tx3, border:`1px solid ${matMode === 'new' ? T.acc : T.bd2}` }}>Nouveau</button>
            <button onClick={() => setMatMode(null)} style={{ ...ss.btn, marginLeft:'auto' }}>Fermer</button>
          </div>
          {matMode === 'link' && (
            <div style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'center' }}>
              <select value={linkSel} onChange={e => setLinkSel(e.target.value)} style={{ ...inpStyle, flex:1, minWidth:160, cursor:'pointer' }}>
                <option value="">Choisir un matériau…</option>
                {unlinkedMats.map(m => <option key={m.id} value={m.id}>{m.article}{m.project ? ` · ${m.project}` : ''}</option>)}
              </select>
              <button onClick={submitLink} disabled={!linkSel} style={{ ...ss.btn, color: linkSel ? T.g : T.tx3, border:`1px solid ${linkSel ? T.g + '44' : T.bd}` }}>Lier</button>
            </div>
          )}
          {matMode === 'new' && (
            <div style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'flex-end' }}>
              <input value={newMat.article} onChange={e => setNewMat(r => ({ ...r, article:e.target.value }))} placeholder="Article *" style={{ ...inpStyle, flex:1, minWidth:150 }} />
              <input value={newMat.magasin} onChange={e => setNewMat(r => ({ ...r, magasin:e.target.value }))} placeholder="Magasin" style={{ ...inpStyle, width:110 }} />
              <input type="number" value={newMat.prix_unitaire} onChange={e => setNewMat(r => ({ ...r, prix_unitaire:e.target.value }))} placeholder="Prix $" style={{ ...inpStyle, width:74 }} />
              <input type="number" min={1} value={newMat.qty} onChange={e => setNewMat(r => ({ ...r, qty:e.target.value }))} style={{ ...inpStyle, width:54 }} />
              <button onClick={submitNewMat} disabled={!newMat.article.trim()} style={{ ...ss.btn, color: newMat.article.trim() ? T.g : T.tx3, border:`1px solid ${newMat.article.trim() ? T.g + '44' : T.bd}` }}>Créer et lier</button>
            </div>
          )}
        </div>
      )}

      <div style={{ background:T.s1, border:`1px solid ${T.bd}`, borderRadius:9, padding:'11px 12px', marginTop:18 }}>
        <SectionLab style={{ margin:'0 0 6px' }}>Pourquoi</SectionLab>
        <div style={{ fontSize:12.5, color:T.tx2, lineHeight:1.65 }}>{system.pourquoi}</div>
      </div>

      <SectionLab style={{ margin:'18px 0 6px' }}>Journal</SectionLab>
      {log.length > 0 && (
        <div style={{ marginBottom:8 }}>
          {log.slice().reverse().map((e, i) => (
            <div key={i} style={{ display:'flex', gap:9, padding:'8px 0', borderBottom:`1px solid ${T.bd}` }}>
              <span style={{ fontSize:10, color:T.tx3, fontFamily:T.mono, flexShrink:0, minWidth:78 }}>{fmtLog(e.at)}</span>
              <span style={{ fontSize:12, color:T.tx2, lineHeight:1.5, flex:1 }}>{e.text}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display:'flex', gap:7, alignItems:'center' }}>
        <input value={logText} onChange={e => setLogText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitLog(); }}
          placeholder="Noter (ex: maçon appelé, devis 1200, RDV le 24)" style={{ ...inpStyle, flex:1 }} />
        <button onClick={submitLog} disabled={!logText.trim()} style={{ ...ss.btn, color: logText.trim() ? T.acc : T.tx3 }}>Ajouter</button>
      </div>

      {action.composantes?.length > 0 && (
        <div style={{ marginTop:16 }}>
          <SectionLab style={{ margin:'0 0 6px' }}>Composantes</SectionLab>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {action.composantes.map(c => <span key={c} style={{ fontSize:11, background:T.s3, color:T.acc, padding:'2px 7px', borderRadius:4, fontFamily:T.mono }}>{c}</span>)}
          </div>
        </div>
      )}

      {action.notes && (
        <div style={{ marginTop:12 }}>
          <SectionLab style={{ margin:'0 0 6px' }}>Notes</SectionLab>
          <div style={{ fontSize:12, color:T.tx2, lineHeight:1.6 }}>{action.notes}</div>
        </div>
      )}

      {action.source && <div style={{ marginTop:12, fontSize:10.5, color:T.tx3, fontFamily:T.mono }}>Source: {action.source}</div>}
    </div>
  );
}

// ─── PLACEHOLDER ────────────────────────────────────────────────────────────────
function Placeholder({ title, note }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'40px 24px', gap:10, minHeight:'60vh' }}>
      <div style={{ fontSize:13, fontWeight:700, color:T.tx2, letterSpacing:'0.04em' }}>{title}</div>
      <div style={{ fontSize:12, color:T.tx3, lineHeight:1.6, maxWidth:300 }}>{note}</div>
      <div style={{ fontSize:10, color:T.tx3, fontFamily:T.mono, marginTop:4, opacity:0.7 }}>À venir</div>
    </div>
  );
}

// ─── ACHATS VIEW (responsive) ───────────────────────────────────────────────────
function AchatsView({ shopItems, setShopItems, saveShopItem, deleteShopItem, addShopItem, narrow,
  buyRuns = [], assignToRun, toggleBought, removeFromRun, toggleRunDone, deleteRun }) {
  const [bucket, setBucket] = useState('aplanifier');
  const [editCell, setEditCell] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [addingRow, setAddingRow] = useState(false);
  const [newRow, setNewRow] = useState({ project:'', article:'', magasin:'', prix_unitaire:'', qty:1, status:'À trouver', lien:'', notes:'' });
  const [selected, setSelected] = useState({});
  const [runDate, setRunDate] = useState(todayISO());

  const fmtMoney = n => n.toLocaleString('fr-CA', { style:'currency', currency:'CAD', maximumFractionDigits:0 });
  const projects = useMemo(() => [...new Set(shopItems.map(i => i.project).filter(Boolean))].sort(), [shopItems]);
  const storeOf = i => (i.magasin || '').trim() || 'Magasin à confirmer';

  const inRunIds = useMemo(() => { const s = new Set(); (buyRuns || []).forEach(r => (r.materialIds || []).forEach(id => s.add(id))); return s; }, [buyRuns]);
  const aPlanifier = useMemo(() => shopItems.filter(i => !i.bought && !inRunIds.has(i.id)), [shopItems, inRunIds]);
  const achetes = useMemo(() => shopItems.filter(i => i.bought), [shopItems]);
  const bucketItems = bucket === 'aplanifier' ? aPlanifier : bucket === 'achetes' ? achetes : bucket === 'tout' ? shopItems : [];
  const groupedByStore = useMemo(() => {
    const g = {};
    bucketItems.forEach(i => { const k = storeOf(i); (g[k] = g[k] || []).push(i); });
    return g;
  }, [bucketItems]);
  const bucketTotal = bucketItems.filter(i => i.prix_unitaire).reduce((s, i) => s + i.prix_unitaire * (i.qty || 1), 0);

  const selectable = bucket === 'aplanifier';
  const selIds = Object.keys(selected).filter(id => selected[id] && shopItems.some(i => i.id === id));
  const selTotal = shopItems.filter(i => selIds.includes(i.id)).reduce((s, i) => s + (i.prix_unitaire ? i.prix_unitaire * (i.qty || 1) : 0), 0);
  const toggleSel = id => setSelected(p => ({ ...p, [id]: !p[id] }));
  const clearSel = () => setSelected({});
  const doAssign = () => { if (!selIds.length || !runDate || !assignToRun) return; assignToRun(selIds, runDate); clearSel(); };
  const doMarkBought = () => { if (!toggleBought) return; selIds.forEach(id => { const m = shopItems.find(x => x.id === id); if (m && !m.bought) toggleBought(id); }); clearSel(); };

  const runsSorted = (buyRuns || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const fmtRunDate = iso => { const d = new Date(iso + 'T00:00'); return `${DOW_FR[(d.getDay() + 6) % 7]} ${dayNum(iso)} ${monShort(iso)}`; };

  const startEdit = (id, field, val) => { setEditCell({ id, field }); setEditVal(String(val ?? '')); };
  const commitEdit = async (id, field) => {
    let val = editVal;
    if (field === 'prix_unitaire') val = editVal !== '' ? parseFloat(editVal) : null;
    if (field === 'qty') val = parseInt(editVal) || 1;
    setShopItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i));
    await saveShopItem(id, { [field]: val });
    setEditCell(null);
  };
  const addRow = async () => {
    if (!newRow.article.trim()) return;
    const item = { ...newRow, prix_unitaire: newRow.prix_unitaire !== '' ? parseFloat(newRow.prix_unitaire) : null, qty: parseInt(newRow.qty) || 1 };
    await addShopItem(item);
    setNewRow({ project:'', article:'', magasin:'', prix_unitaire:'', qty:1, status:'À trouver', lien:'', notes:'' });
    setAddingRow(false);
  };
  const cardEdit = (item, field, opts = {}) => {
    const editing = editCell?.id === item.id && editCell?.field === field;
    const val = item[field];
    const display = field === 'prix_unitaire' ? (val != null ? `${val}$` : '—') : (val === '' || val == null ? '—' : val);
    if (editing) {
      return <input autoFocus type={opts.type || 'text'} value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => commitEdit(item.id, field)}
        onKeyDown={e => { if (e.key === 'Enter') commitEdit(item.id, field); if (e.key === 'Escape') setEditCell(null); }}
        style={{ background:T.s3, border:`1px solid ${T.acc}`, borderRadius:4, padding:'3px 6px', fontSize:opts.fs || 12, color:T.tx, fontFamily:T.font, outline:'none', width:opts.w || '100%', boxSizing:'border-box' }} />;
    }
    return <span onClick={() => startEdit(item.id, field, val)} style={{ cursor:'text', color: val === '' || val == null ? T.tx3 : T.tx, fontStyle: val === '' || val == null ? 'italic' : 'normal', fontSize:opts.fs || 12 }}>{display}</span>;
  };

  const buckets = [
    { id:'aplanifier', label:'À planifier' },
    { id:'courses', label:'Courses' },
    { id:'achetes', label:'Achetés' },
    { id:'tout', label:'Tout' },
  ];
  const topBar = (
    <div style={{ padding:'8px 12px', borderBottom:`1px solid ${T.bd}`, display:'flex', gap:8, alignItems:'center', background:T.s1, flexWrap:'wrap', flexShrink:0, position:'sticky', top:0, zIndex:3 }}>
      <div style={{ display:'flex', gap:0, background:T.s2, border:`1px solid ${T.bd}`, borderRadius:8, padding:2 }}>
        {buckets.map(b => (
          <button key={b.id} onClick={() => { setBucket(b.id); clearSel(); }}
            style={{ border:'none', background: bucket === b.id ? T.s3 : 'transparent', color: bucket === b.id ? T.tx : T.tx3, fontSize:11.5, padding:'5px 10px', borderRadius:6, fontFamily:T.font, cursor:'pointer' }}>{b.label}</button>
        ))}
      </div>
      {bucket !== 'courses' && <span style={{ marginLeft:'auto', fontSize:12, color:T.y, fontFamily:T.mono }}>{bucketTotal > 0 ? fmtMoney(bucketTotal) : ''}</span>}
      <button onClick={() => setAddingRow(true)} style={{ ...ss.btn, marginLeft: bucket === 'courses' ? 'auto' : 0, color:T.acc, border:`1px solid rgba(91,156,246,0.25)`, background:'rgba(91,156,246,0.08)' }}>+ Article</button>
    </div>
  );

  const materialCard = item => (
    <div key={item.id} style={{ background:T.s1, border:`1px solid ${selected[item.id] ? T.acc : T.bd}`, borderRadius:9, padding:'11px 12px' }}>
      <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
        {selectable && <input type="checkbox" checked={!!selected[item.id]} onChange={() => toggleSel(item.id)} style={{ width:16, height:16, marginTop:2, cursor:'pointer', accentColor:T.acc, flexShrink:0 }} />}
        <div style={{ flex:1, lineHeight:1.4 }}>{cardEdit(item, 'article', { fs:13 })}</div>
        {item.bought && <span style={{ ...ss.pill('rgba(63,182,139,0.14)', T.g), fontSize:9 }}>acheté</span>}
        <button onClick={() => deleteShopItem(item.id)} title="Supprimer" style={{ background:'transparent', border:'none', cursor:'pointer', color:T.tx3, fontSize:15, padding:0, lineHeight:1, flexShrink:0 }}>✕</button>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8, flexWrap:'wrap' }}>
        {cardEdit(item, 'magasin', { fs:11.5, w:120 })}
        <span style={{ color:T.y, fontFamily:T.mono }}>{cardEdit(item, 'prix_unitaire', { type:'number', w:70, fs:12 })}</span>
        <span style={{ color:T.tx3, fontFamily:T.mono, fontSize:11 }}>x {cardEdit(item, 'qty', { type:'number', w:44, fs:11 })}</span>
        {bucket === 'achetes'
          ? <button onClick={() => toggleBought && toggleBought(item.id)} style={{ ...ss.btn, marginLeft:'auto', fontSize:10.5 }}>Annuler achat</button>
          : <select value={item.status} onChange={e => { saveShopItem(item.id, { status:e.target.value }); setShopItems(prev => prev.map(i => i.id === item.id ? { ...i, status:e.target.value } : i)); }}
              style={{ marginLeft:'auto', background:(PSTATUS[item.status] || PSTATUS['À trouver']).bg, color:(PSTATUS[item.status] || PSTATUS['À trouver']).tx, border:'none', borderRadius:5, padding:'3px 7px', fontSize:10.5, cursor:'pointer', fontFamily:T.font, outline:'none' }}>
              {Object.keys(PSTATUS).map(s => <option key={s}>{s}</option>)}
            </select>}
      </div>
      <div style={{ marginTop:8, lineHeight:1.5 }}>{cardEdit(item, 'notes', { fs:11 })}</div>
    </div>
  );

  const materialBody = (
    <div style={{ padding: narrow ? '10px 12px 20px' : '12px 16px 20px' }}>
      {Object.keys(groupedByStore).sort().map(store => {
        const items = groupedByStore[store];
        const sub = items.filter(i => i.prix_unitaire).reduce((s, i) => s + i.prix_unitaire * (i.qty || 1), 0);
        return (
          <div key={store} style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:12.5, fontWeight:700, color:T.tx }}>{store}</span>
              {sub > 0 && <span style={{ fontSize:11, color:T.y, fontFamily:T.mono }}>{fmtMoney(sub)}</span>}
              <span style={{ fontSize:10, color:T.tx3, marginLeft:'auto' }}>{items.length} article{items.length > 1 ? 's' : ''}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns: narrow ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap:8 }}>
              {items.map(materialCard)}
            </div>
          </div>
        );
      })}
      {bucketItems.length === 0 && <div style={{ textAlign:'center', padding:'40px 20px', color:T.tx3, fontSize:13 }}>{bucket === 'aplanifier' ? 'Rien à planifier. Tout est dans une course ou déjà acheté.' : bucket === 'achetes' ? "Aucun achat pour l'instant." : 'Aucun article.'}</div>}
    </div>
  );

  const coursesBody = (
    <div style={{ padding: narrow ? '10px 12px 24px' : '12px 16px 24px' }}>
      {runsSorted.length === 0 && <div style={{ textAlign:'center', padding:'40px 20px', color:T.tx3, fontSize:13, lineHeight:1.6 }}>Aucune course planifiée. Sélectionne des matériaux dans « À planifier » et mets-les dans une course.</div>}
      {runsSorted.map(run => {
        const { items, subtotal, allBought } = runItems(run, shopItems);
        return (
          <div key={run.id} style={{ background:T.s1, border:`1px solid ${run.done || allBought ? 'rgba(63,182,139,0.3)' : T.bd}`, borderRadius:10, padding:'12px 13px', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ ...ss.pill('rgba(212,146,42,0.16)', T.y), fontSize:10 }}>🛒 {fmtRunDate(run.date)}</span>
              <span style={{ fontSize:13, fontWeight:700, color:T.tx }}>{(run.magasin || '').trim() || 'Magasin à confirmer'}</span>
              <span style={{ fontSize:11, color:T.y, fontFamily:T.mono, marginLeft:'auto' }}>{fmtMoney(subtotal)}</span>
            </div>
            {items.map(m => (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 0', borderBottom:`1px solid ${T.bd}` }}>
                <input type="checkbox" checked={!!m.bought} onChange={() => toggleBought && toggleBought(m.id)} style={{ width:16, height:16, cursor:'pointer', accentColor:T.g, flexShrink:0 }} />
                <span style={{ flex:1, fontSize:12.5, color: m.bought ? T.tx3 : T.tx, textDecoration: m.bought ? 'line-through' : 'none' }}>{m.article}</span>
                {m.qty > 1 && <span style={{ fontSize:11, color:T.tx3, fontFamily:T.mono }}>x{m.qty}</span>}
                <span style={{ fontSize:12, color:T.y, fontFamily:T.mono, minWidth:54, textAlign:'right' }}>{money(m.prix_unitaire ? m.prix_unitaire * (m.qty || 1) : null)}</span>
                <button onClick={() => removeFromRun && removeFromRun(run.id, m.id)} title="Retirer de la course" style={{ background:'transparent', border:'none', cursor:'pointer', color:T.tx3, fontSize:14, padding:0, lineHeight:1, flexShrink:0 }}>×</button>
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10 }}>
              <button onClick={() => toggleRunDone && toggleRunDone(run.id)} style={{ ...ss.btn, color: run.done ? T.g : T.tx2, border:`1px solid ${run.done ? T.g + '44' : T.bd2}`, background: run.done ? 'rgba(63,182,139,0.12)' : T.s2 }}>{run.done ? '✓ Course faite' : 'Marquer course faite'}</button>
              <button onClick={() => deleteRun && deleteRun(run.id)} title="Supprimer la course" style={{ ...ss.btn, marginLeft:'auto', color:T.tx3 }}>Supprimer</button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const selBar = selectable && selIds.length > 0 && (
    <div style={{ position:'sticky', bottom:0, zIndex:3, background:T.s2, borderTop:`1px solid ${T.bd2}`, padding:'10px 12px', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
      <span style={{ fontSize:12, color:T.tx }}>{selIds.length} sélectionné{selIds.length > 1 ? 's' : ''}</span>
      <span style={{ fontSize:12, color:T.y, fontFamily:T.mono }}>{fmtMoney(selTotal)}</span>
      <button onClick={clearSel} style={{ ...ss.btn, fontSize:10.5 }}>Effacer</button>
      <input type="date" value={runDate} onChange={e => setRunDate(e.target.value)} style={{ marginLeft:'auto', background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:6, padding:'4px 8px', fontSize:11, color:T.tx2, fontFamily:T.font, colorScheme:'dark', cursor:'pointer' }} />
      <button onClick={doAssign} disabled={!runDate} style={{ ...ss.btn, color:T.y, border:`1px solid rgba(212,146,42,0.35)`, background:'rgba(212,146,42,0.12)' }}>Mettre dans une course</button>
      <button onClick={doMarkBought} style={{ ...ss.btn, color:T.g, border:`1px solid ${T.g}44`, background:'rgba(63,182,139,0.12)' }}>Marquer acheté</button>
    </div>
  );

  const addForm = addingRow && (
    <div style={{ borderTop:`1px solid ${T.bd}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', background:T.s2, borderBottom:`1px solid ${T.bd}` }}>
        <span style={{ fontSize:12, fontWeight:700, color:T.acc }}>Nouvel article</span>
      </div>
      <div style={{ padding:'12px 16px', background:T.s1, display:'flex', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:9, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Article *</span>
          <input value={newRow.article} onChange={e => setNewRow(r => ({ ...r, article:e.target.value }))} placeholder="Description…"
            style={{ background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'5px 8px', fontSize:11, color:T.tx, fontFamily:T.font, outline:'none', width:200 }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:9, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Magasin</span>
          <input value={newRow.magasin} onChange={e => setNewRow(r => ({ ...r, magasin:e.target.value }))} placeholder="RONA, IKEA…"
            style={{ background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'5px 8px', fontSize:11, color:T.tx, fontFamily:T.font, outline:'none', width:110 }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:9, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Prix $</span>
          <input type="number" value={newRow.prix_unitaire} onChange={e => setNewRow(r => ({ ...r, prix_unitaire:e.target.value }))} placeholder="0.00"
            style={{ background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'5px 8px', fontSize:11, color:T.tx, fontFamily:T.font, outline:'none', width:70 }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:9, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Qté</span>
          <input type="number" min={1} value={newRow.qty} onChange={e => setNewRow(r => ({ ...r, qty:e.target.value }))}
            style={{ background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'5px 8px', fontSize:11, color:T.tx, fontFamily:T.font, outline:'none', width:50 }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:9, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Projet</span>
          <input value={newRow.project} onChange={e => setNewRow(r => ({ ...r, project:e.target.value }))} list="dw-proj-list" placeholder="(optionnel)"
            style={{ background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'5px 8px', fontSize:11, color:T.tx, fontFamily:T.font, outline:'none', width:150 }} />
          <datalist id="dw-proj-list">{projects.map(p => <option key={p} value={p} />)}</datalist>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:9, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Notes</span>
          <input value={newRow.notes} onChange={e => setNewRow(r => ({ ...r, notes:e.target.value }))} placeholder="…"
            style={{ background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'5px 8px', fontSize:11, color:T.tx, fontFamily:T.font, outline:'none', width:160 }} />
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:6 }}>
          <button onClick={addRow} disabled={!newRow.article.trim()}
            style={{ ...ss.btn, background:newRow.article.trim() ? 'rgba(63,182,139,0.15)' : T.s3, color:newRow.article.trim() ? T.g : T.tx3, border:`1px solid ${newRow.article.trim() ? T.g + '44' : T.bd}` }}>Ajouter</button>
          <button onClick={() => setAddingRow(false)} style={ss.btn}>Annuler</button>
        </div>
      </div>
    </div>
  );

  const body = bucket === 'courses' ? coursesBody : materialBody;

  if (narrow) return <div>{topBar}{body}{addForm}{selBar}</div>;
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {topBar}
      <div style={{ flex:1, overflowY:'auto' }}>{body}{addForm}</div>
      {selBar}
    </div>
  );
}

// ─── ENTRETIEN VIEW (responsive) ────────────────────────────────────────────────
function EntretienView({ maintenance, mDone, onToggleMaint, narrow }) {
  const [fSeason, setFSeason] = useState('all');
  const season = currentSeason();
  const uniqueSeasons = [...new Set(maintenance.map(t => t.season))];
  const filtered = fSeason === 'all' ? maintenance : maintenance.filter(t => t.season === fSeason);
  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(t => { if (!g[t.season]) g[t.season] = []; g[t.season].push(t); });
    return g;
  }, [filtered]);
  const seasonOrder = ["Toute l'année", 'Printemps', 'Printemps + automne', 'Été', 'Automne', 'Octobre', 'Avant premiers gels', 'Hiver', 'Après grosses tempêtes', 'Annuel'];
  const orderedSeasons = Object.keys(grouped).sort((a, b) => {
    const ai = seasonOrder.indexOf(a); const bi = seasonOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const header = (
    <div style={{ padding:'10px 14px', borderBottom:`1px solid ${T.bd}`, display:'flex', gap:8, alignItems:'center', background:T.s1, flexWrap:'wrap', flexShrink:0 }}>
      <select value={fSeason} onChange={e => setFSeason(e.target.value)} style={{ background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'4px 8px', fontSize:11, color:T.tx, cursor:'pointer', fontFamily:T.font, outline:'none' }}>
        <option value="all">Toutes les saisons</option>
        {uniqueSeasons.map(s => <option key={s}>{s}</option>)}
      </select>
      <span style={{ fontSize:11, color:T.tx3 }}>Saison actuelle: <span style={{ color:T.acc }}>{season}</span></span>
      <span style={{ ...ss.pill('rgba(63,182,139,0.12)', T.g), marginLeft:'auto' }}>{maintenance.filter(t => mDone[t.id]).length}/{maintenance.length} complétés</span>
    </div>
  );

  const list = (
    <div style={{ padding:'12px 14px 24px' }}>
      {orderedSeasons.map(s => {
        const tasks = grouped[s];
        const isCur = seasonMatch(s, season);
        const doneCount = tasks.filter(t => mDone[t.id]).length;
        return (
          <div key={s} style={{ marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <span style={{ fontSize:12, fontWeight:600, color:T.tx }}>{s}</span>
              {isCur && <span style={{ ...ss.pill('rgba(63,182,139,0.14)', T.g), fontSize:9 }}>Maintenant</span>}
              <span style={{ fontSize:10, color:T.tx3 }}>{doneCount}/{tasks.length} fait</span>
            </div>
            {tasks.map(t => (
              <div key={t.id} style={{ display:'flex', gap:11, padding:'10px 12px',
                background: mDone[t.id] ? 'rgba(63,182,139,0.05)' : isCur && !mDone[t.id] ? 'rgba(91,156,246,0.04)' : T.s1,
                border:`1px solid ${isCur && !mDone[t.id] ? 'rgba(91,156,246,0.18)' : T.bd}`, borderRadius:8, marginBottom:6, alignItems:'flex-start' }}>
                <input type="checkbox" checked={!!mDone[t.id]} onChange={e => onToggleMaint(t.id, e.target.checked)} style={{ width:17, height:17, cursor:'pointer', accentColor:T.g, flexShrink:0, marginTop:1 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color: mDone[t.id] ? T.tx3 : T.tx, fontWeight:500, textDecoration: mDone[t.id] ? 'line-through' : 'none', marginBottom: t.detail ? 3 : 0 }}>{t.task}</div>
                  <div style={{ fontSize:11.5, color:T.tx3, lineHeight:1.55 }}>{t.detail}</div>
                  {mDone[t.id] && <div style={{ fontSize:10, color:T.g, marginTop:3 }}>✓ Complété le {mDone[t.id]}</div>}
                  {t.notes && <div style={{ fontSize:10, color:T.tx3, marginTop:2, fontFamily:T.mono }}>{t.notes}</div>}
                </div>
                <span style={{ fontSize:10, color:T.tx3, flexShrink:0, textAlign:'right', maxWidth:90 }}>{t.zone}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );

  if (narrow) return <div>{header}{list}</div>;
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {header}
      <div style={{ flex:1, overflowY:'auto' }}>{list}</div>
    </div>
  );
}

// ─── PLANIFIER CONTROL ──────────────────────────────────────────────────────────
const planBtn = (active, danger) => ({ background: active ? 'rgba(91,156,246,0.16)' : T.s2, border:`1px solid ${active ? T.acc : T.bd2}`, borderRadius:6, padding:'5px 10px', fontSize:11, color: danger ? T.r : active ? T.acc : T.tx2, cursor:'pointer', fontFamily:T.font });
const fmtSched = iso => iso ? `${DOW_FR[(new Date(iso + 'T00:00').getDay() + 6) % 7]} ${dayNum(iso)} ${monShort(iso)}` : null;

function PlanifierControl({ value, onSet }) {
  const set = d => onSet && onSet(d);
  const tomorrow = toISO(addDays(new Date(), 1));
  return (
    <div style={{ marginBottom:14 }}>
      <SectionLab style={{ margin:'0 0 6px' }}>Planifier</SectionLab>
      <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
        {value && <span style={{ ...ss.pill('rgba(91,156,246,0.14)', T.acc), fontSize:11 }}>{fmtSched(value)}</span>}
        <button onClick={() => set(todayISO())} style={planBtn(value === todayISO())}>Aujourd'hui</button>
        <button onClick={() => set(tomorrow)} style={planBtn(value === tomorrow)}>Demain</button>
        <input type="date" value={value || ''} onChange={e => set(e.target.value || null)}
          style={{ background:T.s2, border:`1px solid ${T.bd2}`, borderRadius:6, padding:'4px 8px', fontSize:11, color:T.tx2, fontFamily:T.font, colorScheme:'dark', cursor:'pointer' }} />
        {value && <button onClick={() => set(null)} style={planBtn(false, true)}>Retirer</button>}
      </div>
    </div>
  );
}

// ─── CALENDAR VIEW (desktop) ────────────────────────────────────────────────────
function CalendarView({ systems, statuses, schedules, scheduleAction, onStatusChange, materials, stepsDone, toggleStep, addLogEntry, linkExistingMaterial, addActionMaterial, unlinkMaterial, applyPlan, buyRuns = [], toggleBought, removeFromRun, toggleRunDone, deleteRun }) {
  const [weekStart, setWeekStart] = useState(() => toISO(startOfWeek(new Date())));
  const [pending, setPending] = useState(null);
  const [selId, setSelId] = useState(null);
  const [selRun, setSelRun] = useState(null);

  const allActions = useMemo(() => systems.flatMap(s => s.actions.map(a => ({ ...a, sysId:s.id, sysName:s.name }))), [systems]);
  const byId = id => allActions.find(a => a.id === id);
  const days = weekDates(new Date(weekStart + 'T00:00'));
  const tray = orderActions(allActions.filter(a => !schedules[a.id] && (statuses[a.id] || a.status) !== 'Fait'));
  const forDay = iso => allActions.filter(a => schedules[a.id] === iso).sort((x, y) => (PRIORITY_ORDER[x.priority] ?? 9) - (PRIORITY_ORDER[y.priority] ?? 9));
  const assignTo = iso => { if (pending) { scheduleAction(pending, iso); setPending(null); } };

  const sel = selId ? byId(selId) : null;
  const selSys = sel ? systems.find(s => s.id === sel.sysId) : null;
  const runsForDay = iso => (buyRuns || []).filter(r => r.date === iso);
  const selRunObj = selRun ? (buyRuns || []).find(r => r.id === selRun) : null;
  const rangeLabel = `${dayNum(days[0])} ${monShort(days[0])} – ${dayNum(days[6])} ${monShort(days[6])}`;
  const navBtn = { background:T.s2, border:`1px solid ${T.bd2}`, borderRadius:6, padding:'4px 9px', fontSize:12, color:T.tx2, cursor:'pointer', fontFamily:T.font };

  const calendar = (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderBottom:`1px solid ${T.bd}`, background:T.s1, flexShrink:0 }}>
        <button onClick={() => setWeekStart(toISO(addDays(new Date(weekStart + 'T00:00'), -7)))} style={navBtn}>‹</button>
        <button onClick={() => setWeekStart(toISO(startOfWeek(new Date())))} style={{ ...navBtn, fontSize:11 }}>Cette semaine</button>
        <button onClick={() => setWeekStart(toISO(addDays(new Date(weekStart + 'T00:00'), 7)))} style={navBtn}>›</button>
        <span style={{ fontSize:13, fontWeight:600, color:T.tx, marginLeft:6 }}>{rangeLabel}</span>
        {pending && <span style={{ marginLeft:'auto', fontSize:11, color:T.acc, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'45%' }}>Choisis un jour pour: <span style={{ color:T.tx }}>{byId(pending)?.desc}</span></span>}
      </div>
      <div style={{ flex:1, overflowY:'auto', display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:1, background:T.bd, padding:1 }}>
        {days.map(iso => {
          const acts = forDay(iso);
          const isT = isToday(iso);
          return (
            <div key={iso} onClick={() => assignTo(iso)}
              style={{ background:T.bg, minHeight:130, padding:'7px 6px', cursor: pending ? 'copy' : 'default', display:'flex', flexDirection:'column', gap:5, borderTop:`2px solid ${isT ? T.acc : 'transparent'}` }}>
              <div style={{ fontSize:10, fontWeight:600, color: isT ? T.acc : T.tx3, textAlign:'center', marginBottom:2 }}>
                {DOW_FR[(new Date(iso + 'T00:00').getDay() + 6) % 7]} {dayNum(iso)}
              </div>
              {acts.map(a => {
                const hot = a.priority === 'Urgent' || a.priority === 'Danger';
                return (
                  <div key={a.id} onClick={e => { e.stopPropagation(); setSelId(a.id); setSelRun(null); }}
                    style={{ background: hot ? 'rgba(217,95,95,0.16)' : 'rgba(91,156,246,0.14)', border:`1px solid ${hot ? 'rgba(217,95,95,0.4)' : 'rgba(91,156,246,0.35)'}`, borderRadius:5, padding:'4px 6px', cursor:'pointer' }}>
                    <div style={{ fontSize:9.5, color: hot ? T.r : T.acc, fontWeight:600, lineHeight:1.25, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{a.desc}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:3 }}>
                      <span style={{ fontSize:8, color:T.tx3, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.sysName}</span>
                      <span onClick={e => { e.stopPropagation(); scheduleAction(a.id, null); }} title="Retirer" style={{ fontSize:12, color:T.tx3, cursor:'pointer', lineHeight:1 }}>×</span>
                    </div>
                  </div>
                );
              })}
              {runsForDay(iso).map(r => {
                const ri = runItems(r, materials);
                return (
                  <div key={r.id} onClick={e => { e.stopPropagation(); setSelRun(r.id); setSelId(null); }}
                    style={{ background:'rgba(212,146,42,0.14)', border:`1px solid ${r.done || ri.allBought ? 'rgba(63,182,139,0.45)' : 'rgba(212,146,42,0.4)'}`, borderRadius:5, padding:'4px 6px', cursor:'pointer' }}>
                    <div style={{ fontSize:9.5, color:T.y, fontWeight:600, lineHeight:1.25, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>🛒 {(r.magasin || '').trim() || 'Magasin à confirmer'}</div>
                    <div style={{ fontSize:8, color:T.tx3, marginTop:3 }}>{ri.items.length} article{ri.items.length > 1 ? 's' : ''} · {money(ri.subtotal)}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={{ flexShrink:0, borderTop:`1px solid ${T.bd}`, background:T.s1, maxHeight:160, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'7px 14px 4px', fontSize:10, fontWeight:700, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.06em' }}>À planifier <span style={{ opacity:0.7 }}>({tray.length})</span></div>
        <div style={{ overflowY:'auto', padding:'4px 10px 10px', display:'flex', flexWrap:'wrap', gap:6 }}>
          {tray.length === 0 && <span style={{ fontSize:11, color:T.tx3, fontStyle:'italic', padding:'4px' }}>Tout est planifié.</span>}
          {tray.map(a => {
            const on = pending === a.id;
            return (
              <button key={a.id} onClick={() => setPending(on ? null : a.id)}
                style={{ textAlign:'left', maxWidth:230, background: on ? 'rgba(91,156,246,0.18)' : T.s2, border:`1px solid ${on ? T.acc : T.bd2}`, borderLeft:`3px solid ${(PRIORITY[a.priority] || PRIORITY['—']).tx}`, borderRadius:6, padding:'5px 8px', cursor:'pointer', fontFamily:T.font }}>
                <div style={{ fontSize:11, color:T.tx, lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{a.desc}</div>
                <div style={{ fontSize:9, color:T.tx3, marginTop:2 }}>{a.sysName}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  let detail;
  if (selRunObj) {
    const rb = runItems(selRunObj, materials);
    detail = (
      <div style={{ padding:'14px 16px 28px' }}>
        <BackBtn label="Calendrier" onClick={() => setSelRun(null)} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <span style={{ ...ss.pill('rgba(212,146,42,0.16)', T.y), fontSize:11 }}>🛒 {fmtSched(selRunObj.date)}</span>
          <span style={{ marginLeft:'auto', fontSize:12, color:T.y, fontFamily:T.mono }}>{money(rb.subtotal)}</span>
        </div>
        <div style={{ fontSize:17, fontWeight:700, color:T.tx, marginBottom:12 }}>{(selRunObj.magasin || '').trim() || 'Magasin à confirmer'}</div>
        {rb.items.map(m => (
          <div key={m.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 0', borderBottom:`1px solid ${T.bd}` }}>
            <input type="checkbox" checked={!!m.bought} onChange={() => toggleBought && toggleBought(m.id)} style={{ width:16, height:16, cursor:'pointer', accentColor:T.g, flexShrink:0 }} />
            <span style={{ flex:1, fontSize:12.5, color: m.bought ? T.tx3 : T.tx, textDecoration: m.bought ? 'line-through' : 'none' }}>{m.article}</span>
            {m.qty > 1 && <span style={{ fontSize:11, color:T.tx3, fontFamily:T.mono }}>x{m.qty}</span>}
            <span style={{ fontSize:12, color:T.y, fontFamily:T.mono, minWidth:54, textAlign:'right' }}>{money(m.prix_unitaire ? m.prix_unitaire * (m.qty || 1) : null)}</span>
            <button onClick={() => removeFromRun && removeFromRun(selRunObj.id, m.id)} title="Retirer" style={{ background:'transparent', border:'none', cursor:'pointer', color:T.tx3, fontSize:14, padding:0, lineHeight:1 }}>×</button>
          </div>
        ))}
        {rb.items.length === 0 && <div style={{ fontSize:12, color:T.tx3, fontStyle:'italic', padding:'10px 0' }}>Course vide.</div>}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:14 }}>
          <button onClick={() => toggleRunDone && toggleRunDone(selRunObj.id)} style={{ ...ss.btn, color: selRunObj.done ? T.g : T.tx2, border:`1px solid ${selRunObj.done ? T.g + '44' : T.bd2}`, background: selRunObj.done ? 'rgba(63,182,139,0.12)' : T.s2 }}>{selRunObj.done ? '✓ Course faite' : 'Marquer course faite'}</button>
          <button onClick={() => { if (deleteRun) deleteRun(selRunObj.id); setSelRun(null); }} style={{ ...ss.btn, marginLeft:'auto', color:T.tx3 }}>Supprimer</button>
        </div>
      </div>
    );
  } else if (sel) {
    detail = (
      <ActionView system={selSys} action={sel} status={statuses[sel.id] || sel.status} onStatusChange={onStatusChange}
        schedule={schedules[sel.id]} onSchedule={d => scheduleAction(sel.id, d)} onBack={() => setSelId(null)} backLabel="Calendrier"
        materials={materials} stepsDone={stepsDone} onToggleStep={toggleStep} onAddLog={addLogEntry} onLinkMaterial={linkExistingMaterial} onAddMaterial={addActionMaterial} onUnlinkMaterial={unlinkMaterial} onApplyPlan={applyPlan} />
    );
  } else {
    detail = (
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, padding:24, textAlign:'center' }}>
        <div style={{ fontSize:28, opacity:0.12 }}>🗓</div>
        <span style={{ fontSize:12, color:T.tx3, fontStyle:'italic', maxWidth:220, lineHeight:1.6 }}>Clique une tâche ou une course pour l'ouvrir, ou choisis une tâche « à planifier » puis un jour.</span>
      </div>
    );
  }

  return (
    <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
      {calendar}
      <div style={{ width:360, flexShrink:0, borderLeft:`1px solid ${T.bd}`, overflowY:'auto', display:'flex', flexDirection:'column' }}>{detail}</div>
    </div>
  );
}

// ─── AUJOURD'HUI VIEW (phone) ───────────────────────────────────────────────────
function AujourdhuiView({ systems, statuses, schedules, onOpenAction, buyRuns = [], materials = [], toggleBought }) {
  const all = systems.flatMap(s => s.actions.map(a => ({ ...a, sysId:s.id, sysName:s.name })));
  const todays = all.filter(a => schedules[a.id] && schedules[a.id] <= todayISO() && (statuses[a.id] || a.status) !== 'Fait')
    .sort((x, y) => schedules[x.id] < schedules[y.id] ? -1 : schedules[x.id] > schedules[y.id] ? 1 : (PRIORITY_ORDER[x.priority] ?? 9) - (PRIORITY_ORDER[y.priority] ?? 9));
  const todaysRuns = (buyRuns || []).filter(r => r.date <= todayISO() && !r.done)
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return (
    <div style={{ padding:'14px 14px 24px' }}>
      <div style={{ fontSize:10, fontWeight:700, color:T.tx3, letterSpacing:'0.07em', textTransform:'uppercase', margin:'2px 0 4px' }}>Aujourd'hui</div>
      <div style={{ fontSize:11, color:T.tx3, marginBottom:12 }}>Ce qui est planifié pour aujourd'hui ou en retard.</div>

      <div style={{ fontSize:10, fontWeight:700, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.06em', margin:'4px 0 8px' }}>À faire</div>
      {todays.length === 0 ? (
        <div style={{ background:T.s1, border:`1px solid ${T.bd}`, borderRadius:10, padding:'18px 16px', textAlign:'center' }}>
          <div style={{ fontSize:12.5, color:T.tx2, lineHeight:1.6 }}>Rien de planifié pour aujourd'hui.</div>
          <div style={{ fontSize:11, color:T.tx3, marginTop:6 }}>Ouvre une action dans un projet et touche « Planifier » pour la programmer.</div>
        </div>
      ) : todays.map(a => {
        const pc = PRIORITY[a.priority] || PRIORITY['—'];
        const overdue = schedules[a.id] < todayISO();
        return (
          <div key={a.id} onClick={() => onOpenAction(a.sysId, a.id)}
            style={{ background:T.s1, border:`1px solid ${T.bd}`, borderLeft:`3px solid ${pc.tx}`, borderRadius:10, padding:'12px 13px', marginBottom:8, cursor:'pointer' }}>
            <div style={{ fontSize:10.5, color:pc.tx, fontWeight:600, marginBottom:3 }}>{a.sysName}</div>
            <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
              <div style={{ flex:1, fontSize:12.5, color:T.tx, lineHeight:1.45 }}>{a.desc}</div>
              <span style={{ color:T.tx3, fontSize:18, lineHeight:1 }}>›</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:8 }}>
              <PriorityBadge p={a.priority} />
              {overdue && <span style={{ ...ss.pill('rgba(217,95,95,0.14)', T.r), fontSize:9 }}>En retard</span>}
              <span style={{ marginLeft:'auto' }}><WStatusBadge s={statuses[a.id] || a.status} /></span>
            </div>
          </div>
        );
      })}

      <div style={{ fontSize:10, fontWeight:700, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.06em', margin:'18px 0 8px' }}>À acheter</div>
      {todaysRuns.length === 0 ? (
        <div style={{ fontSize:11.5, color:T.tx3, fontStyle:'italic' }}>Aucune course prévue.</div>
      ) : todaysRuns.map(run => {
        const { items, subtotal } = runItems(run, materials);
        const overdue = run.date < todayISO();
        return (
          <div key={run.id} style={{ background:T.s1, border:`1px solid ${T.bd}`, borderLeft:`3px solid ${T.y}`, borderRadius:10, padding:'12px 13px', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <span style={{ fontSize:11, color:T.y, fontWeight:600 }}>🛒 {(run.magasin || '').trim() || 'Magasin à confirmer'}</span>
              {overdue && <span style={{ ...ss.pill('rgba(217,95,95,0.14)', T.r), fontSize:9 }}>En retard</span>}
              <span style={{ marginLeft:'auto', fontSize:11, color:T.y, fontFamily:T.mono }}>{money(subtotal)}</span>
            </div>
            {items.map(m => (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'6px 0', borderBottom:`1px solid ${T.bd}` }}>
                <input type="checkbox" checked={!!m.bought} onChange={() => toggleBought && toggleBought(m.id)} style={{ width:16, height:16, cursor:'pointer', accentColor:T.g, flexShrink:0 }} />
                <span style={{ flex:1, fontSize:12, color: m.bought ? T.tx3 : T.tx, textDecoration: m.bought ? 'line-through' : 'none' }}>{m.article}</span>
                {m.qty > 1 && <span style={{ fontSize:10.5, color:T.tx3, fontFamily:T.mono }}>x{m.qty}</span>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── PHONE SHELL ────────────────────────────────────────────────────────────────
const TAB_ICONS = {
  projets: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  aujourdhui: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>',
  achats: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  entretien: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2 2.6-2.6z"/>',
};
const PHONE_TABS = [
  { id:'projets', label:'Projets' },
  { id:'aujourdhui', label:"Aujourd'hui" },
  { id:'achats', label:'Achats' },
  { id:'entretien', label:'Entretien' },
];
const TabIcon = ({ id, color }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" style={{ stroke:color, fill:'none', strokeWidth:1.6 }} dangerouslySetInnerHTML={{ __html: TAB_ICONS[id] }} />
);

// ─── QUICK-ADD SURFACE (Session 5) ──────────────────────────────────────────────
const shortDesc = (d, n = 46) => { d = d || ''; return d.length > n ? d.slice(0, n) + '…' : d; };

function QuickAdd({ variant = 'sheet', triggerStyle, systems = [], materials = [], openActionId = null,
  addShopItem, saveShopItem, addLogEntry, scheduleAction, assignToRun }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [override, setOverride] = useState(null);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const intent = parsed.intent;
  const q = intent === 'log' ? (parsed.log ? parsed.log.targetQuery : '')
          : intent === 'schedule' ? (parsed.schedule ? parsed.schedule.targetQuery : '') : '';
  const matches = useMemo(() => (intent === 'log' || intent === 'schedule') ? resolveActions(q, systems) : [], [intent, q, systems]);
  const allActions = useMemo(() => flatActions(systems), [systems]);
  const queryEmpty = !stripAccents(String(q || '')).trim();
  const defaultActionId = matches[0] ? matches[0].id : (queryEmpty ? (openActionId || null) : null);
  const targetActionId = override || defaultActionId || null;
  const targetAction = allActions.find(a => a.id === targetActionId) || null;

  const close = () => { setOpen(false); setText(''); setOverride(null); };

  const canConfirm =
    intent === 'material' ? !!(parsed.material && parsed.material.article) :
    intent === 'log' ? !!(targetActionId && parsed.log && parsed.log.text) :
    intent === 'schedule' ? !!(targetActionId && parsed.schedule && parsed.schedule.dateISO) :
    intent === 'run' ? !!(parsed.run && parsed.run.dateISO && parsed.run.items.length) : false;

  const commit = async () => {
    if (!canConfirm || busy) return;
    setBusy(true);
    try {
      if (intent === 'material') {
        const mm = parsed.material;
        await addShopItem({ project: mm.project || '', article: mm.article, magasin: mm.magasin || '', prix_unitaire: mm.prix_unitaire, qty: mm.qty || 1, status: 'À trouver', lien: '', notes: '' });
      } else if (intent === 'log') {
        addLogEntry(targetActionId, parsed.log.text);
      } else if (intent === 'schedule') {
        scheduleAction(targetActionId, parsed.schedule.dateISO);
      } else if (intent === 'run') {
        const r = parsed.run; const ids = [];
        for (const it of r.items) {
          const ex = resolveMaterial(it.article, materials);
          if (ex) {
            if (r.magasin && (ex.magasin || '') !== r.magasin && saveShopItem) await saveShopItem(ex.id, { magasin: r.magasin });
            ids.push(ex.id);
          } else {
            const row = await addShopItem({ project: '', article: it.article, magasin: r.magasin || it.magasin || '', prix_unitaire: it.prix_unitaire, qty: it.qty || 1, status: 'À trouver', lien: '', notes: '' });
            if (row && row.id) ids.push(row.id);
          }
        }
        if (ids.length) assignToRun(ids, r.dateISO);
      }
      close();
    } finally { setBusy(false); }
  };

  const inp = { width:'100%', boxSizing:'border-box', background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:7, padding:'9px 11px', fontSize:13, color:T.tx, fontFamily:T.font, outline:'none' };
  const sel = { width:'100%', boxSizing:'border-box', background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:6, padding:'6px 8px', fontSize:11.5, color:T.tx, fontFamily:T.font, outline:'none', marginTop:8 };
  const chip = (bg, tx) => ({ background:bg, color:tx, borderRadius:6, padding:'2px 7px', fontSize:10.5, fontWeight:600, whiteSpace:'nowrap' });
  const meta = { material:{ label:'Matériau', c:T.y }, log:{ label:'Journal', c:T.acc }, schedule:{ label:'Planifier', c:T.acc }, run:{ label:'Course', c:T.y } }[intent] || null;

  const preview = text.trim() && meta && (
    <div style={{ marginTop:10, background:T.s2, border:`1px solid ${T.bd}`, borderRadius:9, padding:'10px 11px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
        <span style={chip(meta.c + '22', meta.c)}>{meta.label}</span>
        {intent === 'material' && <span style={{ fontSize:12.5, color: parsed.material.article ? T.tx : T.tx3 }}>{parsed.material.article || 'article ?'}</span>}
        {(intent === 'log' || intent === 'schedule') && <span style={{ fontSize:12.5, color: targetAction ? T.tx : T.tx3, flex:1, minWidth:0 }}>{targetAction ? '« ' + shortDesc(targetAction.desc) + ' »' : 'choisir une action'}</span>}
        {intent === 'schedule' && <span style={{ marginLeft:'auto', fontSize:11.5, fontFamily:T.mono, color: parsed.schedule.dateISO ? T.acc : T.r }}>{parsed.schedule.dateISO ? fmtDate(parsed.schedule.dateISO) : 'ajoute une date'}</span>}
        {intent === 'run' && <span style={{ marginLeft:'auto', fontSize:11.5, fontFamily:T.mono, color: parsed.run.dateISO ? T.y : T.r }}>{parsed.run.dateISO ? fmtDate(parsed.run.dateISO) : 'ajoute une date'}{parsed.run.magasin ? ' · ' + parsed.run.magasin : ''}</span>}
      </div>
      {intent === 'material' && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:7 }}>
          {parsed.material.magasin && <span style={chip(T.s3, T.tx2)}>{parsed.material.magasin}</span>}
          {parsed.material.prix_unitaire != null && <span style={chip(T.s3, T.y)}>{parsed.material.prix_unitaire}$</span>}
          {parsed.material.qty > 1 && <span style={chip(T.s3, T.tx2)}>x{parsed.material.qty}</span>}
          {parsed.material.project && <span style={chip(T.s3, T.tx2)}>pour {parsed.material.project}</span>}
        </div>
      )}
      {intent === 'log' && <div style={{ fontSize:12, color:T.tx2, marginTop:7, lineHeight:1.5 }}>{parsed.log.text}</div>}
      {intent === 'run' && (
        <div style={{ marginTop:7, display:'flex', flexDirection:'column', gap:4 }}>
          {parsed.run.items.map((it, i) => { const ex = resolveMaterial(it.article, materials); return (
            <div key={i} style={{ fontSize:12, display:'flex', gap:7, alignItems:'baseline' }}>
              <span style={{ color:T.tx }}>{it.article}{it.qty > 1 ? ' x' + it.qty : ''}</span>
              <span style={{ fontSize:10, color: ex ? T.g : T.acc }}>{ex ? 'existant' : 'nouveau'}</span>
            </div>
          ); })}
        </div>
      )}
      {(intent === 'log' || intent === 'schedule') && (
        <select value={targetActionId || ''} onChange={e => setOverride(e.target.value)} style={sel}>
          <option value="">Choisir une action…</option>
          {allActions.map(a => <option key={a.id} value={a.id}>{a.id} · {shortDesc(a.desc, 50)}</option>)}
        </select>
      )}
    </div>
  );

  const body = (
    <div onClick={e => e.stopPropagation()} style={ variant === 'sheet'
      ? { width:'100%', background:T.s1, borderTop:`1px solid ${T.bd2}`, borderRadius:'14px 14px 0 0', padding:'14px 14px 18px', boxSizing:'border-box', maxHeight:'82vh', overflowY:'auto' }
      : { width:380, maxWidth:'92vw', background:T.s1, border:`1px solid ${T.bd2}`, borderRadius:12, padding:14, boxShadow:'0 12px 40px rgba(0,0,0,0.5)', boxSizing:'border-box' } }>
      <div style={{ display:'flex', alignItems:'center', marginBottom:9 }}>
        <span style={{ fontFamily:T.serif, fontSize:13, fontWeight:600, color:T.acc2, letterSpacing:'0.04em' }}>Ajout rapide</span>
        <button onClick={close} style={{ marginLeft:'auto', background:'transparent', border:'none', color:T.tx3, fontSize:18, cursor:'pointer', lineHeight:1 }}>×</button>
      </div>
      <input autoFocus value={text} onChange={e => { setText(e.target.value); setOverride(null); }}
        onKeyDown={e => { if (e.key === 'Enter' && canConfirm) commit(); else if (e.key === 'Escape') close(); }}
        placeholder="ex: GFCI 15A chez Rona 25$ x2 pour électricité" style={inp} />
      {preview}
      <div style={{ display:'flex', gap:8, marginTop:11, alignItems:'center' }}>
        <button onClick={commit} disabled={!canConfirm || busy}
          style={{ ...ss.btn, padding:'7px 13px', fontSize:12, color: canConfirm ? T.g : T.tx3, border:`1px solid ${canConfirm ? T.g + '55' : T.bd}`, background: canConfirm ? 'rgba(63,182,139,0.14)' : T.s2, cursor: canConfirm ? 'pointer' : 'default' }}>
          {busy ? '…' : 'Confirmer'}
        </button>
        <button onClick={close} style={{ ...ss.btn, padding:'7px 13px', fontSize:12 }}>Annuler</button>
        <span style={{ marginLeft:'auto', fontSize:9.5, color:T.tx3, textAlign:'right', lineHeight:1.3 }}>matériau · journal: … · planifier … jour · … dans la course de …</span>
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setOpen(o => !o)} title="Ajout rapide" style={triggerStyle}>+</button>
      {open && (variant === 'sheet'
        ? <div onClick={close} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end' }}>{body}</div>
        : <>
            <div onClick={close} style={{ position:'fixed', inset:0, zIndex:999 }} />
            <div style={{ position:'fixed', top:52, right:16, zIndex:1000 }}>{body}</div>
          </>
      )}
    </>
  );
}

function PhoneShell(props) {
  const { tab, setTab, systems, maintenance, statuses, mDone, shopItems, selProject, setSelProject, selAction, setSelAction, schedules, scheduleAction, onStatusChange, toggleMaint, saveShopItem, setShopItems, addShopItem, deleteShopItem, stepsDone, toggleStep, addLogEntry, linkExistingMaterial, addActionMaterial, unlinkMaterial, applyPlan, buyRuns, assignToRun, toggleBought, removeFromRun, toggleRunDone, deleteRun, saved, onHome } = props;
  const system = selProject ? systems.find(s => s.id === selProject) : null;
  const action = (system && selAction) ? system.actions.find(a => a.id === selAction) : null;

  let body;
  if (tab === 'projets') {
    if (action) body = <ActionView system={system} action={action} status={statuses[action.id] || action.status} onStatusChange={onStatusChange} schedule={schedules[action.id]} onSchedule={d => scheduleAction(action.id, d)} onBack={() => setSelAction(null)} materials={shopItems} stepsDone={stepsDone} onToggleStep={toggleStep} onAddLog={addLogEntry} onLinkMaterial={linkExistingMaterial} onAddMaterial={addActionMaterial} onUnlinkMaterial={unlinkMaterial} onApplyPlan={applyPlan} />;
    else if (system) body = <ProjectDashboard system={system} statuses={statuses} materials={shopItems} onOpenAction={id => setSelAction(id)} onBack={() => setSelProject(null)} />;
    else body = <ProjectList systems={systems} statuses={statuses} onSelect={id => { setSelProject(id); setSelAction(null); }} />;
  } else if (tab === 'aujourdhui') {
    body = <AujourdhuiView systems={systems} statuses={statuses} schedules={schedules} onOpenAction={(sysId, aid) => { setSelProject(sysId); setSelAction(aid); setTab('projets'); }} buyRuns={buyRuns} materials={shopItems} toggleBought={toggleBought} />;
  } else if (tab === 'achats') {
    body = <AchatsView narrow shopItems={shopItems} setShopItems={setShopItems} saveShopItem={saveShopItem} deleteShopItem={deleteShopItem} addShopItem={addShopItem} buyRuns={buyRuns} assignToRun={assignToRun} toggleBought={toggleBought} removeFromRun={removeFromRun} toggleRunDone={toggleRunDone} deleteRun={deleteRun} />;
  } else if (tab === 'entretien') {
    body = <EntretienView narrow maintenance={maintenance} mDone={mDone} onToggleMaint={toggleMaint} />;
  }

  return (
    <div style={{ fontFamily:T.font, display:'flex', flexDirection:'column', height:'100vh', background:T.bg, color:T.tx, overflow:'hidden' }}>
      <div style={{ height:50, flexShrink:0, background:T.hdr, borderBottom:`1px solid ${T.bd}`, display:'flex', alignItems:'center', gap:10, padding:'0 14px' }}>
        <button onClick={onHome} style={{ background:'rgba(91,156,246,0.12)', border:`1px solid rgba(91,156,246,0.2)`, borderRadius:6, padding:'4px 9px', fontSize:10, fontWeight:700, color:T.acc, cursor:'pointer', fontFamily:T.font, letterSpacing:'0.02em' }}>KarlOS</button>
        <span style={{ fontFamily:T.serif, fontSize:15, fontWeight:600, color:T.acc2, letterSpacing:'0.06em' }}>Durin's Works</span>
        <QuickAdd variant="sheet"
          triggerStyle={{ marginLeft:'auto', width:30, height:30, borderRadius:8, border:`1px solid ${T.bd2}`, background:T.s2, color:T.acc, fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', lineHeight:1 }}
          systems={systems} materials={shopItems} openActionId={selAction}
          addShopItem={addShopItem} saveShopItem={saveShopItem} addLogEntry={addLogEntry} scheduleAction={scheduleAction} assignToRun={assignToRun} />
        <span style={{ fontSize:12, color: saved ? T.g : T.tx3, fontFamily:T.mono, minWidth:12, textAlign:'center' }}>{saved ? '✓' : '…'}</span>
      </div>
      <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', WebkitOverflowScrolling:'touch' }}>{body}</div>
      <div style={{ height:60, flexShrink:0, background:T.hdr, borderTop:`1px solid ${T.bd}`, display:'flex', alignItems:'stretch' }}>
        {PHONE_TABS.map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, color: on ? T.acc : T.tx3, fontSize:10, cursor:'pointer', border:'none', background:'none', fontFamily:T.font }}>
              <TabIcon id={t.id} color={on ? T.acc : T.tx3} />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── DESKTOP SHELL ──────────────────────────────────────────────────────────────
const DESK_NAV = [
  { id:'calendrier', label:'Calendrier' },
  { id:'projets', label:'Projets' },
  { id:'achats', label:'Achats' },
  { id:'entretien', label:'Entretien' },
];

function DesktopShell(props) {
  const { tab, setTab, systems, maintenance, statuses, mDone, shopItems, selProject, setSelProject, selAction, setSelAction, schedules, scheduleAction, onStatusChange, toggleMaint, saveShopItem, setShopItems, addShopItem, deleteShopItem, stepsDone, toggleStep, addLogEntry, linkExistingMaterial, addActionMaterial, unlinkMaterial, applyPlan, buyRuns, assignToRun, toggleBought, removeFromRun, toggleRunDone, deleteRun, saved, onHome } = props;
  const system = selProject ? systems.find(s => s.id === selProject) : null;
  const action = (system && selAction) ? system.actions.find(a => a.id === selAction) : null;

  let main;
  if (tab === 'projets') {
    let detail;
    if (action) detail = <ActionView system={system} action={action} status={statuses[action.id] || action.status} onStatusChange={onStatusChange} schedule={schedules[action.id]} onSchedule={d => scheduleAction(action.id, d)} onBack={() => setSelAction(null)} backLabel="Retour au projet" materials={shopItems} stepsDone={stepsDone} onToggleStep={toggleStep} onAddLog={addLogEntry} onLinkMaterial={linkExistingMaterial} onAddMaterial={addActionMaterial} onUnlinkMaterial={unlinkMaterial} onApplyPlan={applyPlan} />;
    else if (system) detail = <ProjectDashboard system={system} statuses={statuses} materials={shopItems} onOpenAction={id => setSelAction(id)} />;
    else detail = (
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
        <div style={{ fontSize:30, opacity:0.10 }}>⚒</div>
        <span style={{ fontSize:13, color:T.tx3, fontStyle:'italic' }}>Sélectionner un projet</span>
      </div>
    );
    main = (
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        <div style={{ width:330, flexShrink:0, borderRight:`1px solid ${T.bd}`, overflowY:'auto' }}>
          <ProjectList systems={systems} statuses={statuses} selProject={selProject} onSelect={id => { setSelProject(id); setSelAction(null); }} embedded />
        </div>
        <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }}>{detail}</div>
      </div>
    );
  } else if (tab === 'achats') {
    main = <AchatsView shopItems={shopItems} setShopItems={setShopItems} saveShopItem={saveShopItem} deleteShopItem={deleteShopItem} addShopItem={addShopItem} buyRuns={buyRuns} assignToRun={assignToRun} toggleBought={toggleBought} removeFromRun={removeFromRun} toggleRunDone={toggleRunDone} deleteRun={deleteRun} />;
  } else if (tab === 'entretien') {
    main = <EntretienView maintenance={maintenance} mDone={mDone} onToggleMaint={toggleMaint} />;
  } else if (tab === 'calendrier') {
    main = <CalendarView systems={systems} statuses={statuses} schedules={schedules} scheduleAction={scheduleAction} onStatusChange={onStatusChange} materials={shopItems} stepsDone={stepsDone} toggleStep={toggleStep} addLogEntry={addLogEntry} linkExistingMaterial={linkExistingMaterial} addActionMaterial={addActionMaterial} unlinkMaterial={unlinkMaterial} applyPlan={applyPlan} buyRuns={buyRuns} toggleBought={toggleBought} removeFromRun={removeFromRun} toggleRunDone={toggleRunDone} deleteRun={deleteRun} />;
  } else {
    main = <Placeholder title="Aujourd'hui" note="Optionnel. Se remplit quand tu programmes une action (Session 2)." />;
  }

  return (
    <div style={{ fontFamily:T.font, display:'flex', height:'100vh', background:T.bg, color:T.tx, overflow:'hidden' }}>
      <div style={{ width:172, flexShrink:0, background:T.hdr, borderRight:`1px solid ${T.bd}`, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'12px 14px', borderBottom:`1px solid ${T.bd}` }}>
          <button onClick={onHome} style={{ background:'rgba(91,156,246,0.12)', border:`1px solid rgba(91,156,246,0.2)`, borderRadius:6, padding:'3px 9px', fontSize:10, fontWeight:700, color:T.acc, cursor:'pointer', fontFamily:T.font, letterSpacing:'0.02em', marginBottom:10 }}>KarlOS</button>
          <div style={{ fontFamily:T.serif, fontSize:15, fontWeight:600, color:T.acc2, letterSpacing:'0.06em' }}>Durin's Works</div>
        </div>
        <div style={{ flex:1, padding:'10px 8px', overflowY:'auto' }}>
          {DESK_NAV.map(n => {
            const on = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id)}
                style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 11px', marginBottom:3, fontSize:12.5, fontWeight: on ? 600 : 500, border:'none', borderRadius:7, cursor:'pointer', fontFamily:T.font, background: on ? 'rgba(91,156,246,0.10)' : 'transparent', color: on ? T.acc : T.tx2 }}>
                {n.label}
              </button>
            );
          })}
        </div>
        <div style={{ padding:'10px 14px', borderTop:`1px solid ${T.bd}`, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, fontFamily:T.serif, color:T.tx3, letterSpacing:'0.03em', flex:1 }}>8235, Avenue Orégon</span>
          <span style={{ fontSize:12, color: saved ? T.g : T.tx3, fontFamily:T.mono }}>{saved ? '✓' : '…'}</span>
        </div>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
        {main}
        <div style={{ position:'absolute', top:10, right:14, zIndex:25 }}>
          <QuickAdd variant="popover"
            triggerStyle={{ width:30, height:30, borderRadius:8, border:`1px solid ${T.bd2}`, background:T.s2, color:T.acc, fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', lineHeight:1, boxShadow:'0 2px 10px rgba(0,0,0,0.35)' }}
            systems={systems} materials={shopItems} openActionId={selAction}
            addShopItem={addShopItem} saveShopItem={saveShopItem} addLogEntry={addLogEntry} scheduleAction={scheduleAction} assignToRun={assignToRun} />
        </div>
      </div>
    </div>
  );
}
// ─── v2 STATE DOCUMENT (single JSONB store) ─────────────────────────────────────
// Build the full document from the static constants on first run. The constants stay
// as the seed source; once the document lives in Supabase it becomes the truth.
function buildSeedDoc() {
  return {
    meta: { address: '8235, Avenue Orégon', schemaVersion: 2 },
    systems: SYSTEMS.map(s => ({
      ...s,
      actions: s.actions.map(a => ({
        ...a,
        scheduledDate: null,
        status: 'À faire',
        cautions: [],
        steps: [],
        materialIds: [],
        log: [],
        cost: { estimate: null, actual: null, quotes: [] },
        contractor: null,
        photos: [],
      })),
    })),
    maintenance: MAINTENANCE.map(m => ({ ...m, history: [] })),
    materials: SHOPPING_SEED.map((m, i) => ({
      id: 'm' + (i + 1),
      project: m.project, article: m.article, magasin: m.magasin,
      prix_unitaire: m.prix_unitaire, qty: m.qty, status: m.status,
      lien: m.lien, notes: m.notes, sort_order: m.sort_order, bought: false,
    })),
    buyRuns: [],
  };
}

// Derive the in-memory shapes the existing views expect from the document.
function hydrateDoc(doc) {
  const st = {};
  (doc.systems || []).forEach(s => (s.actions || []).forEach(a => { st[a.id] = a.status || 'À faire'; }));
  const md = {};
  (doc.maintenance || []).forEach(m => { const h = m.history || []; if (h.length) md[m.id] = h[h.length - 1].date; });
  const items = (doc.materials || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const sched = {};
  (doc.systems || []).forEach(s => (s.actions || []).forEach(a => { if (a.scheduledDate) sched[a.id] = a.scheduledDate; }));
  const sd = {};
  (doc.systems || []).forEach(s => (s.actions || []).forEach(a => (a.steps || []).forEach(st2 => { if (st2.id) sd[`${a.id}:${st2.id}`] = !!st2.done; })));
  const runs = (doc.buyRuns || []).slice();
  return { st, md, items, sched, sd, runs };
}

// ─── MAIN APP ───────────────────────────────────────────────────────────────────
export default function DurinsWorksApp() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState('projets');
  const [selProject, setSelProject] = useState(null);
  const [selAction, setSelAction] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [mDone, setMDone] = useState({});
  const [shopItems, setShopItems] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [stepsDone, setStepsDone] = useState({});
  const [buyRuns, setBuyRuns] = useState([]);
  const [, setRev] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(true);

  // Single-document store (v2): the loaded doc, its version guard, and a once-per-session snapshot flag.
  const stateRef = useRef(null);
  const versionRef = useRef(1);
  const snappedRef = useRef(false);

  // Inject fonts
  useEffect(() => {
    if (!document.getElementById('durins-works-fonts')) {
      const link = document.createElement('link');
      link.id = 'durins-works-fonts'; link.rel = 'stylesheet'; link.href = FONT_LINK;
      document.head.appendChild(link);
    }
  }, []);

  // Load the single-document state (self-seeds from the constants on first run)
  useEffect(() => {
    const loadDoc = async () => {
      setLoading(true);
      try {
        let doc, version = 1;
        const { data } = await supabase.from('durins_works_state').select('state, version').eq('id', 1).maybeSingle();
        if (data && data.state && Array.isArray(data.state.systems) && data.state.systems.length) {
          doc = data.state; version = data.version || 1;
        } else {
          doc = buildSeedDoc();
          const { data: ins } = await supabase.from('durins_works_state')
            .upsert({ id: 1, state: doc, version: 1, updated_at: new Date().toISOString() }, { onConflict: 'id' })
            .select('version').maybeSingle();
          version = (ins && ins.version) || 1;
        }
        stateRef.current = doc;
        versionRef.current = version;
        const { st, md, items, sched, sd, runs } = hydrateDoc(doc);
        setStatuses(st); setMDone(md); setShopItems(items); setSchedules(sched); setStepsDone(sd); setBuyRuns(runs);
      } catch (e) { console.error('Durin\'s Works load error:', e); }
      setLoading(false);
    };
    loadDoc();
  }, []);

  const flash = () => { setSaved(false); setTimeout(() => setSaved(true), 900); };
  const bump = useCallback(() => setRev(r => r + 1), []);

  // Persist the whole document with an optimistic version guard + once-per-session snapshot.
  const persist = useCallback(async (label) => {
    flash();
    const doc = stateRef.current;
    if (!doc) return;
    try {
      if (!snappedRef.current) {
        snappedRef.current = true;
        await supabase.from('durins_works_snapshots').insert({ label: label || ('auto ' + today()), state: doc });
      }
      const guard = versionRef.current;
      const { data } = await supabase.from('durins_works_state')
        .update({ state: doc, version: guard + 1, updated_at: new Date().toISOString() })
        .eq('id', 1).eq('version', guard).select('version').maybeSingle();
      if (data) { versionRef.current = data.version; return; }
      // Version moved under us (another tab/session): refetch and rewrite once.
      const { data: fresh } = await supabase.from('durins_works_state').select('version').eq('id', 1).maybeSingle();
      const base = fresh ? fresh.version : guard;
      await supabase.from('durins_works_state')
        .update({ state: doc, version: base + 1, updated_at: new Date().toISOString() })
        .eq('id', 1);
      versionRef.current = base + 1;
    } catch (e) { console.error('Durin\'s Works persist error:', e); }
  }, []);

  const saveStatus = useCallback(async (actionId, status) => {
    const doc = stateRef.current;
    if (doc) doc.systems.forEach(s => s.actions.forEach(a => { if (a.id === actionId) a.status = status; }));
    await persist('statut ' + actionId);
  }, [persist]);

  const changeStatus = useCallback((id, val) => {
    setStatuses(prev => ({ ...prev, [id]: val }));
    saveStatus(id, val);
  }, [saveStatus]);

  const scheduleAction = useCallback((id, date) => {
    setSchedules(prev => { const n = { ...prev }; if (date) n[id] = date; else delete n[id]; return n; });
    const doc = stateRef.current;
    if (doc) doc.systems.forEach(s => s.actions.forEach(a => { if (a.id === id) a.scheduledDate = date || null; }));
    persist('planif ' + id);
  }, [persist]);

  const toggleMaint = useCallback(async (taskId, checked) => {
    const doneDate = checked ? today() : null;
    setMDone(prev => ({ ...prev, [taskId]: doneDate }));
    const doc = stateRef.current;
    if (doc) {
      const m = (doc.maintenance || []).find(x => x.id === taskId);
      if (m) {
        m.history = m.history || [];
        if (checked) { if (!m.history.some(h => h.date === today())) m.history.push({ date: today() }); }
        else { m.history = m.history.filter(h => h.date !== today()); }
      }
    }
    await persist('entretien ' + taskId);
  }, [persist]);

  const saveShopItem = useCallback(async (id, updates) => {
    setShopItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    const doc = stateRef.current;
    if (doc) doc.materials = (doc.materials || []).map(i => i.id === id ? { ...i, ...updates } : i);
    await persist('achat maj');
  }, [persist]);

  const addShopItem = useCallback(async (item) => {
    const row = { id: 'm' + Date.now(), sort_order: Date.now(), bought: false, ...item };
    setShopItems(prev => [...prev, row]);
    const doc = stateRef.current;
    if (doc) doc.materials = [...(doc.materials || []), row];
    await persist('achat ajout');
    return row;
  }, [persist]);

  const deleteShopItem = useCallback(async (id) => {
    setShopItems(prev => prev.filter(i => i.id !== id));
    const doc = stateRef.current;
    if (doc) doc.materials = (doc.materials || []).filter(i => i.id !== id);
    await persist('achat suppr');
  }, [persist]);

  const toggleStep = useCallback((actionId, stepId) => {
    if (!stepId) return;
    const doc = stateRef.current;
    if (!doc) return;
    let next = false;
    doc.systems.forEach(s => s.actions.forEach(a => {
      if (a.id === actionId) (a.steps || []).forEach(st2 => { if (st2.id === stepId) { st2.done = !st2.done; next = st2.done; } });
    }));
    setStepsDone(prev => ({ ...prev, [`${actionId}:${stepId}`]: next }));
    persist('étape ' + actionId);
  }, [persist]);

  const addLogEntry = useCallback((actionId, text) => {
    const t = (text || '').trim();
    if (!t) return;
    const doc = stateRef.current;
    if (!doc) return;
    doc.systems.forEach(s => s.actions.forEach(a => {
      if (a.id === actionId) { a.log = a.log || []; a.log.push({ at: new Date().toISOString(), text: t }); }
    }));
    bump();
    persist('journal ' + actionId);
  }, [persist, bump]);

  const linkExistingMaterial = useCallback((actionId, materialId) => {
    const doc = stateRef.current;
    if (!doc) return;
    doc.systems.forEach(s => s.actions.forEach(a => {
      if (a.id === actionId) { a.materialIds = a.materialIds || []; if (!a.materialIds.includes(materialId)) a.materialIds.push(materialId); }
    }));
    bump();
    persist('lien matériau ' + actionId);
  }, [persist, bump]);

  const addActionMaterial = useCallback((actionId, item, systemName) => {
    const doc = stateRef.current;
    if (!doc) return;
    const row = { id: 'm' + Date.now(), sort_order: Date.now(), bought: false, status: 'À trouver',
      project: systemName || '', article: '', magasin: '', prix_unitaire: null, qty: 1, lien: '', notes: '', ...item };
    doc.materials = [...(doc.materials || []), row];
    doc.systems.forEach(s => s.actions.forEach(a => {
      if (a.id === actionId) { a.materialIds = a.materialIds || []; a.materialIds.push(row.id); }
    }));
    setShopItems(prev => [...prev, row]);
    bump();
    persist('matériau ajout ' + actionId);
  }, [persist, bump]);

  const unlinkMaterial = useCallback((actionId, materialId) => {
    const doc = stateRef.current;
    if (!doc) return;
    doc.systems.forEach(s => s.actions.forEach(a => {
      if (a.id === actionId) a.materialIds = (a.materialIds || []).filter(x => x !== materialId);
    }));
    bump();
    persist('retrait lien ' + actionId);
  }, [persist, bump]);

  const applyPlan = useCallback((actionId, parsed, systemName) => {
    const doc = stateRef.current;
    if (!doc) return;
    let action = null;
    doc.systems.forEach(s => s.actions.forEach(a => { if (a.id === actionId) action = a; }));
    if (!action) return;
    const base = Date.now();
    if (parsed.hasSteps) {
      action.steps = parsed.steps.map((st2, i) => ({
        id: 'st' + base + '_' + i, text: st2.text || '', detail: st2.detail || '',
        material: st2.material || '', caution: st2.caution || '', done: false,
      }));
    }
    if (parsed.hasCautions) action.cautions = parsed.cautions.slice();
    const newMats = [];
    if (parsed.hasMaterials) {
      action.materialIds = action.materialIds || [];
      parsed.materials.forEach((pm, i) => {
        const key = (pm.article || '').trim().toLowerCase();
        if (!key) return;
        const existing = (doc.materials || []).find(m => (m.article || '').trim().toLowerCase() === key)
          || newMats.find(m => (m.article || '').trim().toLowerCase() === key);
        if (existing) { if (!action.materialIds.includes(existing.id)) action.materialIds.push(existing.id); }
        else {
          const row = { id: 'm' + base + '_' + i, sort_order: base + i, bought: false, status: 'À trouver',
            project: systemName || '', article: pm.article, magasin: pm.magasin || '',
            prix_unitaire: pm.prix_unitaire == null ? null : pm.prix_unitaire, qty: pm.qty || 1, lien: '', notes: '' };
          newMats.push(row);
          action.materialIds.push(row.id);
        }
      });
      if (newMats.length) doc.materials = [...(doc.materials || []), ...newMats];
    }
    if (newMats.length) setShopItems(prev => [...prev, ...newMats]);
    if (parsed.hasSteps) {
      setStepsDone(prev => { const n = { ...prev }; action.steps.forEach(st2 => { n[`${actionId}:${st2.id}`] = false; }); return n; });
    }
    bump();
    persist('plan collé ' + actionId);
  }, [persist, bump]);

  const assignToRun = useCallback((materialIds, date) => {
    if (!date || !materialIds || !materialIds.length) return;
    const doc = stateRef.current;
    if (!doc) return;
    doc.buyRuns = doc.buyRuns || [];
    const mats = doc.materials || [];
    const byStore = {};
    materialIds.forEach(id => {
      const m = mats.find(x => x.id === id);
      if (!m) return;
      const store = (m.magasin || '').trim() || 'Magasin à confirmer';
      (byStore[store] = byStore[store] || []).push(id);
    });
    const base = Date.now();
    Object.keys(byStore).forEach((store, i) => {
      let run = doc.buyRuns.find(r => r.date === date && (((r.magasin || '').trim() || 'Magasin à confirmer') === store));
      if (!run) {
        run = { id: 'r' + base + '_' + i, date, magasin: store === 'Magasin à confirmer' ? '' : store, materialIds: [], done: false };
        doc.buyRuns.push(run);
      }
      byStore[store].forEach(id => { if (!run.materialIds.includes(id)) run.materialIds.push(id); });
    });
    setBuyRuns(doc.buyRuns.slice());
    bump();
    persist('course assign ' + date);
  }, [persist, bump]);

  const toggleBought = useCallback((materialId) => {
    const doc = stateRef.current;
    if (!doc) return;
    let nb = false;
    doc.materials = (doc.materials || []).map(m => { if (m.id === materialId) { nb = !m.bought; return { ...m, bought: nb }; } return m; });
    setShopItems(doc.materials.slice());
    bump();
    persist('acheté ' + materialId);
  }, [persist, bump]);

  const removeFromRun = useCallback((runId, materialId) => {
    const doc = stateRef.current;
    if (!doc) return;
    doc.buyRuns = (doc.buyRuns || [])
      .map(r => r.id === runId ? { ...r, materialIds: (r.materialIds || []).filter(id => id !== materialId) } : r)
      .filter(r => (r.materialIds || []).length);
    setBuyRuns(doc.buyRuns.slice());
    bump();
    persist('retrait course ' + runId);
  }, [persist, bump]);

  const toggleRunDone = useCallback((runId) => {
    const doc = stateRef.current;
    if (!doc) return;
    doc.buyRuns = (doc.buyRuns || []).map(r => r.id === runId ? { ...r, done: !r.done } : r);
    setBuyRuns(doc.buyRuns.slice());
    bump();
    persist('course faite ' + runId);
  }, [persist, bump]);

  const deleteRun = useCallback((runId) => {
    const doc = stateRef.current;
    if (!doc) return;
    doc.buyRuns = (doc.buyRuns || []).filter(r => r.id !== runId);
    setBuyRuns(doc.buyRuns.slice());
    bump();
    persist('course suppr ' + runId);
  }, [persist, bump]);

  if (loading) {
    return (
      <div style={{ fontFamily:T.font, display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:T.bg, color:T.tx2, fontSize:13 }}>
        Chargement Durin's Works…
      </div>
    );
  }

  const doc = stateRef.current;
  const systems = (doc && doc.systems) || [];
  const maintenance = (doc && doc.maintenance) || [];

  const shellProps = {
    tab, setTab, systems, maintenance, statuses, mDone, shopItems,
    selProject, setSelProject, selAction, setSelAction, schedules, scheduleAction,
    onStatusChange: changeStatus, toggleMaint, saveShopItem, setShopItems, addShopItem, deleteShopItem,
    stepsDone, toggleStep, addLogEntry, linkExistingMaterial, addActionMaterial, unlinkMaterial, applyPlan,
    buyRuns, assignToRun, toggleBought, removeFromRun, toggleRunDone, deleteRun,
    saved, onHome: () => navigate('/'),
  };

  return isDesktop ? <DesktopShell {...shellProps} /> : <PhoneShell {...shellProps} />;
}
