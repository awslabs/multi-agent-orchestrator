export function request(ctx) {
    return {};
  }
  
  export function response(ctx) {
    if (ctx.error) {
      util.error(ctx.error.message, ctx.error.type);
    }
    if (!ctx.result.message || typeof ctx.result.message !== 'string') {
      util.error('Invalid response: Message is missing or not a string');
    }
    if (!ctx.result.destination || typeof ctx.result.destination !== 'string') {
      util.error('Invalid response: Destination is missing or not a string');
    }
    return { 
      destination: ctx.result.destination,
      message: ctx.result.message 
    };
  }