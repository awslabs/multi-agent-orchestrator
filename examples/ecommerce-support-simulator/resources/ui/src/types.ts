// src/types.ts

export interface Message {
    content: string;
    destination: 'customer' | 'support';
    source: 'ui' | 'backend';
    timestamp: string;
  }