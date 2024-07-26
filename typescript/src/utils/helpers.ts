import { Transform, TransformCallback } from 'stream';
import { ToolInput } from '../types';


export class AccumulatorTransform extends Transform {
    private accumulator: string;
  
    constructor() {
      super({
        objectMode: true  // This allows the transform to handle object chunks
      });
      this.accumulator = '';
    }
  
    _transform(chunk: any, encoding: string, callback: TransformCallback): void {
      const text = this.extractTextFromChunk(chunk);
      if (text) {
        this.accumulator += text;
        this.push(text);  // Push the text, not the original chunk
      }
      callback();
    }
  
    extractTextFromChunk(chunk: any): string | null {
      if (typeof chunk === 'string') {
        return chunk;
      } else if (chunk.contentBlockDelta?.delta?.text) {
        return chunk.contentBlockDelta.delta.text;
      }
      // Add more conditions here if there are other possible structures
      return null;
    }
  
    getAccumulatedData(): string {
      return this.accumulator;
    }
  }

  export function extractXML(text: string) {
    const xmlRegex = /<response>[\s\S]*?<\/response>/;
    const match = text.match(xmlRegex);
    return match ? match[0] : null;
  }


  export function isToolInput(input: unknown): input is ToolInput {
    return (
      typeof input === 'object' &&
      input !== null &&
      'selected_agent' in input &&
      'confidence' in input
    );
  }

