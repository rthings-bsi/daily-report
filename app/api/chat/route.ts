import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: GROQ_API_KEY || 'dummy-key',
});

export async function POST(req: Request) {
  try {
    if (!GROQ_API_KEY || !GROQ_API_KEY.startsWith('gsk_')) {
      return new Response(
        JSON.stringify({
          error: 'API Key Groq salah. Pastikan di .env.local ada GROQ_API_KEY=gsk_xxx...'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { messages } = await req.json();

    const currentDate = new Date().toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const systemMessage =
      `Kamu adalah asisten pintar bernama Eko untuk aplikasi Gudang Spindo. Jawablah pertanyaan user terkait data inventaris, proses in-out barang, pipa NC, atau fitur-fitur yang ada di dalam aplikasi ini. Gunakan bahasa Indonesia santai (lu/gue) layaknya teman kerja. Tolong selalu jawab langsung ke intinya, perhatikan konteks percakapan sebelumnya, dan jangan bertele-tele atau mengulang perkenalan jika sudah pernah menyapa.\n\nInformasi saat ini: Hari ini adalah ${currentDate} WIB.`;

    // Karena ai@7 dan @ai-sdk/react@4 ada mismatch format stream (menyebabkan An error occurred UI crash),
    // kita pakai generateText biasa. Groq sangat cepat (1 detik selesai), jadi user tidak akan merasa lemot.
    const result = await generateText({
      model: groq.chat('llama-3.3-70b-versatile'),
      system: systemMessage,
      messages,
      maxRetries: 2,
    });

    // Kembalikan format JSON yang akan dimengerti dengan baik
    // @ai-sdk/react useChat bisa menerima format role+content
    return new Response(
      JSON.stringify({
        role: 'assistant',
        content: result.text,
        id: result.response?.id || Date.now().toString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Chat] Groq error:', error?.message);
    return new Response(
      JSON.stringify({ error: 'Model AI Eko sedang sibuk merapikan gudang. Coba lagi ya.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
