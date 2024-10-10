export function request(ctx) {
  return {
    payload: {
      destination: ctx.arguments.destination,
      message: ctx.arguments.message
    }
  };
 }
 
 export function response(ctx) {
   if (!ctx.result) {
     util.error('No result returned from the previous step');
   }
   
   const destination = ctx.result.destination || ctx.prev.result.destination;
   const message = ctx.result.message || ctx.prev.result.message;
   
   if (!destination || typeof destination !== 'string') {
     util.error('Invalid or missing destination');
   }
   
   if (!message || typeof message !== 'string') {
     util.error('Invalid or missing message');
   }
   
   return {
     destination: destination,
     message: message
   };
 }