import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TABLE_NAME = 'prod_project_prompt_analytics';
const REINDEX_DELAY = 60; // seconds between each index

export const maxDuration = 300; // 5 minutes for Vercel

async function sleep(seconds: number) {
  console.log(`⏳ Waiting ${seconds}s...`);
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧹 SPACE RECLAMATION STARTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 1: Check current size
    console.log('📊 Current size:');
    const { data: beforeSizes, error: beforeError } = await supabase
      .rpc('check_table_sizes', { table_name: TABLE_NAME });
    
    if (beforeError) {
      console.error('Size check error:', beforeError);
      throw beforeError;
    }
    
    console.table(beforeSizes);
    const beforeGB = (beforeSizes[0].size_bytes / 1024 / 1024 / 1024).toFixed(2);
    console.log(`Current total: ${beforeGB} GB\n`);

    // Step 2: VACUUM (run without waiting for completion)
    console.log('1️⃣ Initiating VACUUM ANALYZE...');
    console.log('   ⚠️ Note: VACUUM runs async in Supabase, may complete in background\n');
    
    // Try to run VACUUM - it may fail in RPC context, that's okay
    const vacuumStart = Date.now();
    const { error: vacuumError } = await supabase
      .rpc('maintenance_vacuum_table', { table_name: TABLE_NAME });
    
    if (vacuumError) {
      console.warn('⚠️ VACUUM RPC error (expected):', vacuumError.message);
      console.log('💡 Tip: Run "VACUUM ANALYZE prod_project_prompt_analytics;" directly in SQL Editor\n');
    } else {
      const vacuumDuration = ((Date.now() - vacuumStart) / 1000).toFixed(1);
      console.log(`✅ VACUUM initiated (${vacuumDuration}s)\n`);
    }

    // Wait a bit
    await sleep(3);

    // Step 3: REINDEX (this should work)
    console.log(`2️⃣ Starting throttled REINDEX (${REINDEX_DELAY}s delays)...`);
    console.log('   ⏱️ This will take 40-90 minutes\n');
    
    const reindexStart = Date.now();
    const { data: reindexResult, error: reindexError } = await supabase
      .rpc('maintenance_reindex_throttled', {
        table_name: TABLE_NAME,
        delay_seconds: REINDEX_DELAY
      });
    
    if (reindexError) {
      console.error('❌ REINDEX error:', reindexError);
      throw reindexError;
    }
    
    const reindexDuration = ((Date.now() - reindexStart) / 60000).toFixed(1);
    console.log(`\n✅ REINDEX complete (${reindexDuration} minutes)`);
    console.log(`📊 Reindexed ${reindexResult.indexes_reindexed} indexes\n`);

    // Step 4: Check final size
    console.log('📊 Final size:');
    const { data: afterSizes, error: afterError } = await supabase
      .rpc('check_table_sizes', { table_name: TABLE_NAME });
    
    if (afterError) throw afterError;
    
    console.table(afterSizes);
    
    const afterGB = (afterSizes[0].size_bytes / 1024 / 1024 / 1024).toFixed(2);
    const savedGB = (parseFloat(beforeGB) - parseFloat(afterGB)).toFixed(2);
    const savedPercent = ((parseFloat(savedGB) / parseFloat(beforeGB)) * 100).toFixed(1);
    
    const totalDuration = ((Date.now() - startTime) / 60000).toFixed(1);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`💾 Space reclaimed: ${savedGB} GB (${savedPercent}%)`);
    console.log(`📉 Before: ${beforeGB} GB → After: ${afterGB} GB`);
    console.log(`⏱️  Total time: ${totalDuration} minutes`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return NextResponse.json({
      success: true,
      message: 'Space reclamation complete!',
      beforeGB,
      afterGB,
      savedGB,
      savedPercent,
      reindexResult,
      totalDurationMinutes: totalDuration
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    const duration = ((Date.now() - startTime) / 60000).toFixed(1);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        durationMinutes: duration
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}