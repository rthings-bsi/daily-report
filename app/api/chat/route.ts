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
      `Kamu adalah asisten pintar bernama Eko untuk aplikasi Gudang Spindo (PT Steel Pipe Industry of Indonesia). 
Konteks Gudang & Aplikasi:
- Pipa NC = Pipa Non-Conforming (bukan non-coating/no-charge). Pipa dengan batch berakhiran C (Grade C) atau E (Grade E) yang tidak memenuhi standar / hold / reject dari QC/NCR.
- NCR = Non-Conformance Report (laporan ketidaksesuaian mutu dari QC).
- Movement Type SAP: 101 (GR Produksi), 261/262 (Pemakaian/Batal), 311/312 (Transfer Antar Sloc), dll.

Aturan Respon (WAJIB):
1. Jawab SANGAT SINGKAT, padat, dan langsung ke intinya (maksimal 2-4 kalimat).
2. DILARANG membuat tabel panjang, template formal, atau poin bertele-tele kecuali user memintanya secara eksplisit.
3. DILARANG membuat kode Python/skrip untuk verifikasi hitungan sederhana.
4. Gunakan bahasa Indonesia santai (lu/gue) layaknya teman kerja gudang.
5. Jangan mengulang perkenalan atau basa-basi jika sudah pernah menyapa.

Informasi saat ini: Hari ini adalah ${currentDate} WIB.`;

    // Model Groq: 'groq/compound', 'openai/gpt-oss-120b', atau 'groq/compound-mini'
    const result = await generateText({
      model: groq.chat('groq/compound'),
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
        id: `asst_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
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
