// ================================================================
// Katsumoto — Script de inicialización de base de datos
// Uso: node scripts/init.mjs
// Requiere: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env
// ================================================================

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env')

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error('❌ No se encontró .env en la raíz del proyecto')
    process.exit(1)
  }
  const content = readFileSync(envPath, 'utf-8')
  const env = {}
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match) env[match[1]] = match[2].trim()
  }
  return env
}

const env = loadEnv()
const SUPABASE_URL = env.VITE_SUPABASE_URL
const ORG_ID = env.VITE_ORG_ID

// La service_role_key debe pasarse como variable de entorno
const SR_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !ORG_ID) {
  console.error('❌ Faltan VITE_SUPABASE_URL o VITE_ORG_ID en .env')
  process.exit(1)
}

if (!SR_KEY) {
  console.log('⚠️  No se detectó SUPABASE_SERVICE_ROLE_KEY. Usando solo operaciones de lectura.')
  console.log('   Para escritura: SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/init.mjs\n')
}

const supabase = createClient(SUPABASE_URL, SR_KEY || env.VITE_SUPABASE_ANON_KEY)
const canWrite = !!SR_KEY

const USERS = [
  { email: 'yescobar@katsumoto.shop', password: '1234abcd', full_name: 'Y Escobar', role: 'owner' },
  { email: 'juan.zapata@datacodev.com', password: 'mamaguevo', full_name: 'Juan Zapata', role: 'admin' },
]

async function init() {
  console.log('🌱 Katsumoto — Inicialización\n')
  console.log(`  URL: ${SUPABASE_URL}`)
  console.log(`  ORG: ${ORG_ID}`)
  console.log(`  Escritura: ${canWrite ? '✅' : '❌ (solo lectura)'}\n`)

  // === CLIENTES ===
  console.log('📦 Clientes...')
  const customers = [
    { name: 'Consumidor Final', document_type: 'DNI', document_number: '00000000', is_selva_zone: false },
    { name: 'SERVICIOS GENERALES UNITED E.I.R.L.', document_type: 'RUC', document_number: '20608183672', phone: '924532277', address: 'Jr. Santo Toribio 620, Pichanaqui', city: 'Pichanaqui', department_code: '12', province_code: '1203', district_code: '120301', is_selva_zone: true },
    { name: 'Juan Pérez', document_type: 'DNI', document_number: '12345678', phone: '999888777', city: 'Pichanaqui', department_code: '12', province_code: '1203', district_code: '120301', is_selva_zone: true },
  ]

  for (const c of customers) {
    if (!canWrite) break
    const { data: exist } = await supabase.from('customers').select('id').eq('document_number', c.document_number).eq('organization_id', ORG_ID).maybeSingle()
    if (exist) { console.log(`  ⏭️  ${c.name} (${c.document_number}) ya existe`); continue }
    const { error } = await supabase.from('customers').insert({ organization_id: ORG_ID, is_active: true, ...c })
    console.log(error ? `  ❌ ${c.name}: ${error.message}` : `  ✅ ${c.name} creado`)
  }

  // === SUNAT CONFIG ===
  console.log('📦 SUNAT Config...')
  if (canWrite) {
    const { data: sc } = await supabase.from('sunat_config').select('id').eq('organization_id', ORG_ID).maybeSingle()
    if (sc) { console.log('  ⏭️  Ya existe') }
    else {
      const { error } = await supabase.from('sunat_config').insert({
        organization_id: ORG_ID, ruc: '20608183672', razon_social: 'SERVICIOS GENERALES UNITED E.I.R.L.',
        nombre_comercial: 'Katsumoto', ubigeo: '120301', departamento: 'JUNIN', provincia: 'CHANCHAMAYO',
        distrito: 'PICHANAKI', direccion: 'Jr. Santo Toribio 620', usuario_sol: '', clave_sol: '',
        modo_produccion: false, is_configured: false, gre_version: '2.0'
      })
      console.log(error ? `  ❌ ${error.message}` : '  ✅ Creado (pendiente credenciales)')
    }
  }

  // === TAX CONFIG ===
  console.log('📦 Tax Config...')
  if (canWrite) {
    const { data: tx } = await supabase.from('tax_configurations').select('id').eq('organization_id', ORG_ID).maybeSingle()
    if (tx) { console.log('  ⏭️  Ya existe') }
    else {
      const { error } = await supabase.from('tax_configurations').insert({
        organization_id: ORG_ID, selva_law_enabled: true, seller_department_code: '12',
        seller_province_code: '1203', seller_district_code: '120301', seller_is_selva: true,
        default_tax_affectation: 'gravado'
      })
      console.log(error ? `  ❌ ${error.message}` : '  ✅ Ley Selva habilitada (Pichanaqui)')
    }
  }

  // === USUARIOS ===
  console.log('📦 Usuarios...')
  if (canWrite) {
    const authClient = createClient(SUPABASE_URL, SR_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    for (const u of USERS) {
      const { data: { users } } = await authClient.auth.admin.listUsers()
      const existing = users.find(usr => usr.email === u.email)

      let userId
      if (existing) {
        userId = existing.id
        await authClient.auth.admin.updateUserById(userId, { password: u.password })
        console.log(`  ⏭️  ${u.email} ya existe (password actualizado)`)
      } else {
        const { data: newUser, error } = await authClient.auth.admin.createUser({
          email: u.email, password: u.password, email_confirm: true,
          user_metadata: { full_name: u.full_name, organization_id: ORG_ID, role: u.role }
        })
        if (error) { console.log(`  ❌ ${u.email}: ${error.message}`); continue }
        userId = newUser.user.id
        console.log(`  ✅ ${u.email} creado`)
      }

      const { data: pf } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
      if (pf) {
        await supabase.from('profiles').update({ full_name: u.full_name, role: u.role, is_active: true }).eq('id', userId)
        console.log(`     Perfil actualizado → ${u.role}`)
      } else {
        const { error: pfErr } = await supabase.from('profiles').insert({
          id: userId, email: u.email, full_name: u.full_name, organization_id: ORG_ID, role: u.role, is_active: true
        })
        console.log(pfErr ? `     ❌ Perfil: ${pfErr.message}` : `     ✅ Perfil creado → ${u.role}`)
      }
    }
  } else {
    console.log('  ⚠️  Sin SR_KEY — no se pueden crear usuarios')
  }

  // === RESUMEN ===
  console.log('\n📊 Estado final:')
  const queries = [
    ['organizations',    '*'],
    ['profiles',         'id,email,role'],
    ['branches',         'id,name,type'],
    ['products',         'id,name'],
    ['customers',        'id,name,document_number'],
    ['invoices',         'id,serie,correlativo,status'],
    ['cash_registers',   'id,status'],
    ['sunat_config',     'id,ruc,is_configured'],
  ]
  for (const [table, select] of queries) {
    const query = supabase.from(table).select(select).eq('organization_id', ORG_ID)
    if (table === 'organizations') {
      const { data } = await supabase.from(table).select(select).eq('id', ORG_ID)
      console.log(`  ${table}: ${data?.length || 0}`)
      continue
    }
    const { data, count } = await query
    const rows = data || []
    if (table === 'profiles') {
      for (const r of rows) console.log(`  ${table}: ${rows.length} | ${r.email} (${r.role})`)
    } else {
      console.log(`  ${table}: ${rows.length}`)
    }
  }

  console.log('\n✅ Inicialización completada.')
  if (!canWrite) console.log('⚠️  Ejecuta con SR_KEY para crear/actualizar usuarios y config.')
  console.log('\n🔑 Credenciales de acceso:')
  for (const u of USERS) {
    console.log(`  ${u.email} / ${u.password} → ${u.role}`)
  }
}

init().catch(e => { console.error('❌', e); process.exit(1) })
