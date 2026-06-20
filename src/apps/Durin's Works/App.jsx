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

const MatRow = ({ m }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 0', borderBottom:`1px solid ${T.bd}` }}>
    <span style={{ flex:1, fontSize:12.5, color:T.tx }}>{m.article}</span>
    {m.qty > 1 && <span style={{ fontSize:11, color:T.tx3, fontFamily:T.mono }}>x{m.qty}</span>}
    <span style={{ fontSize:12, color:T.y, fontFamily:T.mono, minWidth:60, textAlign:'right' }}>
      {money(m.prix_unitaire ? m.prix_unitaire * (m.qty || 1) : null)}
    </span>
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

// ─── ACTION VIEW (basic, Session 1) ─────────────────────────────────────────────
function ActionView({ system, action, status, onStatusChange, onBack, backLabel, schedule, onSchedule }) {
  const wc = WSTATUS[status] || WSTATUS['À faire'];
  const steps = action.steps || [];
  const cautions = action.cautions || [];
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

      {steps.length > 0 && (
        <>
          <SectionLab style={{ margin:'6px 0 4px' }}>Étapes</SectionLab>
          <div style={{ marginBottom:6 }}>
            {steps.map((s, i) => (
              <div key={s.id || i} style={{ display:'flex', gap:10, padding:'11px 0', borderBottom:`1px solid ${T.bd}` }}>
                <div style={{ flexShrink:0, width:24, height:24, borderRadius:'50%', background:T.s3, border:`1px solid ${T.bd2}`, color:T.acc, fontSize:12, fontWeight:600, fontFamily:T.mono, display:'flex', alignItems:'center', justifyContent:'center' }}>{i + 1}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:T.tx, lineHeight:1.45 }}>{s.text}</div>
                  {s.detail && <div style={{ fontSize:11.5, color:T.tx3, lineHeight:1.55, marginTop:3 }}>{s.detail}</div>}
                  {(s.material || s.caution) && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:6 }}>
                      {s.material && <span style={{ fontSize:10.5, background:'rgba(91,156,246,0.10)', color:T.acc, border:`1px solid rgba(91,156,246,0.22)`, padding:'2px 7px', borderRadius:5 }}>⛬ {s.material}</span>}
                      {s.caution && <span style={{ fontSize:10.5, background:'rgba(217,95,95,0.11)', color:'#e98a78', border:`1px solid rgba(217,95,95,0.25)`, padding:'2px 7px', borderRadius:5 }}>⚠ {s.caution}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ background:T.s1, border:`1px solid ${T.bd}`, borderRadius:9, padding:'11px 12px', marginTop:14 }}>
        <SectionLab style={{ margin:'0 0 6px' }}>Pourquoi</SectionLab>
        <div style={{ fontSize:12.5, color:T.tx2, lineHeight:1.65 }}>{system.pourquoi}</div>
      </div>

      {action.composantes?.length > 0 && (
        <div style={{ marginTop:12 }}>
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
function AchatsView({ shopItems, setShopItems, saveShopItem, deleteShopItem, addShopItem, narrow }) {
  const [fProject, setFProject] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [editCell, setEditCell] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [addingRow, setAddingRow] = useState(false);
  const [newRow, setNewRow] = useState({ project:'', article:'', magasin:'', prix_unitaire:'', qty:1, status:'À trouver', lien:'', notes:'' });

  const projects = useMemo(() => [...new Set(shopItems.map(i => i.project))].sort(), [shopItems]);
  const filtered = useMemo(() => shopItems.filter(i => {
    if (fProject !== 'all' && i.project !== fProject) return false;
    if (fStatus !== 'all' && i.status !== fStatus) return false;
    return true;
  }), [shopItems, fProject, fStatus]);
  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(i => { if (!g[i.project]) g[i.project] = []; g[i.project].push(i); });
    return g;
  }, [filtered]);
  const grandTotal = useMemo(() => filtered.filter(i => i.prix_unitaire).reduce((s, i) => s + i.prix_unitaire * (i.qty || 1), 0), [filtered]);
  const fmtMoney = n => n.toLocaleString('fr-CA', { style:'currency', currency:'CAD', maximumFractionDigits:0 });

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
    if (!newRow.project.trim() || !newRow.article.trim()) return;
    const item = { ...newRow, prix_unitaire: newRow.prix_unitaire !== '' ? parseFloat(newRow.prix_unitaire) : null, qty: parseInt(newRow.qty) || 1 };
    await addShopItem(item);
    setNewRow({ project:'', article:'', magasin:'', prix_unitaire:'', qty:1, status:'À trouver', lien:'', notes:'' });
    setAddingRow(false);
  };

  const filterBar = (
    <div style={{ padding:'8px 12px', borderBottom:`1px solid ${T.bd}`, display:'flex', gap:8, alignItems:'center', background:T.s1, flexWrap:'wrap', flexShrink:0 }}>
      <select value={fProject} onChange={e => setFProject(e.target.value)} style={{ background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'4px 8px', fontSize:11, color:T.tx, cursor:'pointer', fontFamily:T.font, outline:'none' }}>
        <option value="all">Tous les projets</option>
        {projects.map(p => <option key={p}>{p}</option>)}
      </select>
      <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'4px 8px', fontSize:11, color:T.tx, cursor:'pointer', fontFamily:T.font, outline:'none' }}>
        <option value="all">Tous statuts</option>
        {Object.keys(PSTATUS).map(s => <option key={s}>{s}</option>)}
      </select>
      <span style={{ marginLeft:'auto', fontSize:12, color:T.y, fontFamily:T.mono }}>{grandTotal > 0 ? fmtMoney(grandTotal) : ''}</span>
      <button onClick={() => setAddingRow(true)} style={{ ...ss.btn, color:T.acc, border:`1px solid rgba(91,156,246,0.25)`, background:'rgba(91,156,246,0.08)' }}>+ Article</button>
    </div>
  );

  const cellStyle = (w) => ({ width:w, padding:'6px 8px', borderRight:`1px solid ${T.bd3}`, fontSize:11, color:T.tx, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'text', flexShrink:0, boxSizing:'border-box' });
  const inpStyle = { background:'transparent', border:'none', outline:`1px solid ${T.acc}`, borderRadius:2, padding:'1px 4px', fontSize:11, color:T.tx, fontFamily:T.font, width:'100%', boxSizing:'border-box' };
  const hdrStyle = (w) => ({ width:w, padding:'5px 8px', fontSize:9, fontWeight:700, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.5px', borderRight:`1px solid ${T.bd3}`, flexShrink:0, boxSizing:'border-box' });
  const EditableCell = ({ id, field, val, width, type = 'text' }) => {
    const isEditing = editCell?.id === id && editCell?.field === field;
    return (
      <div style={cellStyle(width)} onClick={() => !isEditing && startEdit(id, field, val)}>
        {isEditing
          ? <input autoFocus value={editVal} type={type} onChange={e => setEditVal(e.target.value)} onBlur={() => commitEdit(id, field)}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(id, field); if (e.key === 'Escape') setEditCell(null); }} style={inpStyle} />
          : <span style={{ color: val == null || val === '' ? T.tx3 : T.tx, fontStyle: val == null || val === '' ? 'italic' : 'normal' }}>
              {field === 'prix_unitaire' && val != null ? `${val}$` : val || '—'}
            </span>}
      </div>
    );
  };
  const cols = [
    { key:'article', label:'Article', w:220 },
    { key:'magasin', label:'Magasin', w:110 },
    { key:'prix_unitaire', label:'Prix', w:70, type:'number' },
    { key:'qty', label:'Qté', w:50, type:'number' },
    { key:'status', label:'Statut', w:120 },
    { key:'notes', label:'Notes', w:160 },
  ];
  const wideTable = Object.entries(grouped).map(([project, items]) => {
    const projTotal = items.filter(i => i.prix_unitaire).reduce((s, i) => s + i.prix_unitaire * (i.qty || 1), 0);
    return (
      <div key={project}>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', background:T.s2, borderBottom:`1px solid ${T.bd}`, borderTop:`1px solid ${T.bd}`, position:'sticky', top:0, zIndex:2 }}>
          <span style={{ fontSize:12, fontWeight:700, color:T.tx }}>{project}</span>
          {projTotal > 0 && <span style={{ fontSize:10, color:T.y, fontFamily:T.mono }}>{fmtMoney(projTotal)}</span>}
          <span style={{ fontSize:10, color:T.tx3 }}>{items.length} article{items.length > 1 ? 's' : ''}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', background:T.hdr, borderBottom:`1px solid ${T.bd}`, position:'sticky', top:34, zIndex:1 }}>
          {cols.map(c => <div key={c.key} style={hdrStyle(c.w)}>{c.label}</div>)}
          <div style={{ width:32, flexShrink:0 }} />
        </div>
        {items.map((item, idx) => (
          <div key={item.id} style={{ display:'flex', alignItems:'center', borderBottom:`1px solid ${T.bd3}`, background: idx % 2 === 0 ? T.bg : T.s1 }}
            onMouseEnter={e => e.currentTarget.style.background = T.s2}
            onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? T.bg : T.s1}>
            <EditableCell id={item.id} field="article" val={item.article} width={220} />
            <EditableCell id={item.id} field="magasin" val={item.magasin} width={110} />
            <EditableCell id={item.id} field="prix_unitaire" val={item.prix_unitaire} width={70} type="number" />
            <EditableCell id={item.id} field="qty" val={item.qty} width={50} type="number" />
            <div style={{ ...cellStyle(120), padding:'4px 6px' }}>
              <select value={item.status} onChange={e => { saveShopItem(item.id, { status:e.target.value }); setShopItems(prev => prev.map(i => i.id === item.id ? { ...i, status:e.target.value } : i)); }}
                style={{ background:(PSTATUS[item.status] || PSTATUS['À trouver']).bg, color:(PSTATUS[item.status] || PSTATUS['À trouver']).tx, border:'none', borderRadius:4, padding:'2px 5px', fontSize:10, cursor:'pointer', fontFamily:T.font, outline:'none', width:'100%' }}>
                {Object.keys(PSTATUS).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <EditableCell id={item.id} field="notes" val={item.notes} width={160} />
            <div style={{ width:32, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <button onClick={() => deleteShopItem(item.id)} title="Supprimer" style={{ background:'transparent', border:'none', cursor:'pointer', color:T.tx3, fontSize:14, padding:0, lineHeight:1 }}
                onMouseEnter={e => e.currentTarget.style.color = T.r} onMouseLeave={e => e.currentTarget.style.color = T.tx3}>✕</button>
            </div>
          </div>
        ))}
      </div>
    );
  });

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
  const narrowCards = (
    <div style={{ padding:'10px 12px 24px' }}>
      {Object.entries(grouped).map(([project, items]) => {
        const projTotal = items.filter(i => i.prix_unitaire).reduce((s, i) => s + i.prix_unitaire * (i.qty || 1), 0);
        return (
          <div key={project} style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:12.5, fontWeight:700, color:T.tx }}>{project}</span>
              {projTotal > 0 && <span style={{ fontSize:11, color:T.y, fontFamily:T.mono }}>{fmtMoney(projTotal)}</span>}
              <span style={{ fontSize:10, color:T.tx3, marginLeft:'auto' }}>{items.length} article{items.length > 1 ? 's' : ''}</span>
            </div>
            {items.map(item => (
              <div key={item.id} style={{ background:T.s1, border:`1px solid ${T.bd}`, borderRadius:9, padding:'11px 12px', marginBottom:8 }}>
                <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                  <div style={{ flex:1, lineHeight:1.4 }}>{cardEdit(item, 'article', { fs:13 })}</div>
                  <button onClick={() => deleteShopItem(item.id)} title="Supprimer" style={{ background:'transparent', border:'none', cursor:'pointer', color:T.tx3, fontSize:15, padding:0, lineHeight:1, flexShrink:0 }}>✕</button>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8, flexWrap:'wrap' }}>
                  {cardEdit(item, 'magasin', { fs:11.5, w:120 })}
                  <span style={{ color:T.y, fontFamily:T.mono }}>{cardEdit(item, 'prix_unitaire', { type:'number', w:70, fs:12 })}</span>
                  <span style={{ color:T.tx3, fontFamily:T.mono, fontSize:11 }}>x {cardEdit(item, 'qty', { type:'number', w:44, fs:11 })}</span>
                  <select value={item.status} onChange={e => { saveShopItem(item.id, { status:e.target.value }); setShopItems(prev => prev.map(i => i.id === item.id ? { ...i, status:e.target.value } : i)); }}
                    style={{ marginLeft:'auto', background:(PSTATUS[item.status] || PSTATUS['À trouver']).bg, color:(PSTATUS[item.status] || PSTATUS['À trouver']).tx, border:'none', borderRadius:5, padding:'3px 7px', fontSize:10.5, cursor:'pointer', fontFamily:T.font, outline:'none' }}>
                    {Object.keys(PSTATUS).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ marginTop:8, lineHeight:1.5 }}>{cardEdit(item, 'notes', { fs:11 })}</div>
              </div>
            ))}
          </div>
        );
      })}
      {filtered.length === 0 && !addingRow && <div style={{ textAlign:'center', padding:'40px 20px', color:T.tx3, fontSize:13 }}>Aucun article trouvé.</div>}
    </div>
  );

  const addForm = addingRow && (
    <div style={{ borderTop:`1px solid ${T.bd}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', background:T.s2, borderBottom:`1px solid ${T.bd}` }}>
        <span style={{ fontSize:12, fontWeight:700, color:T.acc }}>Nouvel article</span>
      </div>
      <div style={{ padding:'12px 16px', background:T.s1, display:'flex', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:9, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Projet *</span>
          <input value={newRow.project} onChange={e => setNewRow(r => ({ ...r, project:e.target.value }))} list="proj-list" placeholder="Projet…"
            style={{ background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'5px 8px', fontSize:11, color:T.tx, fontFamily:T.font, outline:'none', width:160 }} />
          <datalist id="proj-list">{projects.map(p => <option key={p} value={p} />)}</datalist>
        </div>
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
          <span style={{ fontSize:9, color:T.tx3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Notes</span>
          <input value={newRow.notes} onChange={e => setNewRow(r => ({ ...r, notes:e.target.value }))} placeholder="…"
            style={{ background:T.s3, border:`1px solid ${T.bd2}`, borderRadius:4, padding:'5px 8px', fontSize:11, color:T.tx, fontFamily:T.font, outline:'none', width:160 }} />
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:6 }}>
          <button onClick={addRow} disabled={!newRow.project.trim() || !newRow.article.trim()}
            style={{ ...ss.btn, background:newRow.project && newRow.article ? 'rgba(63,182,139,0.15)' : T.s3, color:newRow.project && newRow.article ? T.g : T.tx3, border:`1px solid ${newRow.project && newRow.article ? T.g + '44' : T.bd}` }}>Ajouter</button>
          <button onClick={() => setAddingRow(false)} style={ss.btn}>Annuler</button>
        </div>
      </div>
    </div>
  );

  if (narrow) return <div>{filterBar}{narrowCards}{addForm}</div>;
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {filterBar}
      <div style={{ flex:1, overflowY:'auto' }}>
        {wideTable}
        {addForm}
        {filtered.length === 0 && !addingRow && (
          <div style={{ textAlign:'center', padding:'40px 20px', color:T.tx3, fontSize:13 }}>
            Aucun article trouvé.
            <button onClick={() => setAddingRow(true)} style={{ ...ss.btn, marginTop:12, display:'block', margin:'12px auto 0', color:T.acc }}>+ Ajouter un article</button>
          </div>
        )}
      </div>
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
function CalendarView({ systems, statuses, schedules, scheduleAction, onStatusChange }) {
  const [weekStart, setWeekStart] = useState(() => toISO(startOfWeek(new Date())));
  const [pending, setPending] = useState(null);
  const [selId, setSelId] = useState(null);

  const allActions = useMemo(() => systems.flatMap(s => s.actions.map(a => ({ ...a, sysId:s.id, sysName:s.name }))), [systems]);
  const byId = id => allActions.find(a => a.id === id);
  const days = weekDates(new Date(weekStart + 'T00:00'));
  const tray = orderActions(allActions.filter(a => !schedules[a.id] && (statuses[a.id] || a.status) !== 'Fait'));
  const forDay = iso => allActions.filter(a => schedules[a.id] === iso).sort((x, y) => (PRIORITY_ORDER[x.priority] ?? 9) - (PRIORITY_ORDER[y.priority] ?? 9));
  const assignTo = iso => { if (pending) { scheduleAction(pending, iso); setPending(null); } };

  const sel = selId ? byId(selId) : null;
  const selSys = sel ? systems.find(s => s.id === sel.sysId) : null;
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
                  <div key={a.id} onClick={e => { e.stopPropagation(); setSelId(a.id); }}
                    style={{ background: hot ? 'rgba(217,95,95,0.16)' : 'rgba(91,156,246,0.14)', border:`1px solid ${hot ? 'rgba(217,95,95,0.4)' : 'rgba(91,156,246,0.35)'}`, borderRadius:5, padding:'4px 6px', cursor:'pointer' }}>
                    <div style={{ fontSize:9.5, color: hot ? T.r : T.acc, fontWeight:600, lineHeight:1.25, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{a.desc}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:3 }}>
                      <span style={{ fontSize:8, color:T.tx3, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.sysName}</span>
                      <span onClick={e => { e.stopPropagation(); scheduleAction(a.id, null); }} title="Retirer" style={{ fontSize:12, color:T.tx3, cursor:'pointer', lineHeight:1 }}>×</span>
                    </div>
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

  const detail = sel ? (
    <ActionView system={selSys} action={sel} status={statuses[sel.id] || sel.status} onStatusChange={onStatusChange}
      schedule={schedules[sel.id]} onSchedule={d => scheduleAction(sel.id, d)} onBack={() => setSelId(null)} backLabel="Calendrier" />
  ) : (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, padding:24, textAlign:'center' }}>
      <div style={{ fontSize:28, opacity:0.12 }}>🗓</div>
      <span style={{ fontSize:12, color:T.tx3, fontStyle:'italic', maxWidth:220, lineHeight:1.6 }}>Clique une tâche pour l'ouvrir, ou choisis une tâche « à planifier » puis un jour.</span>
    </div>
  );

  return (
    <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
      {calendar}
      <div style={{ width:360, flexShrink:0, borderLeft:`1px solid ${T.bd}`, overflowY:'auto', display:'flex', flexDirection:'column' }}>{detail}</div>
    </div>
  );
}

// ─── AUJOURD'HUI VIEW (phone) ───────────────────────────────────────────────────
function AujourdhuiView({ systems, statuses, schedules, onOpenAction }) {
  const all = systems.flatMap(s => s.actions.map(a => ({ ...a, sysId:s.id, sysName:s.name })));
  const todays = all.filter(a => schedules[a.id] && schedules[a.id] <= todayISO() && (statuses[a.id] || a.status) !== 'Fait')
    .sort((x, y) => schedules[x.id] < schedules[y.id] ? -1 : schedules[x.id] > schedules[y.id] ? 1 : (PRIORITY_ORDER[x.priority] ?? 9) - (PRIORITY_ORDER[y.priority] ?? 9));
  return (
    <div style={{ padding:'14px 14px 24px' }}>
      <div style={{ fontSize:10, fontWeight:700, color:T.tx3, letterSpacing:'0.07em', textTransform:'uppercase', margin:'2px 0 4px' }}>Aujourd'hui</div>
      <div style={{ fontSize:11, color:T.tx3, marginBottom:12 }}>Ce qui est planifié pour aujourd'hui ou en retard.</div>
      {todays.length === 0 ? (
        <div style={{ background:T.s1, border:`1px solid ${T.bd}`, borderRadius:10, padding:'22px 16px', textAlign:'center' }}>
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

function PhoneShell(props) {
  const { tab, setTab, systems, maintenance, statuses, mDone, shopItems, selProject, setSelProject, selAction, setSelAction, schedules, scheduleAction, onStatusChange, toggleMaint, saveShopItem, setShopItems, addShopItem, deleteShopItem, saved, onHome } = props;
  const system = selProject ? systems.find(s => s.id === selProject) : null;
  const action = (system && selAction) ? system.actions.find(a => a.id === selAction) : null;

  let body;
  if (tab === 'projets') {
    if (action) body = <ActionView system={system} action={action} status={statuses[action.id] || action.status} onStatusChange={onStatusChange} schedule={schedules[action.id]} onSchedule={d => scheduleAction(action.id, d)} onBack={() => setSelAction(null)} />;
    else if (system) body = <ProjectDashboard system={system} statuses={statuses} materials={shopItems} onOpenAction={id => setSelAction(id)} onBack={() => setSelProject(null)} />;
    else body = <ProjectList systems={systems} statuses={statuses} onSelect={id => { setSelProject(id); setSelAction(null); }} />;
  } else if (tab === 'aujourdhui') {
    body = <AujourdhuiView systems={systems} statuses={statuses} schedules={schedules} onOpenAction={(sysId, aid) => { setSelProject(sysId); setSelAction(aid); setTab('projets'); }} />;
  } else if (tab === 'achats') {
    body = <AchatsView narrow shopItems={shopItems} setShopItems={setShopItems} saveShopItem={saveShopItem} deleteShopItem={deleteShopItem} addShopItem={addShopItem} />;
  } else if (tab === 'entretien') {
    body = <EntretienView narrow maintenance={maintenance} mDone={mDone} onToggleMaint={toggleMaint} />;
  }

  return (
    <div style={{ fontFamily:T.font, display:'flex', flexDirection:'column', height:'100vh', background:T.bg, color:T.tx, overflow:'hidden' }}>
      <div style={{ height:50, flexShrink:0, background:T.hdr, borderBottom:`1px solid ${T.bd}`, display:'flex', alignItems:'center', gap:10, padding:'0 14px' }}>
        <button onClick={onHome} style={{ background:'rgba(91,156,246,0.12)', border:`1px solid rgba(91,156,246,0.2)`, borderRadius:6, padding:'4px 9px', fontSize:10, fontWeight:700, color:T.acc, cursor:'pointer', fontFamily:T.font, letterSpacing:'0.02em' }}>KarlOS</button>
        <span style={{ fontFamily:T.serif, fontSize:15, fontWeight:600, color:T.acc2, letterSpacing:'0.06em' }}>Durin's Works</span>
        <button title="Ajout rapide (à venir)" style={{ marginLeft:'auto', width:30, height:30, borderRadius:8, border:`1px solid ${T.bd2}`, background:T.s2, color:T.acc, fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', lineHeight:1 }}>+</button>
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
  const { tab, setTab, systems, maintenance, statuses, mDone, shopItems, selProject, setSelProject, selAction, setSelAction, schedules, scheduleAction, onStatusChange, toggleMaint, saveShopItem, setShopItems, addShopItem, deleteShopItem, saved, onHome } = props;
  const system = selProject ? systems.find(s => s.id === selProject) : null;
  const action = (system && selAction) ? system.actions.find(a => a.id === selAction) : null;

  let main;
  if (tab === 'projets') {
    let detail;
    if (action) detail = <ActionView system={system} action={action} status={statuses[action.id] || action.status} onStatusChange={onStatusChange} schedule={schedules[action.id]} onSchedule={d => scheduleAction(action.id, d)} onBack={() => setSelAction(null)} backLabel="Retour au projet" />;
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
    main = <AchatsView shopItems={shopItems} setShopItems={setShopItems} saveShopItem={saveShopItem} deleteShopItem={deleteShopItem} addShopItem={addShopItem} />;
  } else if (tab === 'entretien') {
    main = <EntretienView maintenance={maintenance} mDone={mDone} onToggleMaint={toggleMaint} />;
  } else if (tab === 'calendrier') {
    main = <CalendarView systems={systems} statuses={statuses} schedules={schedules} scheduleAction={scheduleAction} onStatusChange={onStatusChange} />;
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
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>{main}</div>
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
  return { st, md, items, sched };
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
        const { st, md, items, sched } = hydrateDoc(doc);
        setStatuses(st); setMDone(md); setShopItems(items); setSchedules(sched);
      } catch (e) { console.error('Durin\'s Works load error:', e); }
      setLoading(false);
    };
    loadDoc();
  }, []);

  const flash = () => { setSaved(false); setTimeout(() => setSaved(true), 900); };

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
  }, [persist]);

  const deleteShopItem = useCallback(async (id) => {
    setShopItems(prev => prev.filter(i => i.id !== id));
    const doc = stateRef.current;
    if (doc) doc.materials = (doc.materials || []).filter(i => i.id !== id);
    await persist('achat suppr');
  }, [persist]);

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
    saved, onHome: () => navigate('/'),
  };

  return isDesktop ? <DesktopShell {...shellProps} /> : <PhoneShell {...shellProps} />;
}
