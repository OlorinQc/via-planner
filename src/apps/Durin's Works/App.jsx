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

// ─── RESIZE HANDLE ────────────────────────────────────────────────────────────
function ResizeHandle({ currentWidth, onResizeLive, onResizeEnd, min=200, max=560 }) {
  const onMouseDown = e => {
    e.preventDefault();
    const startX = e.clientX, startW = currentWidth;
    const clamp = v => Math.max(min, Math.min(max, v));
    const onMove = e => onResizeLive(clamp(startW + e.clientX - startX));
    const onUp = e => { onResizeEnd(clamp(startW + e.clientX - startX)); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  return (
    <div onMouseDown={onMouseDown}
      style={{ width:5, cursor:'col-resize', flexShrink:0, background:'transparent', transition:'background .15s', zIndex:10 }}
      onMouseEnter={e => e.currentTarget.style.background = T.acc}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    />
  );
}

// ─── DASHBOARD VIEW ───────────────────────────────────────────────────────────
function DashboardView({ statuses, mDone, onGoToAction, onToggleMaint }) {
  const allActions = useMemo(() => SYSTEMS.flatMap(s => s.actions.map(a => ({ ...a, sysId:s.id, sysName:s.name }))), []);
  const done = allActions.filter(a => statuses[a.id] === 'Fait').length;
  const inProg = allActions.filter(a => statuses[a.id] === 'En cours').length;
  const urgentLeft = allActions.filter(a => isUrgentTiming(a.timing) && statuses[a.id] !== 'Fait').length;
  const remaining = allActions.length - done;
  const season = currentSeason();
  const seasonTasks = MAINTENANCE.filter(t => seasonMatch(t.season, season));

  const urgentActions = allActions
    .filter(a => isUrgentTiming(a.timing) && statuses[a.id] !== 'Fait')
    .sort((a,b) => (PRIORITY_ORDER[a.priority]||9) - (PRIORITY_ORDER[b.priority]||9))
    .slice(0, 8);

  const metrics = [
    { num: urgentLeft, label:'Actions urgentes restantes', color: urgentLeft > 0 ? T.r : T.g },
    { num: inProg, label:'En cours', color: inProg > 0 ? T.acc : T.tx2 },
    { num: done, label:'Tâches complétées', color: T.g },
    { num: remaining, label:'Tâches restantes', color: T.tx },
    { num: SYSTEMS.length, label:'Systèmes', color: T.tx2 },
  ];

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>
      {/* Metric cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:24 }}>
        {metrics.map((m,i) => (
          <div key={i} style={{ background:T.s1, border:`1px solid ${T.bd}`, borderRadius:8, padding:'12px 14px' }}>
            <div style={{ fontSize:28, fontWeight:700, fontFamily:T.mono, color:m.color, marginBottom:2 }}>{m.num}</div>
            <div style={{ fontSize:10, color:T.tx2, lineHeight:1.3 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Urgent actions */}
      {urgentActions.length > 0 && (
        <>
          <div style={{ fontSize:11, fontWeight:600, color:T.tx2, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:10 }}>
            Actions prioritaires restantes
          </div>
          <div style={{ marginBottom:22 }}>
            {urgentActions.map(a => (
              <div key={a.id} onClick={() => onGoToAction(a.id, a.sysId)}
                style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'9px 12px', background:T.s1,
                  border:`1px solid ${PRIORITY[a.priority]?.border || T.bd}`, borderLeft:`3px solid ${PRIORITY[a.priority]?.tx || T.bd}`,
                  borderRadius:6, marginBottom:4, cursor:'pointer', transition:'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = T.s2}
                onMouseLeave={e => e.currentTarget.style.background = T.s1}
              >
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:T.tx, lineHeight:1.4, marginBottom:4 }}>
                    {a.desc.length > 100 ? a.desc.substring(0,100) + '…' : a.desc}
                  </div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                    <TimingBadge t={a.timing} />
                    <PriorityBadge p={a.priority} />
                  </div>
                </div>
                <div style={{ fontSize:10, color:T.tx3, textAlign:'right', flexShrink:0, maxWidth:130, lineHeight:1.3 }}>{a.sysName}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Seasonal maintenance */}
      <div style={{ fontSize:11, fontWeight:600, color:T.tx2, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:10 }}>
        Entretien — {season} {new Date().getFullYear()}
        <span style={{ ...ss.pill('rgba(63,182,139,0.12)', T.g), marginLeft:8, fontSize:9 }}>
          {seasonTasks.filter(t => mDone[t.id]).length}/{seasonTasks.length} fait
        </span>
      </div>
      <div>
        {seasonTasks.map(t => (
          <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
            background: mDone[t.id] ? 'rgba(63,182,139,0.05)' : T.s1,
            border:`1px solid ${T.bd}`, borderRadius:6, marginBottom:4 }}
          >
            <input type="checkbox" checked={!!mDone[t.id]} onChange={e => onToggleMaint(t.id, e.target.checked)}
              style={{ width:15, height:15, cursor:'pointer', accentColor:T.g, flexShrink:0 }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, color: mDone[t.id] ? T.tx3 : T.tx, textDecoration: mDone[t.id] ? 'line-through' : 'none' }}>
                {t.task}
              </div>
              {mDone[t.id] && <div style={{ fontSize:10, color:T.g, marginTop:2 }}>✓ {mDone[t.id]}</div>}
            </div>
            <span style={{ fontSize:10, color:T.tx3, flexShrink:0 }}>{t.zone}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TRAVAUX VIEW ─────────────────────────────────────────────────────────────
function TravauxView({ statuses, setStatuses, saveStatus, searchQuery }) {
  const [selSys, setSelSys] = useState(null);
  const [selAction, setSelAction] = useState(null);
  const [fStatus, setFStatus] = useState('all');
  const [fPriority, setFPriority] = useState('all');
  const [leftW, setLeftW] = useState(300);
  const [liveW, setLiveW] = useState(null);
  const panelW = liveW ?? leftW;

  const filtered = useMemo(() => {
    return SYSTEMS.filter(sys => {
      if (fStatus !== 'all') {
        const hasMatch = sys.actions.some(a => (statuses[a.id] || 'À faire') === fStatus);
        if (!hasMatch) return false;
      }
      if (fPriority !== 'all' && sys.priority !== fPriority) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return sys.name.toLowerCase().includes(q) ||
          sys.zone.toLowerCase().includes(q) ||
          sys.actions.some(a => a.desc.toLowerCase().includes(q) || a.composantes.join(' ').toLowerCase().includes(q));
      }
      return true;
    });
  }, [fStatus, fPriority, searchQuery, statuses]);

  const PRI_ORDER = ['Urgent','Danger','Défaut','Avertissement','Surveillance','Info','Limité','Hors mandat','—'];
  const byPriority = PRI_ORDER.map(p => ({ p, systems: filtered.filter(s => s.priority === p) })).filter(g => g.systems.length > 0);

  const activeSys = selSys ? SYSTEMS.find(s => s.id === selSys) : null;
  const activeAction = useMemo(() => {
    if (!selAction) return null;
    for (const s of SYSTEMS) { const a = s.actions.find(a => a.id === selAction); if (a) return { action:a, sys:s }; }
    return null;
  }, [selAction]);

  const handleStatusChange = (id, val) => {
    setStatuses(prev => ({ ...prev, [id]: val }));
    saveStatus(id, val);
  };

  const selectSys = id => { setSelSys(prev => prev === id ? null : id); setSelAction(null); };
  const selStyle = { outline:'none', background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'3px 6px', fontSize:11, cursor:'pointer', color:T.tx, fontFamily:T.font };

  // ── Left panel ──
  const LeftPanel = (
    <div style={{ width:panelW, flexShrink:0, display:'flex', flexDirection:'column', overflow:'hidden', borderRight:`1px solid ${T.bd}` }}>
      <div style={{ padding:'8px 10px', borderBottom:`1px solid ${T.bd}`, background:T.s1, flexShrink:0 }}>
        <div style={{ display:'flex', gap:3, marginBottom:6, flexWrap:'wrap' }}>
          {['all','À faire','En cours','Fait','Reporté'].map(s => (
            <button key={s} onClick={() => setFStatus(s)}
              style={{ ...ss.btn, fontSize:10, padding:'2px 7px', background:fStatus===s?T.acc:'transparent', color:fStatus===s?'#fff':T.tx2, border:`1px solid ${fStatus===s?T.acc:T.bd}` }}>
              {s === 'all' ? 'Tous' : s}
            </button>
          ))}
        </div>
        <select value={fPriority} onChange={e => setFPriority(e.target.value)} style={{ ...selStyle, width:'100%' }}>
          <option value="all">Toutes priorités</option>
          {['Urgent','Danger','Défaut','Avertissement','Surveillance','Limité'].map(p => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
        {byPriority.length === 0 && <div style={{ textAlign:'center', padding:'30px 10px', color:T.tx3, fontSize:12, fontStyle:'italic' }}>Aucun système.</div>}
        {byPriority.map(g => (
          <div key={g.p} style={{ marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:700, color:(PRIORITY[g.p]||PRIORITY['—']).tx, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:5, paddingLeft:4 }}>
              {g.p} <span style={{ opacity:0.5 }}>({g.systems.length})</span>
            </div>
            {g.systems.map(sys => {
              const pc = PRIORITY[sys.priority] || PRIORITY['—'];
              const done = sys.actions.filter(a => statuses[a.id] === 'Fait').length;
              const isSel = selSys === sys.id;
              return (
                <div key={sys.id} onClick={() => selectSys(sys.id)}
                  style={{ padding:'8px 10px', borderRadius:6, marginBottom:3, cursor:'pointer',
                    background: isSel ? 'rgba(91,156,246,0.10)' : T.s1,
                    border:`1px solid ${isSel ? T.acc : T.bd}`,
                    borderLeft:`3px solid ${pc.tx}`, transition:'background .1s' }}
                  onMouseEnter={e => !isSel && (e.currentTarget.style.background = T.s2)}
                  onMouseLeave={e => !isSel && (e.currentTarget.style.background = T.s1)}
                >
                  <div style={{ fontSize:12, fontWeight:600, color:T.tx, lineHeight:1.3, marginBottom:4 }}>{sys.name}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <TimingBadge t={sys.timing} />
                    <span style={{ marginLeft:'auto', fontSize:10, color:done===sys.actions.length?T.g:T.tx3, fontFamily:T.mono }}>{done}/{sys.actions.length}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ padding:'6px 10px', borderTop:`1px solid ${T.bd}`, background:T.s1, fontSize:10, color:T.tx3, flexShrink:0 }}>
        {filtered.length} système{filtered.length!==1?'s':''} · {filtered.reduce((n,s)=>n+s.actions.length,0)} actions
      </div>
    </div>
  );

  // ── System detail panel ──
  const SystemPanel = activeSys && !selAction ? (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bd}`, background:T.s1, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:8 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:T.tx, lineHeight:1.3, marginBottom:3 }}>{activeSys.name}</div>
            <div style={{ fontSize:11, color:T.tx3 }}>{activeSys.zone}</div>
          </div>
          <button onClick={() => setSelSys(null)} style={{ ...ss.btn, padding:'2px 8px', flexShrink:0 }}>×</button>
        </div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
          <PriorityBadge p={activeSys.priority} />
          <TimingBadge t={activeSys.timing} />
          {(() => { const done = activeSys.actions.filter(a => statuses[a.id] === 'Fait').length; const total = activeSys.actions.length;
            return <span style={{ ...ss.pill(done===total?'rgba(63,182,139,0.12)':'rgba(62,74,90,0.15)', done===total?T.g:T.tx2), fontSize:9 }}>{done}/{total} fait</span>; })()}
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, fontWeight:700, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Ce que l'on sait</div>
          <div style={{ fontSize:12, color:T.tx2, lineHeight:1.7, background:T.s1, border:`1px solid ${T.bd}`, borderRadius:6, padding:'10px 12px' }}>{activeSys.ceQueOnSait}</div>
        </div>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Pourquoi c'est important</div>
          <div style={{ fontSize:12, color:T.tx2, lineHeight:1.7, background:T.s1, border:`1px solid ${T.bd}`, borderRadius:6, padding:'10px 12px' }}>{activeSys.pourquoi}</div>
        </div>
        <div style={{ fontSize:10, fontWeight:700, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Actions ({activeSys.actions.length})</div>
        {activeSys.actions.map(a => {
          const st = statuses[a.id] || 'À faire';
          const wc = WSTATUS[st] || WSTATUS['À faire'];
          const pc = PRIORITY[a.priority] || PRIORITY['—'];
          return (
            <div key={a.id} onClick={() => setSelAction(a.id)}
              style={{ padding:'10px 12px', borderRadius:6, marginBottom:5, cursor:'pointer',
                background: st==='Fait'?'rgba(63,182,139,0.04)':T.s1,
                border:`1px solid ${T.bd}`, borderLeft:`3px solid ${pc.tx}`,
                opacity: st==='Fait'?0.65:1, transition:'background .1s' }}
              onMouseEnter={e => e.currentTarget.style.background = T.s2}
              onMouseLeave={e => e.currentTarget.style.background = st==='Fait'?'rgba(63,182,139,0.04)':T.s1}
            >
              <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:st==='Fait'?T.tx3:T.tx, lineHeight:1.5, marginBottom:5,
                    textDecoration:st==='Fait'?'line-through':'none' }}>{a.desc}</div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
                    <TimingBadge t={a.timing} />
                    <PriorityBadge p={a.priority} />
                    {a.composantes.slice(0,3).map(c => (
                      <span key={c} style={{ fontSize:9, background:T.s3, color:T.acc, padding:'1px 5px', borderRadius:3, fontFamily:T.mono }}>{c}</span>
                    ))}
                    {a.composantes.length > 3 && <span style={{ fontSize:9, color:T.tx3 }}>+{a.composantes.length-3}</span>}
                  </div>
                </div>
                <select value={st} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); handleStatusChange(a.id, e.target.value); }}
                  style={{ background:wc.bg, color:wc.tx, border:`1px solid ${wc.tx}44`, borderRadius:4, padding:'3px 6px', fontSize:11, cursor:'pointer', fontFamily:T.font, outline:'none', flexShrink:0 }}>
                  {['À faire','En cours','Fait','Reporté','À confirmer','Sans objet'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  // ── Action detail panel ──
  const ActionPanel = activeAction ? (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'10px 14px', borderBottom:`1px solid ${T.bd}`, background:T.s1, flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>
        <button onClick={() => setSelAction(null)}
          style={{ ...ss.btn, fontSize:10, padding:'3px 9px', display:'flex', alignItems:'center', gap:4 }}>
          ← {activeAction.sys.name.length > 28 ? activeAction.sys.name.substring(0,28)+'…' : activeAction.sys.name}
        </button>
        <button onClick={() => { setSelSys(null); setSelAction(null); }} style={{ ...ss.btn, padding:'3px 8px', marginLeft:'auto' }}>×</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
        <div style={{ fontSize:14, fontWeight:600, color:T.tx, lineHeight:1.5, marginBottom:16, paddingBottom:14, borderBottom:`1px solid ${T.bd}` }}>
          {activeAction.action.desc}
        </div>
        {/* Prominent status selector */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Statut</div>
          {(() => {
            const st = statuses[activeAction.action.id] || 'À faire';
            const wc = WSTATUS[st] || WSTATUS['À faire'];
            return (
              <select value={st} onChange={e => handleStatusChange(activeAction.action.id, e.target.value)}
                style={{ background:wc.bg, color:wc.tx, border:`1px solid ${wc.tx}55`,
                  borderRadius:6, padding:'7px 12px', fontSize:13, fontWeight:600,
                  cursor:'pointer', fontFamily:T.font, outline:'none', width:'100%' }}>
                {['À faire','En cours','Fait','Reporté','À confirmer','Sans objet'].map(o => <option key={o}>{o}</option>)}
              </select>
            );
          })()}
        </div>
        {/* Metadata rows */}
        {[
          ['Système', activeAction.sys.name],
          ['Zone', activeAction.sys.zone],
          ['Priorité', <PriorityBadge p={activeAction.action.priority} />],
          ['Timing', <TimingBadge t={activeAction.action.timing} />],
          activeAction.action.composantes.length > 0 && ['Composantes', (
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {activeAction.action.composantes.map(c => (
                <span key={c} style={{ fontSize:11, background:T.s3, color:T.acc, padding:'2px 7px', borderRadius:4, fontFamily:T.mono, fontWeight:600 }}>{c}</span>
              ))}
            </div>
          )],
          activeAction.action.notes && ['Notes', activeAction.action.notes],
          activeAction.action.source && ['Source', <span style={{ fontFamily:T.mono, fontSize:11, color:T.tx3 }}>{activeAction.action.source}</span>],
        ].filter(Boolean).map(([label, val]) => (
          <div key={label} style={{ display:'flex', gap:12, marginBottom:11, paddingBottom:11, borderBottom:`1px solid ${T.bd3}`, alignItems:'flex-start' }}>
            <span style={{ fontSize:11, fontWeight:600, color:T.tx3, minWidth:90, paddingTop:1, flexShrink:0 }}>{label}</span>
            <span style={{ fontSize:12, color:T.tx2, flex:1, lineHeight:1.6 }}>{val}</span>
          </div>
        ))}
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:10, fontWeight:700, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Pourquoi</div>
          <div style={{ fontSize:12, color:T.tx2, lineHeight:1.7, background:T.s1, border:`1px solid ${T.bd}`, borderRadius:6, padding:'10px 12px' }}>{activeAction.sys.pourquoi}</div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {LeftPanel}
      <ResizeHandle currentWidth={panelW} onResizeLive={setLiveW} onResizeEnd={v => { setLiveW(null); setLeftW(v); }} />
      {selAction ? ActionPanel : selSys ? SystemPanel :
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:32, opacity:0.10 }}>⚒</div>
          <span style={{ fontSize:13, color:T.tx3, fontStyle:'italic' }}>Sélectionner un système</span>
        </div>
      }
    </div>
  );
}

// ─── ACHATS VIEW ──────────────────────────────────────────────────────────────
function AchatsView({ shopItems, setShopItems, saveShopItem, deleteShopItem, addShopItem }) {
  const [fProject, setFProject] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ project:'', article:'', magasin:'', prix_unitaire:'', qty:1, status:'À trouver', lien:'', notes:'' });

  const projects = useMemo(() => [...new Set(shopItems.map(i => i.project))].sort(), [shopItems]);

  const filtered = useMemo(() => {
    return shopItems.filter(i => {
      if (fProject !== 'all' && i.project !== fProject) return false;
      if (fStatus !== 'all' && i.status !== fStatus) return false;
      return true;
    });
  }, [shopItems, fProject, fStatus]);

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(i => { if (!g[i.project]) g[i.project] = []; g[i.project].push(i); });
    return g;
  }, [filtered]);

  const totalCost = useMemo(() => {
    return filtered.filter(i => i.prix_unitaire && i.status !== 'À trouver')
      .reduce((sum,i) => sum + (i.prix_unitaire * (i.qty||1)), 0);
  }, [filtered]);

  const openAdd = () => { setForm({ project:fProject !== 'all' ? fProject : '', article:'', magasin:'', prix_unitaire:'', qty:1, status:'À trouver', lien:'', notes:'' }); setEditItem(null); setShowForm(true); };
  const openEdit = (item) => { setForm({ ...item, prix_unitaire: item.prix_unitaire ?? '' }); setEditItem(item.id); setShowForm(true); };

  const handleSave = async () => {
    const item = { ...form, prix_unitaire: form.prix_unitaire !== '' ? parseFloat(form.prix_unitaire) : null, qty: parseInt(form.qty)||1 };
    if (editItem) {
      await saveShopItem(editItem, item);
    } else {
      await addShopItem(item);
    }
    setShowForm(false);
  };

  const inp = { background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:5, padding:'6px 10px', fontSize:12, color:T.tx, fontFamily:T.font, outline:'none', width:'100%', boxSizing:'border-box' };
  const selStyle = { ...inp, cursor:'pointer' };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Filter bar */}
      <div style={{ padding:'10px 16px', borderBottom:`1px solid ${T.bd}`, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', background:T.s1 }}>
        <select value={fProject} onChange={e => setFProject(e.target.value)} style={{ background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'3px 8px', fontSize:11, color:T.tx, cursor:'pointer', fontFamily:T.font, outline:'none' }}>
          <option value="all">Tous les projets</option>
          {projects.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'3px 8px', fontSize:11, color:T.tx, cursor:'pointer', fontFamily:T.font, outline:'none' }}>
          <option value="all">Tous statuts</option>
          {Object.keys(PSTATUS).map(s => <option key={s}>{s}</option>)}
        </select>
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          {totalCost > 0 && <span style={{ fontSize:11, color:T.y, fontFamily:T.mono }}>~{totalCost.toLocaleString('fr-CA', { style:'currency', currency:'CAD', maximumFractionDigits:0 })} confirmé</span>}
          <button onClick={openAdd} style={{ ...ss.btn, background:'rgba(91,156,246,0.12)', color:T.acc, border:`1px solid rgba(91,156,246,0.25)` }}>+ Article</button>
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div style={{ padding:'16px', borderBottom:`1px solid ${T.bd}`, background:T.s2 }}>
          <div style={{ fontSize:12, fontWeight:600, color:T.acc2, marginBottom:12 }}>{editItem ? 'Modifier l\'article' : 'Nouvel article'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div>
              <div style={{ fontSize:10, color:T.tx3, marginBottom:4 }}>Projet *</div>
              <input value={form.project} onChange={e => setForm(f=>({...f,project:e.target.value}))} placeholder="Îlot de cuisine…" style={inp} list="projects-list" />
              <datalist id="projects-list">{projects.map(p=><option key={p} value={p}/>)}</datalist>
            </div>
            <div>
              <div style={{ fontSize:10, color:T.tx3, marginBottom:4 }}>Statut</div>
              <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))} style={selStyle}>
                {Object.keys(PSTATUS).map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, color:T.tx3, marginBottom:4 }}>Article *</div>
            <input value={form.article} onChange={e => setForm(f=>({...f,article:e.target.value}))} placeholder="Description de l'article…" style={inp} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 80px', gap:10, marginBottom:10 }}>
            <div>
              <div style={{ fontSize:10, color:T.tx3, marginBottom:4 }}>Magasin / Fournisseur</div>
              <input value={form.magasin} onChange={e => setForm(f=>({...f,magasin:e.target.value}))} placeholder="IKEA, Rona…" style={inp} />
            </div>
            <div>
              <div style={{ fontSize:10, color:T.tx3, marginBottom:4 }}>Prix unitaire ($)</div>
              <input type="number" value={form.prix_unitaire} onChange={e => setForm(f=>({...f,prix_unitaire:e.target.value}))} placeholder="0.00" style={inp} />
            </div>
            <div>
              <div style={{ fontSize:10, color:T.tx3, marginBottom:4 }}>Qté</div>
              <input type="number" min={1} value={form.qty} onChange={e => setForm(f=>({...f,qty:e.target.value}))} style={inp} />
            </div>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, color:T.tx3, marginBottom:4 }}>Lien / URL</div>
            <input value={form.lien} onChange={e => setForm(f=>({...f,lien:e.target.value}))} placeholder="https://…" style={inp} />
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10, color:T.tx3, marginBottom:4 }}>Notes</div>
            <input value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Référence, dimensions, contexte…" style={inp} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleSave} disabled={!form.project || !form.article}
              style={{ ...ss.btn, background: form.project&&form.article ? 'rgba(63,182,139,0.15)' : T.s3, color: form.project&&form.article ? T.g : T.tx3, border:`1px solid ${form.project&&form.article ? T.g+'44' : T.bd}` }}>
              {editItem ? 'Enregistrer' : 'Ajouter'}
            </button>
            <button onClick={() => setShowForm(false)} style={ss.btn}>Annuler</button>
          </div>
        </div>
      )}

      {/* Items list */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
        {Object.entries(grouped).map(([project, items]) => {
          const projTotal = items.filter(i => i.prix_unitaire).reduce((s,i) => s + i.prix_unitaire*(i.qty||1), 0);
          return (
            <div key={project} style={{ marginBottom:18 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <span style={{ fontSize:12, fontWeight:600, color:T.tx }}>{project}</span>
                {projTotal > 0 && <span style={{ fontSize:10, color:T.y, fontFamily:T.mono }}>{projTotal.toLocaleString('fr-CA', { style:'currency', currency:'CAD', maximumFractionDigits:0 })}</span>}
                <span style={{ fontSize:10, color:T.tx3 }}>{items.length} article{items.length>1?'s':''}</span>
              </div>
              {items.map(item => (
                <div key={item.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'9px 12px',
                  background:T.s1, border:`1px solid ${T.bd}`, borderRadius:6, marginBottom:4 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, color:T.tx, lineHeight:1.4, marginBottom:4 }}>{item.article}</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                      {item.magasin && <span style={{ fontSize:10, color:T.tx2 }}>{item.magasin}</span>}
                      {item.prix_unitaire && <span style={{ fontSize:10, color:T.y, fontFamily:T.mono }}>{(item.prix_unitaire*(item.qty||1)).toLocaleString('fr-CA', { style:'currency', currency:'CAD' })} {item.qty>1 ? `(${item.qty}×${item.prix_unitaire}$)` : ''}</span>}
                      {item.notes && <span style={{ fontSize:10, color:T.tx3 }}>{item.notes}</span>}
                    </div>
                    {item.lien && <a href={item.lien} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:10, color:T.acc, display:'block', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:340 }}>🔗 {item.lien}</a>}
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                    <select value={item.status} onChange={e => { saveShopItem(item.id, { status:e.target.value }); }}
                      style={{ background:(PSTATUS[item.status]||PSTATUS['À trouver']).bg, color:(PSTATUS[item.status]||PSTATUS['À trouver']).tx,
                        border:`1px solid ${(PSTATUS[item.status]||PSTATUS['À trouver']).tx}44`, borderRadius:4, padding:'2px 6px', fontSize:11, cursor:'pointer', fontFamily:T.font, outline:'none' }}
                    >
                      {Object.keys(PSTATUS).map(s => <option key={s}>{s}</option>)}
                    </select>
                    <button onClick={() => openEdit(item)} style={{ ...ss.btn, padding:'2px 7px', fontSize:10 }}>✎</button>
                    <button onClick={() => deleteShopItem(item.id)} style={{ ...ss.btn, color:T.r, padding:'2px 7px', fontSize:10 }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 20px', color:T.tx3, fontSize:13 }}>
            Aucun article trouvé.<br/>
            <button onClick={openAdd} style={{ ...ss.btn, marginTop:12, color:T.acc }}>+ Ajouter un article</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ENTRETIEN VIEW ───────────────────────────────────────────────────────────
function EntretienView({ mDone, onToggleMaint }) {
  const [fSeason, setFSeason] = useState('all');
  const season = currentSeason();
  const seasons = ['Printemps', 'Été', 'Automne', 'Hiver', "Toute l'année", 'Annuel', 'Avant premiers gels', 'Après grosses tempêtes', 'Octobre', 'Printemps + automne'];
  const uniqueSeasons = [...new Set(MAINTENANCE.map(t => t.season))];

  const filtered = fSeason === 'all' ? MAINTENANCE : MAINTENANCE.filter(t => t.season === fSeason);

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(t => { if (!g[t.season]) g[t.season] = []; g[t.season].push(t); });
    return g;
  }, [filtered]);

  const seasonOrder = ["Toute l'année", 'Printemps', 'Printemps + automne', 'Été', 'Automne', 'Octobre', 'Avant premiers gels', 'Hiver', 'Après grosses tempêtes', 'Annuel'];
  const orderedSeasons = Object.keys(grouped).sort((a,b) => {
    const ai = seasonOrder.indexOf(a); const bi = seasonOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'10px 16px', borderBottom:`1px solid ${T.bd}`, display:'flex', gap:8, alignItems:'center', background:T.s1 }}>
        <select value={fSeason} onChange={e => setFSeason(e.target.value)}
          style={{ background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'3px 8px', fontSize:11, color:T.tx, cursor:'pointer', fontFamily:T.font, outline:'none' }}>
          <option value="all">Toutes les saisons</option>
          {uniqueSeasons.map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize:11, color:T.tx3 }}>
          Saison actuelle: <span style={{ color:T.acc }}>{season}</span>
        </span>
        <span style={{ ...ss.pill('rgba(63,182,139,0.12)', T.g), marginLeft:'auto' }}>
          {MAINTENANCE.filter(t=>mDone[t.id]).length}/{MAINTENANCE.length} complétés
        </span>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
        {orderedSeasons.map(s => {
          const tasks = grouped[s];
          const isCurrentSeason = seasonMatch(s, season);
          const doneCount = tasks.filter(t => mDone[t.id]).length;
          return (
            <div key={s} style={{ marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:600, color:T.tx }}>{s}</span>
                {isCurrentSeason && <span style={{ ...ss.pill('rgba(63,182,139,0.14)', T.g), fontSize:9 }}>Maintenant</span>}
                <span style={{ fontSize:10, color:T.tx3 }}>{doneCount}/{tasks.length} fait</span>
              </div>
              {tasks.map(t => (
                <div key={t.id} style={{ display:'flex', gap:10, padding:'9px 12px',
                  background: mDone[t.id] ? 'rgba(63,182,139,0.05)' : isCurrentSeason && !mDone[t.id] ? 'rgba(91,156,246,0.04)' : T.s1,
                  border:`1px solid ${isCurrentSeason && !mDone[t.id] ? 'rgba(91,156,246,0.18)' : T.bd}`,
                  borderRadius:6, marginBottom:4, alignItems:'flex-start' }}>
                  <input type="checkbox" checked={!!mDone[t.id]} onChange={e => onToggleMaint(t.id, e.target.checked)}
                    style={{ width:15, height:15, cursor:'pointer', accentColor:T.g, flexShrink:0, marginTop:2 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, color: mDone[t.id] ? T.tx3 : T.tx, fontWeight:500,
                      textDecoration: mDone[t.id] ? 'line-through' : 'none', marginBottom: t.detail ? 3 : 0 }}>
                      {t.task}
                    </div>
                    <div style={{ fontSize:11, color:T.tx3, lineHeight:1.5 }}>{t.detail}</div>
                    {mDone[t.id] && <div style={{ fontSize:10, color:T.g, marginTop:3 }}>✓ Complété le {mDone[t.id]}</div>}
                    {t.notes && <div style={{ fontSize:10, color:T.tx3, marginTop:2, fontFamily:T.mono }}>{t.notes}</div>}
                  </div>
                  <span style={{ fontSize:10, color:T.tx3, flexShrink:0, textAlign:'right' }}>{t.zone}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
const DENSITY_ZOOM = { compact:0.88, comfortable:1.0, presentation:1.15 };

export default function DurinsWorksApp() {
  const navigate = useNavigate();
  const [view, setView] = useState('dashboard');
  const [statuses, setStatuses] = useState({});
  const [mDone, setMDone] = useState({});
  const [shopItems, setShopItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingGoTo, setPendingGoTo] = useState(null);
  const [fontScale, setFontScale] = useState(1.0);
  const [density, setDensity] = useState('comfortable');
  const effectiveZoom = fontScale * (DENSITY_ZOOM[density] || 1.0);

  // Inject fonts
  useEffect(() => {
    if (!document.getElementById('durins-works-fonts')) {
      const link = document.createElement('link');
      link.id = 'durins-works-fonts'; link.rel = 'stylesheet'; link.href = FONT_LINK;
      document.head.appendChild(link);
    }
  }, []);

  // Load all state from Supabase
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const [sRes, mRes, shopRes] = await Promise.all([
          supabase.from('durins_works_action_statuses').select('*'),
          supabase.from('durins_works_maintenance_completions').select('*'),
          supabase.from('durins_works_shopping_items').select('*').order('sort_order').order('created_at'),
        ]);
        if (sRes.data) {
          const map = {};
          sRes.data.forEach(r => { map[r.action_id] = r.status; });
          setStatuses(map);
        }
        if (mRes.data) {
          const map = {};
          mRes.data.forEach(r => { map[r.task_id] = r.done_date; });
          setMDone(map);
        }
        if (shopRes.data) {
          if (shopRes.data.length === 0) {
            // Seed with Excel items on first use
            const { data: seeded } = await supabase.from('durins_works_shopping_items').insert(SHOPPING_SEED).select();
            if (seeded) setShopItems(seeded);
          } else {
            setShopItems(shopRes.data);
          }
        }
      } catch(e) { console.error('Durin\'s Works load error:', e); }
      setLoading(false);
    };
    loadAll();
  }, []);

  // Handle pending navigation from Dashboard
  useEffect(() => {
    if (pendingGoTo && view === 'travaux') {
      setPendingGoTo(null);
    }
  }, [view, pendingGoTo]);

  const flash = () => { setSaved(false); setTimeout(() => setSaved(true), 900); };

  const saveStatus = useCallback(async (actionId, status) => {
    flash();
    await supabase.from('durins_works_action_statuses').upsert({ action_id:actionId, status, updated_at:new Date().toISOString() }, { onConflict:'action_id' });
  }, []);

  const toggleMaint = useCallback(async (taskId, checked) => {
    const doneDate = checked ? today() : null;
    setMDone(prev => ({ ...prev, [taskId]: doneDate }));
    flash();
    await supabase.from('durins_works_maintenance_completions').upsert(
      { task_id:taskId, done_date:doneDate, year:new Date().getFullYear(), updated_at:new Date().toISOString() },
      { onConflict:'task_id' }
    );
  }, []);

  const saveShopItem = useCallback(async (id, updates) => {
    setShopItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    flash();
    await supabase.from('durins_works_shopping_items').update({ ...updates, updated_at:new Date().toISOString() }).eq('id', id);
  }, []);

  const addShopItem = useCallback(async (item) => {
    flash();
    const { data } = await supabase.from('durins_works_shopping_items').insert({ ...item, sort_order:Date.now() }).select().single();
    if (data) setShopItems(prev => [...prev, data]);
  }, []);

  const deleteShopItem = useCallback(async (id) => {
    setShopItems(prev => prev.filter(i => i.id !== id));
    flash();
    await supabase.from('durins_works_shopping_items').delete().eq('id', id);
  }, []);

  const handleGoToAction = (actionId, sysId) => {
    setPendingGoTo({ actionId, sysId });
    setView('travaux');
  };

  const allActions = useMemo(() => SYSTEMS.flatMap(s => s.actions), []);
  const urgentLeft = allActions.filter(a => isUrgentTiming(a.timing) && statuses[a.id] !== 'Fait').length;

  const NAV = [
    { id:'dashboard', label:'Tableau de bord' },
    { id:'travaux', label:'Travaux' },
    { id:'achats', label:'Achats' },
    { id:'entretien', label:'Entretien' },
  ];

  if (loading) {
    return (
      <div style={{ fontFamily:T.font, display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:T.bg, color:T.tx2, fontSize:13 }}>
        Chargement Durin's Works…
      </div>
    );
  }

  return (
    <div style={{ fontFamily:T.font, display:'flex', flexDirection:'column', height:'100vh', background:T.bg, overflow:'hidden', color:T.tx }}>
      {/* Zoomed area — header + body */}
      <div style={{ flex:1, zoom:effectiveZoom, display:'flex', flexDirection:'column', overflow:'hidden', background:T.bg, color:T.tx }}>
        {/* HEADER */}
        <div style={{ background:T.hdr, borderBottom:`1px solid ${T.bd}`, padding:'0 12px', display:'flex', alignItems:'center', height:44, flexShrink:0, gap:0 }}>
          <button onClick={() => navigate('/')} style={{ background:'rgba(91,156,246,0.12)', border:`1px solid rgba(91,156,246,0.2)`, borderRadius:5, padding:'3px 9px', fontSize:10, fontWeight:700, color:T.acc, cursor:'pointer', marginRight:10, fontFamily:T.font, letterSpacing:'0.02em', flexShrink:0 }}>KarlOS</button>
          <span style={{ fontFamily:T.serif, fontSize:14, fontWeight:600, color:T.acc2, letterSpacing:'0.06em', marginRight:14, flexShrink:0 }}>Durin's Works</span>
          <div style={{ display:'flex', gap:0 }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => setView(n.id)} style={{ padding:'4px 10px', fontSize:11, fontWeight:500, border:'none', background:'transparent', cursor:'pointer', color:view===n.id ? T.acc : T.tx2, borderBottom:`2px solid ${view===n.id ? T.acc : 'transparent'}`, borderRadius:0, fontFamily:T.font, transition:'color .1s', whiteSpace:'nowrap' }}>
                {n.label}
              </button>
            ))}
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            {urgentLeft > 0 && <span style={{ fontSize:10, background:'rgba(217,95,95,0.15)', color:T.r, borderRadius:10, padding:'1px 7px', fontWeight:600 }}>{urgentLeft} urgent{urgentLeft>1?'s':''}</span>}
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher…"
              style={{ background:'rgba(255,255,255,0.06)', border:`1px solid ${T.bd}`, borderRadius:14, padding:'3px 12px', fontSize:11, color:T.tx, fontFamily:T.font, outline:'none', width:160 }} />
            <span style={{ fontSize:10, color:saved ? T.g : T.tx3, fontFamily:T.mono }}>{saved ? '✓' : '…'}</span>
          </div>
        </div>
        {/* BODY */}
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {view === 'dashboard' && <DashboardView statuses={statuses} mDone={mDone} onGoToAction={handleGoToAction} onToggleMaint={toggleMaint} />}
          {view === 'travaux' && <TravauxView statuses={statuses} setStatuses={setStatuses} saveStatus={saveStatus} searchQuery={searchQuery} />}
          {view === 'achats' && <AchatsView shopItems={shopItems} setShopItems={setShopItems} saveShopItem={saveShopItem} deleteShopItem={deleteShopItem} addShopItem={addShopItem} />}
          {view === 'entretien' && <EntretienView mDone={mDone} onToggleMaint={toggleMaint} />}
        </div>
      </div>

      {/* BOTTOM BAR — outside zoom */}
      <div style={{ height:32, background:T.hdr, borderTop:`1px solid ${T.bd}`, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', flexShrink:0, gap:10 }}>
        <span style={{ fontSize:11, fontFamily:T.serif, color:T.tx3, letterSpacing:'0.04em', flexShrink:0 }}>8235, Avenue Orégon</span>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {[{k:'compact',label:'⊟ Compact'},{k:'comfortable',label:'⊡ Confort'},{k:'presentation',label:'⊞ Grand'}].map(d => (
            <button key={d.k} onClick={() => setDensity(d.k)}
              style={{ background:'transparent', border:`1px solid ${density===d.k?T.acc:T.bd}`, borderRadius:4, padding:'1px 7px', fontSize:9,
                fontWeight:density===d.k?700:400, color:density===d.k?T.acc:T.tx3, cursor:'pointer', fontFamily:T.font }}>
              {d.label}
            </button>
          ))}
          <span style={{ fontSize:10, color:T.tx3, marginLeft:4 }}>A</span>
          <input type="range" min={0.7} max={1.4} step={0.05} value={fontScale}
            onChange={e => setFontScale(parseFloat(e.target.value))}
            style={{ width:90, cursor:'pointer', accentColor:T.acc }} />
          <span style={{ fontSize:13, color:T.tx3 }}>A</span>
          <span style={{ fontSize:10, color:T.tx3, fontFamily:T.mono, minWidth:30 }}>{Math.round(effectiveZoom*100)}%</span>
        </div>
        <span style={{ fontSize:10, color:T.tx3, flexShrink:0 }}>
          {allActions.filter(a => statuses[a.id] === 'Fait').length}/{allActions.length} actions · {MAINTENANCE.filter(t=>mDone[t.id]).length}/{MAINTENANCE.length} entretien
        </span>
      </div>
    </div>
  );
}
