const fs=require('fs');
const BASE="/sessions/gracious-elegant-cray/mnt/02.Claude Apps/Karl's Apps/kh-tools/docs/palantir-2.0";
const SQL=BASE+"/palantir-2.0-session1-final.sql";
const OUT=BASE+"/palantir-2.0-session3-priority-patch.sql";
let s=fs.readFileSync(SQL,'utf8');
function repl(from,to){ if(s.indexOf(from)===-1) throw new Error('ANCHOR NOT FOUND:\n'+from); s=s.replace(from,to); }
// T1 migrate task INSERT column list
repl("notes, gate, source, sort_order, completed_at, created_at)\n  SELECT CASE WHEN rn = 1",
     "notes, gate, source, sort_order, completed_at, created_at, priority, template_id)\n  SELECT CASE WHEN rn = 1");
// T2 migrate task INSERT values
repl("         n::float, pal_safe_date(t->>'completedAt'), pal_safe_ts(t->>'createdAt')\n  FROM base;",
     "         n::float, pal_safe_date(t->>'completedAt'), pal_safe_ts(t->>'createdAt'),\n         nullif(t->>'priority',''), nullif(t->>'templateId','')\n  FROM base;");
// T3/T4 remove priority+templateId from archive payload (now first-class)
repl("             'priority',        nullif(t->>'priority',''),\n","");
repl("             'templateId',      nullif(t->>'templateId',''),\n","");
// T5 export tasks emit priority+templateId
repl("      'completedAt',t.completed_at,'createdAt',t.created_at::date) ORDER BY t.sort_order, t.id),'[]'::jsonb)\n    FROM pal_tasks t WHERE t.source <> 'milestone'),",
     "      'completedAt',t.completed_at,'createdAt',t.created_at::date,'priority',t.priority,'templateId',t.template_id) ORDER BY t.sort_order, t.id),'[]'::jsonb)\n    FROM pal_tasks t WHERE t.source <> 'milestone'),");

function extract(marker, endMarker){ const a=s.indexOf(marker); const b=s.indexOf(endMarker,a)+endMarker.length; return s.substring(a,b); }
const exp=extract("CREATE OR REPLACE FUNCTION pal_export_state()","$$;");
const mig=extract("CREATE OR REPLACE FUNCTION pal_migrate_from_v1()","END $$;");

const patch=
`-- ============================================================================
-- Palantir 2.0 - Session 3 patch: task priority + template_id round-trip
-- Adds priority/template_id columns to pal_tasks and carries them through
-- migrate + export so the v1<->pal_ round-trip is lossless for task priority.
-- Generated from palantir-2.0-session1-final.sql. NOT YET APPLIED to Supabase.
-- ============================================================================

ALTER TABLE pal_tasks ADD COLUMN IF NOT EXISTS priority    text;
ALTER TABLE pal_tasks ADD COLUMN IF NOT EXISTS template_id text;

${exp}

${mig}

-- re-pin search_path (CREATE OR REPLACE resets proconfig)
ALTER FUNCTION public.pal_export_state()    SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.pal_migrate_from_v1() SET search_path = public, extensions, pg_temp;
`;
fs.writeFileSync(OUT,patch);
fs.writeFileSync("/sessions/gracious-elegant-cray/mnt/outputs/pgtest/patch.sql",patch);
console.log("WROTE patch ("+patch.length+" bytes). export fn "+exp.length+"b, migrate fn "+mig.length+"b");
console.log("checks: export_has_priority="+/'priority',t\.priority/.test(exp)+" migrate_inserts_priority="+/nullif\(t->>'priority',''\), nullif\(t->>'templateId',''\)/.test(mig)+" archive_priority_removed="+!/'priority',        nullif/.test(mig));
