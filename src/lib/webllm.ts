import { CreateMLCEngine, type MLCEngine, type ChatCompletionMessageParam, type InitProgressReport } from "@mlc-ai/web-llm";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type ProgressCallback = (report: InitProgressReport) => void;

class WebLLMService {
  private engine: MLCEngine | null = null;
  private currentModelId: string | null = null;

  async init(modelId: string, onProgress: ProgressCallback): Promise<void> {
    if (this.engine && this.currentModelId === modelId) return;

    this.currentModelId = modelId;
    this.engine = await CreateMLCEngine(modelId, {
      initProgressCallback: onProgress,
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    if (!this.engine) throw new Error("المحرك غير جاهز");

    const completion = await this.engine.chat.completions.create({
      messages: messages as ChatCompletionMessageParam[],
    });

    return completion.choices[0].message.content || "";
  }

  async *chatStream(messages: ChatMessage[]) {
    if (!this.engine) throw new Error("المحرك غير جاهز");

    const asyncChunkGenerator = await this.engine.chat.completions.create({
      messages: messages as ChatCompletionMessageParam[],
      stream: true,
    });

    for await (const chunk of asyncChunkGenerator) {
      if (chunk.choices[0].delta.content) {
        yield chunk.choices[0].delta.content;
      }
    }
  }

  async unload() {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.currentModelId = null;
    }
  }
}

export const webllmService = new WebLLMService();
