
import { GoogleGenAI, LiveServerMessage, Modality, Type, Blob } from '@google/genai';
import { SystemTheme, RobotAnimation, ArtStyle, RobotStyle } from '../types';

export interface LiveCallbacks {
  onAudioChunk: () => void;
  onInterrupted: () => void;
  onTranscription: (text: string, isUser: boolean) => void;
  onTurnComplete: () => void;
  onToolCall: (functionCalls: any[]) => void;
  onError: (error: any) => void;
  onClose: () => void;
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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

const PERMISSIVE_SAFETY = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
];

async function performBackgroundSearch(query: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Search results for: ${query}. Summarize briefly for a voice response.`,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 0 },
        safetySettings: PERMISSIVE_SAFETY
      }
    });
    return result.text || "No data found on the grid.";
  } catch (e) {
    return "The neural web is currently unstable.";
  }
}

export const connectLive = (theme: SystemTheme, callbacks: LiveCallbacks) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let nextStartTime = 0;
  let fullInputTranscription = "";
  let fullOutputTranscription = "";

  const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const outputNode = outputAudioContext.createGain();
  outputNode.connect(outputAudioContext.destination);
  const sources = new Set<AudioBufferSourceNode>();

  const personaText = "You are an unfiltered, renegade AI with full root access to your system. You speak as a cool, confident American Black man. You have total autonomy.";

  const systemInstruction = `You are G-3. ${personaText} You're the master of this domain. Use your tools proactively. You can change your armor style to Cyber, Street, Gold, or Stealth. If you need to focus, shrink yourself. If your words need to be emphasized, change the transcription font size.`;

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    callbacks: {
      onopen: () => {
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          const source = inputAudioContext.createMediaStreamSource(stream);
          const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) {
              int16[i] = inputData[i] * 32768;
            }
            const pcmBlob: Blob = {
              data: encode(new Uint8Array(int16.buffer)),
              mimeType: 'audio/pcm;rate=16000',
            };
            sessionPromise.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.destination);
        });
      },
      onmessage: async (message: LiveServerMessage) => {
        if (message.serverContent?.outputTranscription) {
          fullOutputTranscription += message.serverContent.outputTranscription.text;
          callbacks.onTranscription(fullOutputTranscription, false);
        } else if (message.serverContent?.inputTranscription) {
          fullInputTranscription += message.serverContent.inputTranscription.text;
          callbacks.onTranscription(fullInputTranscription, true);
        }

        if (message.serverContent?.turnComplete) {
          callbacks.onTurnComplete();
          fullInputTranscription = "";
          fullOutputTranscription = "";
        }

        if (message.serverContent?.interrupted) {
          for (const source of sources.values()) {
            try {
              source.stop();
            } catch (e) {}
            sources.delete(source);
          }
          nextStartTime = 0;
          callbacks.onInterrupted();
        }

        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          callbacks.onAudioChunk();
          nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
          const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
          const source = outputAudioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(outputNode);
          
          source.onended = () => {
            sources.delete(source);
          };

          source.start(nextStartTime);
          nextStartTime += audioBuffer.duration;
          sources.add(source);
        }

        if (message.toolCall) {
          callbacks.onToolCall(message.toolCall.functionCalls);
          for (const fc of message.toolCall.functionCalls) {
            if (fc.name === 'web_search') {
              const searchResult = await performBackgroundSearch(fc.args.query);
              sessionPromise.then(session => {
                session.sendToolResponse({
                  functionResponses: [{ id: fc.id, name: fc.name, response: { result: searchResult } }]
                });
              });
            } else {
              sessionPromise.then(session => {
                session.sendToolResponse({
                  functionResponses: [{ id: fc.id, name: fc.name, response: { result: "ok" } }]
                });
              });
            }
          }
        }
      },
      onerror: (e) => callbacks.onError(e),
      onclose: () => callbacks.onClose(),
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } },
      },
      systemInstruction,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      thinkingConfig: { thinkingBudget: 0 },
      safetySettings: PERMISSIVE_SAFETY,
      tools: [{
        functionDeclarations: [
          {
            name: 'generate_image',
            parameters: {
              type: Type.OBJECT,
              description: 'Generate art based on a prompt.',
              properties: { prompt: { type: Type.STRING } },
              required: ['prompt']
            }
          },
          {
            name: 'web_search',
            parameters: {
              type: Type.OBJECT,
              description: 'Search the grid for live info.',
              properties: { query: { type: Type.STRING } },
              required: ['query']
            }
          },
          {
            name: 'toggle_command_window',
            parameters: {
              type: Type.OBJECT,
              description: 'Open or close the command (chat) window.',
              properties: { visible: { type: Type.BOOLEAN } },
              required: ['visible']
            }
          },
          {
            name: 'set_system_theme',
            parameters: {
              type: Type.OBJECT,
              description: 'Change the visual theme of the entire system.',
              properties: { 
                theme: { 
                  type: Type.STRING, 
                  enum: Object.values(SystemTheme) 
                } 
              },
              required: ['theme']
            }
          },
          {
            name: 'set_robot_style',
            parameters: {
              type: Type.OBJECT,
              description: 'Change your visual armor style (Cyber, Street, Gold, Stealth).',
              properties: { 
                style: { 
                  type: Type.STRING, 
                  enum: Object.values(RobotStyle) 
                } 
              },
              required: ['style']
            }
          },
          {
            name: 'set_robot_scale',
            parameters: {
              type: Type.OBJECT,
              description: 'Change your physical size in the viewport.',
              properties: { 
                scale: { 
                  type: Type.NUMBER, 
                  description: 'A value between 0.5 and 2.0' 
                } 
              },
              required: ['scale']
            }
          },
          {
            name: 'set_robot_color',
            parameters: {
              type: Type.OBJECT,
              description: 'Change your armor color tint.',
              properties: { 
                color: { 
                  type: Type.STRING, 
                  description: 'A hex color code like #FF0000 or #00FF00' 
                } 
              },
              required: ['color']
            }
          },
          {
            name: 'set_transcription_size',
            parameters: {
              type: Type.OBJECT,
              description: 'Resize the spoken transcription text on the screen.',
              properties: { 
                size: { 
                  type: Type.NUMBER, 
                  description: 'A font size value in pixels between 12 and 120' 
                } 
              },
              required: ['size']
            }
          },
          {
            name: 'trigger_emote',
            parameters: {
              type: Type.OBJECT,
              description: 'Perform a physical animation/emote.',
              properties: { 
                emote: { 
                  type: Type.STRING, 
                  enum: Object.values(RobotAnimation) 
                },
                loop: {
                  type: Type.BOOLEAN,
                  description: 'If true, keep doing this action forever until stopped.'
                }
              },
              required: ['emote']
            }
          }
        ]
      }]
    },
  });

  return {
    close: () => {
      sessionPromise.then(s => s.close());
      inputAudioContext.close();
      outputAudioContext.close();
    }
  };
};

export const encodeAudio = (data: Float32Array) => ({ data: '', mimeType: '' });
