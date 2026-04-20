
import { GoogleGenAI, Type } from "@google/genai";
import { AuditResult, Guideline } from "../types/audit";
import { dbStorage } from "./db";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  requestCount: number;
}

/**
 * Updates the global token usage statistics in the database.
 */
async function updateTokenUsage(usage?: any) {
  if (!usage) return;
  
  const currentUsage = await dbStorage.getItem<TokenUsage>('ai_token_usage') || {
    promptTokens: 0,
    candidatesTokens: 0,
    totalTokens: 0,
    requestCount: 0
  };

  const updatedUsage: TokenUsage = {
    promptTokens: currentUsage.promptTokens + (usage.promptTokenCount || 0),
    candidatesTokens: currentUsage.candidatesTokens + (usage.candidatesTokenCount || 0),
    totalTokens: currentUsage.totalTokens + (usage.totalTokenCount || 0),
    requestCount: currentUsage.requestCount + 1
  };

  await dbStorage.setItem('ai_token_usage', updatedUsage);
}

/**
 * Handles errors from Gemini API and provides user-friendly Thai messages.
 */
function handleAiError(error: any): never {
  console.error("Gemini API Error:", error);
  const message = error?.message || "";
  
  if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("quota")) {
    throw new Error("ขออภัยครับ โควต้าการใช้งาน AI ฟรีรายนาทีเต็มแล้ว ระบบกำลังพยายามส่งข้อมูลใหม่ให้อัตโนมัติในพื้นหลัง (Retry) แต่หากยังพบข้อความนี้สะสมกันหลายครั้ง กรุณารอสัก 1-2 นาทีแล้วกด 'เริ่มตรวจร้านค้า' อีกครั้งครับ");
  }
  
  if (message.includes("500") || message.includes("Internal Server Error")) {
    throw new Error("เซิร์ฟเวอร์ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งในภายหลังครับ");
  }

  if (message.includes("safety") || message.includes("blocked")) {
    throw new Error("AI ปฏิเสธการวิเคราะห์เนื่องจากขัดต่อระเบียบด้านความปลอดภัย (Safety Filter) กรุณาตรวจสอบรูปภาพของท่านอีกครั้ง");
  }

  throw new Error("เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI กรุณาลองใหม่อีกครั้งครับ");
}

/**
 * Retries an async function with exponential backoff.
 * Scaled for Gemini Free Tier (15 RPM / 1M TPM).
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 10000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const message = error?.message || "";
    const isRateLimit = message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("quota");
    
    if (retries > 0 && isRateLimit) {
      // For Free Tier, we want to wait significantly longer to clear the 1-minute window
      const waitTime = delay + (Math.random() * 5000); 
      console.warn(`[AI Quota] Hit limit. Retrying in ${(waitTime / 1000).toFixed(1)}s... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return withRetry(fn, retries - 1, delay + 10000); // Step up by 10s each time
    }
    throw error;
  }
}

export async function generateGuidelineRules(
  description: string,
  images: string[]
): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    You are an expert Visual Merchandising Specialist. 
    Your task is to create a set of clear, actionable, and highly precise "Audit Rules" based on a user's description and reference images.
    
    The rules should be formatted as a numbered list. 
    Focus on:
    - Exact pixel/physical placement.
    - Millimeter precision for distances or alignments.
    - Specific sequence of posters or signs.
    - Identification of core products vs. decorative elements.
    
    Instruction:
    - Use technical terms. 
    - Be rigorous. 
    - Rules must be objective (avoid "nice", "clean", "good" - use measurable facts).
    - Return ONLY the rules in Thai.
  `;

  const parts: any[] = [
    { text: `User Description: ${description}` },
  ];

  images.forEach((img, idx) => {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: img.split(',')[1] || img,
      },
    });
    parts.push({ text: `Reference Image ${idx + 1}` });
  });

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction,
      },
    }));

    await updateTokenUsage(response.usageMetadata);
    return response.text || "";
  } catch (error) {
    handleAiError(error);
  }
}

export async function analyzeStoreLayout(
  fileData: string,
  mimeType: string,
  allGuidelines: Guideline[]
): Promise<AuditResult> {
  const model = "gemini-3-flash-preview";
  
  // Validate and fallback for mimeType
  const safeMimeType = mimeType && mimeType.includes('/') ? mimeType : 'image/jpeg';
  
  const guidelinesContext = allGuidelines.length > 0 
    ? allGuidelines.map(g => `Guideline Name: ${g.name}\nDescription: ${g.description}\nRules: ${g.rules}`).join('\n---\n')
    : "No specific guidelines provided. Perform a general audit based on retail best practices (cleanliness, organization, safety, and professional presentation).";

  const systemInstruction = `
    คุณคือผู้เชี่ยวชาญด้าน Visual Merchandising Auditor สำหรับ Apple Experience Zone โดยใช้ตรรกะแบบ "Deterministic Audit" (เน้นการตรวจสอบเชิงประจักษ์และเหตุผลที่คงที่)
    
    🎯 **เป้าหมาย**: ผลลัพธ์ต้องมีความคงที่ (Consistent) แม้จะตรวจรูปเดิมซ้ำๆ
    
    **กระบวนการคิดของ Auditor**:
    1. **Sighting**: ระบุวัตถุทั้งหมดที่เห็นในภาพ (Product, Label, Poster)
    2. **Evidence-Based Comparison**: เปรียบเทียบภาพ "ร้านค้าปัจจุบัน" กับ "ภาพอ้างอิง (Ref Image)" และ "กฎ (Guidelines)" แบบจุดต่อจุด
    3. **Binary Judgement**: หากพบจุดที่ไม่ตรงตามเกณฑ์ ต้องมีหลักฐานชัดเจนว่า "ไม่ตรงอย่างไร" (เช่น วางซ้ายแต่เกณฑ์บอกขวา) หากไม่แน่ใจเนื่องจากมุมกล้อง ให้ถือว่า pass แต่คอมเมนต์เป็น warning แทน
    
    **เกณฑ์การตรวจสอบ (Strong Logic)**:
    - **Central Placement**: ตรวจสอบ Artwork กึ่งกลางโต๊ะ เทียบกับภาพ Guideline ด้านซ้ายมือ (Master Artwork) ต้องเป็นรุ่นเดียวกัน 100%
    - **Product Alignment**: การจัดวางสินค้าต้องเรียงลำดับตามผัง (Top View) หากลำดับสลับกัน (เช่น Pro Max วางก่อน Pro รุ่นธรรมดา) ให้แจ้ง fail ทันที
    - **Physical Distances**: ให้ความสำคัญกับ "สัดส่วนระยะห่าง" มากกว่า "ตัวเลขมิลลิเมตร" (เนื่องจาก Perspective ของกล้อง) แต่ถ้าสัดส่วนผิดเพี้ยนชัดเจน (เช่น เครื่องเบียดกันเกินไป) ให้แจ้ง warning
    - **Identity Integrity**: ตรวจสอบรุ่นสินค้าบนป้ายราคา (Price Tag) ต้องตรงกับรุ่นเครื่องที่วางอยู่จริง
    
    **กฎการให้คะแนน**:
    - 100: ถูกต้องทุกจุดตามผัง
    - 80-90: มีความคลาดเคลื่อนเรื่องระยะห่างเล็กน้อย (Warning)
    - ต่ำกว่า 80: มีการวางผิดตำแหน่ง, สลับรุ่น, หรือใช้สื่อโฆษณาผิด (Fail)
    
    **รูปแบบการรายงาน**:
    - OverallScore: คะแนน 0-100
    - Summary: สรุปจุดแข็งและจุดอ่อนเป็น Bullet points (เน้นข้อเท็จจริง)
    - Checks: แจ้งสถานะตามความเป็นจริง (pass/fail/warning) พร้อมระบุเหตุผลเชิงเทคนิค
    
    Return JSON only.
  `;

  const parts: any[] = [
    { text: `Available Guidelines:\n${guidelinesContext}` },
    {
      inlineData: {
        mimeType: safeMimeType,
        data: fileData.split(',')[1] || fileData,
      },
    },
  ];

  // Add reference images from all guidelines if they exist (limit to a few to avoid token bloat)
  let refImageCount = 0;
  allGuidelines.forEach(g => {
    g.images.forEach(img => {
      if (refImageCount < 5) { // Limit to 5 reference images total
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: img.split(',')[1] || img,
          },
        });
        parts.push({ text: `Reference image for guideline: ${g.name}` });
        refImageCount++;
      }
    });
  });

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction,
        temperature: 0.1, // Set to very low for consistency
        topP: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            checks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  category: { 
                    type: Type.STRING,
                    enum: ['placement', 'distance', 'poster', 'prohibited', 'general']
                  },
                  title: { type: Type.STRING },
                  status: { 
                    type: Type.STRING,
                    enum: ['pass', 'fail', 'warning']
                  },
                  message: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                },
                required: ['id', 'category', 'title', 'status', 'message']
              }
            }
          },
          required: ['overallScore', 'summary', 'checks']
        }
      },
    }));

    await updateTokenUsage(response.usageMetadata);
    const result = JSON.parse(response.text || "{}");
    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    handleAiError(error);
  }
}

export async function generateAutoGuideline(
  images: string[]
): Promise<{ name: string; description: string; rules: string }> {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    You are an expert Visual Merchandising Specialist. 
    Your task is to analyze the provided "Golden Sample" reference images and automatically generate a comprehensive Guideline.
    
    You must return a JSON object with:
    1. name: A concise, professional name for this display in Thai.
    2. description: A brief summary of what this display is and its purpose in Thai.
    3. rules: A detailed, numbered list of audit rules in Thai. Be extremely precise about placement, spacing, and alignment based on what you see in the images.
    
    Format the rules clearly so they can be used for automated auditing.
    IMPORTANT: All content MUST be in Thai language.
  `;

  const parts: any[] = [];

  images.forEach((img, idx) => {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: img.split(',')[1] || img,
      },
    });
    parts.push({ text: `Reference Image ${idx + 1}` });
  });

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            rules: { type: Type.STRING },
          },
          required: ['name', 'description', 'rules']
        }
      },
    }));

    await updateTokenUsage(response.usageMetadata);
    return JSON.parse(response.text || "{}");
  } catch (error) {
    handleAiError(error);
  }
}
