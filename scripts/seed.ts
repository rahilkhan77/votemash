/**
 * Seed database with initial categories and participants
 * Run with: npx ts-node scripts/seed.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const categories = [
  { name: 'AI Tools', slug: 'ai-tools', description: 'AI-powered tools and assistants', icon: '🤖', sort_order: 1 },
  { name: 'Startups', slug: 'startups', description: 'Innovative startup companies', icon: '🚀', sort_order: 2 },
  { name: 'Developer Tools', slug: 'developer-tools', description: 'Tools for software development', icon: '⚙️', sort_order: 3 },
  { name: 'Apps', slug: 'apps', description: 'Software applications', icon: '📱', sort_order: 4 },
  { name: 'Products', slug: 'products', description: 'Popular consumer products', icon: '📦', sort_order: 5 },
  { name: 'Design Tools', slug: 'design-tools', description: 'Design and creative tools', icon: '🎨', sort_order: 6 },
  { name: 'Productivity', slug: 'productivity', description: 'Productivity and organization tools', icon: '⏰', sort_order: 7 },
  { name: 'Games', slug: 'games', description: 'Gaming platforms and games', icon: '🎮', sort_order: 8 },
];

const participants = [
  // AI Tools
  { name: 'Cursor', slug: 'cursor', type: 'ai_tool', category_slug: 'ai-tools', description: 'AI coding assistant', logo_url: 'https://www.cursor.com/favicon.svg', website_url: 'https://cursor.com' },
  { name: 'VS Code', slug: 'vscode', type: 'developer_tool', category_slug: 'ai-tools', description: 'Code editor', logo_url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vscode/vscode-original.svg', website_url: 'https://code.visualstudio.com' },
  { name: 'Claude', slug: 'claude', type: 'ai_tool', category_slug: 'ai-tools', description: 'AI assistant by Anthropic', logo_url: 'https://cdn.simpleicons.org/anthropic', website_url: 'https://claude.ai' },
  { name: 'Gemini', slug: 'gemini', type: 'ai_tool', category_slug: 'ai-tools', description: 'Google AI assistant', logo_url: 'https://cdn.simpleicons.org/googlegemini', website_url: 'https://gemini.google.com' },
  { name: 'ChatGPT', slug: 'chatgpt', type: 'ai_tool', category_slug: 'ai-tools', description: 'OpenAI AI assistant', logo_url: 'https://cdn.simpleicons.org/openai', website_url: 'https://chatgpt.com' },
  { name: 'Perplexity', slug: 'perplexity', type: 'ai_tool', category_slug: 'ai-tools', description: 'AI search engine', logo_url: 'https://cdn.simpleicons.org/perplexity', website_url: 'https://perplexity.ai' },
  { name: 'Windsurf', slug: 'windsurf', type: 'ai_tool', category_slug: 'ai-tools', description: 'Agentic IDE', logo_url: 'https://cdn.simpleicons.org/windsurf', website_url: 'https://windsurf.com' },
  { name: 'GitHub Copilot', slug: 'copilot', type: 'ai_tool', category_slug: 'ai-tools', description: 'AI pair programmer', logo_url: 'https://cdn.simpleicons.org/githubcopilot', website_url: 'https://github.com/features/copilot' },
  { name: 'v0', slug: 'v0', type: 'ai_tool', category_slug: 'ai-tools', description: 'AI app builder', logo_url: 'https://cdn.simpleicons.org/vercel', website_url: 'https://v0.dev' },
  { name: 'Lovable', slug: 'lovable', type: 'ai_tool', category_slug: 'ai-tools', description: 'AI app builder', logo_url: 'https://cdn.simpleicons.org/lovable', website_url: 'https://lovable.dev' },

  // Startups
  { name: 'Vercel', slug: 'vercel', type: 'startup', category_slug: 'startups', description: 'Cloud platform', logo_url: 'https://cdn.simpleicons.org/vercel', website_url: 'https://vercel.com' },
  { name: 'Linear', slug: 'linear', type: 'startup', category_slug: 'startups', description: 'Product management', logo_url: 'https://cdn.simpleicons.org/linear', website_url: 'https://linear.app' },
  { name: 'Notion', slug: 'notion', type: 'startup', category_slug: 'startups', description: 'All-in-one workspace', logo_url: 'https://cdn.simpleicons.org/notion', website_url: 'https://notion.so' },
  { name: 'Figma', slug: 'figma', type: 'startup', category_slug: 'startups', description: 'Design tool', logo_url: 'https://cdn.simpleicons.org/figma', website_url: 'https://figma.com' },
  { name: 'Canva', slug: 'canva', type: 'startup', category_slug: 'startups', description: 'Design platform', logo_url: 'https://cdn.simpleicons.org/canva', website_url: 'https://canva.com' },

  // Developer Tools
  { name: 'GitHub', slug: 'github', type: 'developer_tool', category_slug: 'developer-tools', description: 'Code repository', logo_url: 'https://cdn.simpleicons.org/github', website_url: 'https://github.com' },
  { name: 'GitLab', slug: 'gitlab', type: 'developer_tool', category_slug: 'developer-tools', description: 'DevOps platform', logo_url: 'https://cdn.simpleicons.org/gitlab', website_url: 'https://gitlab.com' },
  { name: 'Docker', slug: 'docker', type: 'developer_tool', category_slug: 'developer-tools', description: 'Container platform', logo_url: 'https://cdn.simpleicons.org/docker', website_url: 'https://docker.com' },
  { name: 'Supabase', slug: 'supabase', type: 'developer_tool', category_slug: 'developer-tools', description: 'Backend platform', logo_url: 'https://cdn.simpleicons.org/supabase', website_url: 'https://supabase.com' },
  { name: 'Postman', slug: 'postman', type: 'developer_tool', category_slug: 'developer-tools', description: 'API platform', logo_url: 'https://cdn.simpleicons.org/postman', website_url: 'https://postman.com' },
];

async function seed() {
  try {
    console.log('🌱 Starting seed...');

    // Clear existing data (optional - comment out for production)
    // await supabase.from('participants').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert categories
    console.log('📚 Inserting categories...');
    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .insert(categories)
      .select();

    if (categoryError) {
      console.error('Error inserting categories:', categoryError);
      throw categoryError;
    }

    console.log(`✅ Inserted ${categoryData?.length} categories`);

    // Create a map of category slugs to IDs
    const categoryMap = new Map(categoryData?.map((c) => [c.slug, c.id]) || []);

    // Prepare participants with category IDs
    const participantsWithIds = participants.map((p) => ({
      name: p.name,
      slug: p.slug,
      type: p.type,
      category_id: categoryMap.get(p.category_slug),
      description: p.description,
      logo_url: p.logo_url,
      website_url: p.website_url,
      status: 'active',
    }));

    // Insert participants
    console.log('👥 Inserting participants...');
    const { data: participantData, error: participantError } = await supabase
      .from('participants')
      .insert(participantsWithIds)
      .select();

    if (participantError) {
      console.error('Error inserting participants:', participantError);
      throw participantError;
    }

    console.log(`✅ Inserted ${participantData?.length} participants`);

    // Create an initial league
    console.log('🏆 Creating initial league...');
    const now = new Date();
    const startAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Started 24 hours ago
    const endAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Ends in 24 hours

    const { data: leagueData, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        type: 'category',
        category_id: categoryMap.get('ai-tools'),
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        status: 'active',
        league_number: 1,
      })
      .select();

    if (leagueError) {
      console.error('Error creating league:', leagueError);
      throw leagueError;
    }

    console.log(`✅ Created league`);

    // Add all AI tool participants to the league
    const aiToolParticipants = participantData?.filter((p) => categoryMap.get('ai-tools') === p.category_id) || [];

    console.log('🔗 Adding participants to league...');
    const leagueJoins = aiToolParticipants.map((p) => ({
      participant_id: p.id,
      league_id: leagueData?.[0]?.id,
    }));

    const { error: joinError } = await supabase.from('participant_league_joins').insert(leagueJoins);

    if (joinError) {
      console.error('Error adding participants to league:', joinError);
      throw joinError;
    }

    console.log(`✅ Added ${leagueJoins.length} participants to league`);

    // Initialize participant stats for the league
    console.log('📊 Initializing participant stats...');
    const stats = aiToolParticipants.map((p) => ({
      participant_id: p.id,
      league_id: leagueData?.[0]?.id,
      rating: 1500,
      wins: 0,
      losses: 0,
      battle_count: 0,
      votes_received: 0,
      win_rate: 0,
      current_rank: 0,
    }));

    const { error: statsError } = await supabase.from('participant_stats').insert(stats);

    if (statsError) {
      console.error('Error initializing stats:', statsError);
      throw statsError;
    }

    console.log(`✅ Initialized stats for ${stats.length} participants`);

    console.log('✨ Seed complete!');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
