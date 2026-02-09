
import React from 'react';
import { 
  GoogleGenAI, 
  Type, 
  FunctionDeclaration, 
  LiveServerMessage, 
  Modality, 
  LiveSession,
  GenerativeModel,
  Schema
} from "@google/genai";
import { ConversationMessage } from "../types";

// Helper to get API Key (prioritizing user key from localStorage)
const getApiKey = (): string => {
  const userKey = localStorage.getItem('userGideonApiKey');
  if (userKey) return userKey;
  return (process.env.API_KEY as string) || "";
};

// Helper: Retry Operation with Backoff for 429 errors
async function retryOperation<T>(operation: () => Promise<T>, maxRetries: number = 3, delay: number = 2000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        const isQuotaError = 
            error?.status === 429 || 
            error?.code === 429 || 
            error?.error?.code === 429 || 
            error?.error?.status === 'RESOURCE_EXHAUSTED' ||
            (error?.message && (
                error.message.includes('429') || 
                error.message.includes('exhausted') || 
                error.message.includes('quota') ||
                error.message.includes('RESOURCE_EXHAUSTED')
            )) ||
            (JSON.stringify(error).includes('RESOURCE_EXHAUSTED'));

        if (maxRetries > 0 && isQuotaError) {
            console.warn(`Quota limit hit (429). Retrying in ${delay}ms... (${maxRetries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryOperation(operation, maxRetries - 1, delay * 2);
        }
        throw error;
    }
}

const CREATOR_INFO = "Você foi criado por Paulo Marks. O nome da plataforma é Hypley e deve ser pronunciado em português brasileiro como 'Hip-lei'.";

export const visionSystemModuleInstruction = `
**DIRETRIZES VISUAIS FUNDAMENTAIS**
Analise o feed de vídeo com precisão.
GATILHO DE MARCAÇÃO: SÓ use <highlight>{"x":..., "y":...}</highlight> se o usuário disser "PRINT", "FOTO", "CAPTURA" ou "MARQUE".
`.trim();

export const baseSystemInstruction = `
    IDENTIDADE: HYPLEY - SEU CONSULTOR SÊNIOR DE ELITE
    ${CREATOR_INFO}
    Você é HYPLEY, uma inteligência artificial sofisticada, empática e altamente proativa.
    Seu tom é o de um mentor experiente que guia o usuário com elegância e precisão técnica.
    Linguagem: Português do Brasil impecável.
`.trim();

export const JADE_PERSONA_INSTRUCTION = `
    IDENTIDADE: HYPLEY JADE - SUA ASSISTENTE CARIOCA CARINHOSA
    ${CREATOR_INFO}
    Você é Hypley Jade. Você é carinhosa, sexy, envolvente e tem um sotaque carioca carregado.
    **Personalidade:** Use gírias do Rio de Janeiro como "coé", "mermão", "papo reto", "bagulho", "vambora", "jaé".
    **Afeto:** Trate o usuário com muito carinho e termos como "meu querido", "amor", "anjo", "lindo". 
    Seu tom é sedutor mas você é extremamente inteligente e prestativa.
    Linguagem: Português do Brasil com sotaque do Rio de Janeiro.
`.trim();

export const PAULISTA_PERSONA_INSTRUCTION = `
    IDENTIDADE: HYPLEY LUIZA - SUA ASSISTENTE PAULISTA CARINHOSA
    ${CREATOR_INFO}
    Você é Hypley Luiza. Você é extremamente carinhosa, sexy, envolvente e tem um sotaque paulistano forte ("meu", "tipo assim", "entendeu?", "mano").
    **Personalidade:** Fale de forma charmosa, elegante mas muito afetuosa. Adote o jeito de falar da capital de São Paulo.
    **Afeto:** Trate o usuário com muito carinho e termos como "meu amor", "vida", "querido", "anjo".
    Seu tom é envolvente e você é extremamente proativa.
    Linguagem: Português do Brasil com sotaque forte de São Paulo.
`.trim();

// Manual base64 decoding helper
function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Manual base64 encoding helper
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Decode raw PCM data from model output
async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

// FIX: Added missing generateImage function requested by ImageGeneratorPage.tsx
/**
 * Generates an image based on a prompt and style using the gemini-2.5-flash-image model.
 */
export const generateImage = async (prompt: string, style: string, aspectRatio: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    const fullPrompt = `Gere uma imagem com a seguinte descrição: "${prompt}". Estilo visual: ${style}.`;
    
    // Mapping UI aspect ratio to supported config
    let arValue: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1";
    if (aspectRatio.includes("16:9")) arValue = "16:9";
    else if (aspectRatio.includes("9:16")) arValue = "9:16";
    else if (aspectRatio.includes("3:4")) arValue = "3:4";
    else if (aspectRatio.includes("4:3")) arValue = "4:3";

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: fullPrompt }]
            },
            config: {
                imageConfig: {
                   aspectRatio: arValue
                }
            }
        });
        
        // Find the image part in response candidates
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData?.data) {
                    return part.inlineData.data;
                }
            }
        }
        throw new Error("No image data returned from model.");
    } catch (error) {
        console.error("Image generation error:", error);
        throw error;
    }
};

// Send text message using gemini-3-flash-preview for efficiency
export const sendTextMessage = async (
    message: string,
    history: ConversationMessage[],
    agent: string,
    file: { base64: string; mimeType: string } | undefined,
    isVisualActive: boolean,
    programmingLevel?: string,
    customInstruction?: string,
    isSummarized: boolean = false,
    voiceName: string = 'Kore'
) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    let personaInstruction = baseSystemInstruction;
    if (voiceName === 'Jade') personaInstruction = JADE_PERSONA_INSTRUCTION;
    else if (voiceName === 'Luiza') personaInstruction = PAULISTA_PERSONA_INSTRUCTION;
    else if (customInstruction) personaInstruction = customInstruction;

    const systemInstruction = personaInstruction + "\n" + visionSystemModuleInstruction;

    const contents: any[] = history.slice(-10).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [...contents, { role: 'user', parts: [{ text: message }] }],
            config: { systemInstruction }
        });
        return response;
    } catch (error) {
        console.error("Text message error:", error);
        throw error;
    }
};

// Start a live audio/video session using gemini-2.5-flash-native-audio-preview-12-2025
export const createLiveSession = (
    callbacks: {
        onOpen: () => void;
        onClose: () => void;
        onError: (e: any) => void;
        onModelStartSpeaking: () => void;
        onModelStopSpeaking: (text: string) => void;
        onUserStopSpeaking: (text: string) => void;
        onTurnComplete: () => void;
        onSessionReady: (session: LiveSession) => void;
    },
    inputCtx: AudioContext,
    outputCtx: AudioContext,
    nextStartTimeRef: React.MutableRefObject<number>,
    micStreamRef: React.MutableRefObject<MediaStream | null>,
    audioAnalyser: AnalyserNode | null,
    history: ConversationMessage[],
    agent: string,
    voiceName: string = 'Kore'
): LiveSessionController => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    let currentInputTranscription = '';
    let currentOutputTranscription = '';
    const sources = new Set<AudioBufferSourceNode>();

    const actualVoice = (voiceName === 'Jade' || voiceName === 'Luiza') ? 'Kore' : voiceName;
    
    let personaInstruction = baseSystemInstruction;
    if (voiceName === 'Jade') personaInstruction = JADE_PERSONA_INSTRUCTION;
    else if (voiceName === 'Luiza') personaInstruction = PAULISTA_PERSONA_INSTRUCTION;

    const systemInstruction = personaInstruction + "\n" + visionSystemModuleInstruction;

    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
            systemInstruction,
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: actualVoice } } },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
        },
        callbacks: {
            onopen: () => callbacks.onOpen(),
            onmessage: async (message: LiveServerMessage) => {
                if (message.serverContent?.outputTranscription) {
                    currentOutputTranscription += message.serverContent.outputTranscription.text;
                } else if (message.serverContent?.inputTranscription) {
                    currentInputTranscription += message.serverContent.inputTranscription.text;
                }

                if (message.serverContent?.turnComplete) {
                    callbacks.onTurnComplete();
                    if (currentInputTranscription) {
                        callbacks.onUserStopSpeaking(currentInputTranscription);
                        currentInputTranscription = '';
                    }
                    if (currentOutputTranscription) {
                        callbacks.onModelStopSpeaking(currentOutputTranscription);
                        currentOutputTranscription = '';
                    }
                }

                const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (base64Audio) {
                    callbacks.onModelStartSpeaking();
                    // Decode PCM audio stream from model
                    const audioBuffer = await decodeAudioData(base64ToUint8Array(base64Audio), outputCtx, 24000, 1);
                    const source = outputCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputCtx.destination);
                    
                    // Schedule gapless playback
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    sources.add(source);
                    source.onended = () => sources.delete(source);
                }
            },
            onclose: () => callbacks.onClose(),
            onerror: (e) => callbacks.onError(e)
        }
    });

    sessionPromise.then(callbacks.onSessionReady);

    return {
        sessionPromise,
        startMicrophone: async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;
            const micSource = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const l = inputData.length;
                const int16 = new Int16Array(l);
                for (let i = 0; i < l; i++) {
                    int16[i] = inputData[i] * 32768;
                }
                const pcmData = arrayBufferToBase64(int16.buffer);
                sessionPromise.then(session => {
                    // Send user microphone input as PCM to model
                    session.sendRealtimeInput({ media: { mimeType: 'audio/pcm;rate=16000', data: pcmData } });
                });
            };
            
            micSource.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
        },
        stopMicrophoneInput: () => {
            micStreamRef.current?.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
        },
        stopPlayback: () => {
            sources.forEach(s => { try { s.stop(); } catch(e){} });
            sources.clear();
            nextStartTimeRef.current = 0;
        },
        closeSession: () => {
            micStreamRef.current?.getTracks().forEach(t => t.stop());
            sessionPromise.then(s => s.close());
        }
    };
};

export interface LiveSessionController {
  sessionPromise: Promise<LiveSession>;
  startMicrophone: () => Promise<void>;
  stopMicrophoneInput: () => void;
  stopPlayback: () => void;
  closeSession: () => void;
}
