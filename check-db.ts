import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) { 
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"); 
  process.exit(1); 
}

const supabase = createClient(url, key);

async function run() {
  console.log(`🔍 Testing connection to: ${url}`);
  
  const { count, error } = await supabase.from('foods').select('*', { count: 'exact', head: true });
  
  if (error) { 
    console.error("❌ Database Error (Schema might not be pushed):", error.message); 
  } else { 
    console.log(`✅ Connection successful! Schema is present.`);
    console.log(`📊 Foods in database: ${count}`);
    if (count === 0) {
      console.log(`⚠️  Warning: Your foods table is empty. You need to run the ETL script!`);
    }
  }
}
run();
